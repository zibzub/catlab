import JSZip from 'jszip'
import { getAlphaBounds } from './composeCatCrop'
import { getMoonCatAtlasCell } from './mooncat-index/atlas'
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

const atlasImages = new Map<string, Promise<HTMLImageElement>>()

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
  void imagePromise.catch(() => {
    if (atlasImages.get(url) === imagePromise) atlasImages.delete(url)
  })
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
  const atlasCell = getMoonCatAtlasCell(manifest, cat.rescueOrder, options.artMode)
  const scale = EXPORT_SCALES[options.size]

  return loadAtlasImage(atlasCell.assetUrl).then(async (image) => {
    const sourceX = atlasCell.x
    const sourceY = atlasCell.y
    const bounds = getAlphaBounds({
      image,
      cacheKey: atlasCell.assetUrl,
      sourceX,
      sourceY,
      width: atlasCell.cellWidth,
      height: atlasCell.cellHeight,
    })
    const canvas = document.createElement('canvas')
    canvas.width = bounds.width * scale
    canvas.height = bounds.height * scale
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not create an export canvas.')
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(
      image,
      sourceX + bounds.x,
      sourceY + bounds.y,
      bounds.width,
      bounds.height,
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
