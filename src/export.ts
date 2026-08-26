import JSZip from 'jszip'
import { assetPath } from './data'
import type { AtlasManifest, CatRecord, GridArtMode } from './types'

export const MAX_EXPORT_CATS = 10

export type ExportFormat = 'png' | 'webp'
export type ExportSize = 'small' | 'medium' | 'large'

export const EXPORT_SCALES: Record<ExportSize, number> = {
  small: 8,
  medium: 16,
  large: 32,
}

interface ExportOptions {
  artMode: GridArtMode
  format: ExportFormat
  size: ExportSize
}

type AtlasSource = AtlasManifest['atlas'] | AtlasManifest['faceAtlas']

const atlasImages = new Map<string, Promise<HTMLImageElement>>()

function atlasSheetPath(atlas: AtlasSource, sheet: number) {
  const filename = atlas.pattern.replace('{sheet:03}', String(sheet).padStart(3, '0'))
  return assetPath(`${atlas.directory}/${filename}`)
}

function loadAtlasImage(url: string) {
  const cached = atlasImages.get(url)
  if (cached) return cached

  const imagePromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load local atlas image: ${url}`))
    image.src = url
  })
  atlasImages.set(url, imagePromise)
  return imagePromise
}

function imageBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error(`Your browser could not encode ${mimeType} output.`))
    }, mimeType, quality)
  })
}

function renderCat(cat: CatRecord, manifest: AtlasManifest, options: ExportOptions) {
  const atlas = options.artMode === 'faces' ? manifest.faceAtlas : manifest.atlas
  const scale = EXPORT_SCALES[options.size]
  const cell = cat.rescueOrder % atlas.catsPerAtlas
  const sheet = Math.floor(cat.rescueOrder / atlas.catsPerAtlas)
  const column = cell % atlas.columns
  const row = Math.floor(cell / atlas.columns)
  const canvas = document.createElement('canvas')
  canvas.width = atlas.cellWidth * scale
  canvas.height = atlas.cellHeight * scale
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not create an export canvas.')
  context.imageSmoothingEnabled = false

  return loadAtlasImage(atlasSheetPath(atlas, sheet)).then(async (image) => {
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(
      image,
      column * atlas.cellWidth,
      row * atlas.cellHeight,
      atlas.cellWidth,
      atlas.cellHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    )
    const mimeType = options.format === 'png' ? 'image/png' : 'image/webp'
    // Canvas does not expose a portable lossless-WebP switch; quality 1 is the
    // highest-fidelity browser encoding available for the optional WebP path.
    const blob = await imageBlob(canvas, mimeType, options.format === 'webp' ? 1 : undefined)
    const extension = options.format
    const filename = options.artMode === 'faces'
      ? `${cat.rescueOrder}-face.${extension}`
      : `${cat.rescueOrder}.${extension}`
    return { blob, filename }
  })
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function exportSelectedCats(
  cats: CatRecord[],
  manifest: AtlasManifest,
  options: ExportOptions,
) {
  if (cats.length === 0) throw new Error('Select at least one MoonCat to export.')
  if (cats.length > MAX_EXPORT_CATS) {
    throw new Error(`Select ${MAX_EXPORT_CATS} or fewer MoonCats to export.`)
  }

  const files = await Promise.all(cats.map((cat) => renderCat(cat, manifest, options)))
  if (files.length === 1) {
    triggerDownload(files[0].blob, files[0].filename)
    return { kind: 'image' as const, count: 1 }
  }

  const zip = new JSZip()
  for (const file of files) zip.file(file.filename, file.blob)
  const archive = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
  const artLabel = options.artMode === 'faces' ? 'faces' : 'bodies'
  triggerDownload(archive, `catlab-${artLabel}-${files.length}-cats.zip`)
  return { kind: 'zip' as const, count: files.length }
}
