import { assetPath } from './data'
import { getAlphaBounds, getIsolatedSprite } from './composeCatCrop'
import type { AtlasManifest, CatRecord, GridArtMode } from './types'

interface ComposePlacedTransform {
  id: string
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  flipX: boolean
  flipY: boolean
  z: number
}

export interface ComposePlacedCat extends ComposePlacedTransform {
  kind: 'cat'
  rescueOrder: number
  artMode: GridArtMode
}

export interface ComposePlacedText extends ComposePlacedTransform {
  kind: 'text'
  text: string
  fill: string
  stroke: string
  strokeWidth: number
  fontSize: number
  fontFamily: string
}

export interface ComposePlacedRect extends ComposePlacedTransform {
  kind: 'rect'
  width: number
  height: number
  fill: string
}

export type ComposePlacedObject = ComposePlacedCat | ComposePlacedText | ComposePlacedRect

export interface ComposeBackground {
  url: string
  width: number
  height: number
  name: string
}

export interface ComposeExportOptions {
  placedObjects: ComposePlacedObject[]
  catalogCats: CatRecord[]
  manifest: AtlasManifest
  background: ComposeBackground | null
  stageWidth: number
}

const EMPTY_COMPOSITION = { width: 1200, height: 900 }
const MAX_COMPOSE_EXPORT_PIXELS = 64_000_000 // Keep normal high-resolution exports below 64 megapixels.
const COMPOSE_ART_SCALE: Record<GridArtMode, number> = {
  bodies: 3,
  faces: 4,
}

const atlasImages = new Map<string, Promise<HTMLImageElement>>()

function atlasSheetPath(atlas: AtlasManifest['atlas'] | AtlasManifest['faceAtlas'], sheet: number) {
  const filename = atlas.pattern.replace('{sheet:03}', String(sheet).padStart(3, '0'))
  return assetPath(`${atlas.directory}/${filename}`)
}

function loadImage(url: string) {
  const cached = atlasImages.get(url)
  if (cached) return cached

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load local atlas image: ${url}`))
    image.src = url
  })
  atlasImages.set(url, promise)
  void promise.catch(() => {
    if (atlasImages.get(url) === promise) atlasImages.delete(url)
  })
  return promise
}

export function loadComposeBackground(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    const cleanup = () => {
      image.onload = null
      image.onerror = null
    }
    image.onload = () => {
      if (typeof image.decode !== 'function') {
        cleanup()
        resolve(image)
        return
      }
      image.decode()
        .then(() => {
          cleanup()
          resolve(image)
        })
        .catch(() => {
          cleanup()
          reject(new Error('Could not read the local background image.'))
        })
    }
    image.onerror = () => {
      cleanup()
      reject(new Error('Could not read the local background image.'))
    }
    image.src = url
  })
}

function imageBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Your browser could not encode the composition PNG.'))
    }, 'image/png')
  })
}

export async function renderComposition({
  placedObjects,
  catalogCats,
  manifest,
  background,
  stageWidth,
}: ComposeExportOptions) {
  const dimensions = background ?? EMPTY_COMPOSITION
  const pixelArea = dimensions.height > 0 && dimensions.width > MAX_COMPOSE_EXPORT_PIXELS / dimensions.height
    ? Infinity
    : dimensions.width * dimensions.height
  if (!Number.isFinite(pixelArea) || pixelArea > MAX_COMPOSE_EXPORT_PIXELS) {
    throw new Error('The composition is too large to export as PNG.')
  }

  await document.fonts.ready
  const textFonts = [...new Set(
    placedObjects
      .filter((placed): placed is Extract<ComposePlacedObject, { kind: 'text' }> => placed.kind === 'text')
      .map((placed) => placed.fontFamily),
  )]
  await Promise.all(textFonts.map((fontFamily) => document.fonts.load(`16px ${fontFamily}`)))

  const canvas = document.createElement('canvas')
  canvas.width = dimensions.width
  canvas.height = dimensions.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not create an export canvas.')

  if (background) {
    const backgroundImage = await loadComposeBackground(background.url)
    context.drawImage(backgroundImage, 0, 0, dimensions.width, dimensions.height)
  }

  context.imageSmoothingEnabled = false
  const outputScale = dimensions.width / Math.max(1, stageWidth)
  const catsByOrder = new Map(catalogCats.map((cat) => [cat.rescueOrder, cat]))
  const ordered = [...placedObjects].sort((a, b) => a.z - b.z)

  for (const placed of ordered) {
    context.save()
    context.globalAlpha = Math.min(1, Math.max(0, placed.opacity))
    context.translate(placed.x * dimensions.width, placed.y * dimensions.height)
    context.rotate((placed.rotation * Math.PI) / 180)
    if (placed.kind === 'cat') {
      const cat = catsByOrder.get(placed.rescueOrder)
      if (!cat) {
        context.restore()
        continue
      }
      const atlas = placed.artMode === 'faces' ? manifest.faceAtlas : manifest.atlas
      const cell = cat.rescueOrder % atlas.catsPerAtlas
      const sheet = Math.floor(cat.rescueOrder / atlas.catsPerAtlas)
      const column = cell % atlas.columns
      const row = Math.floor(cell / atlas.columns)
      const image = await loadImage(atlasSheetPath(atlas, sheet))
      const sourceX = column * atlas.cellWidth
      const sourceY = row * atlas.cellHeight
      const bounds = getAlphaBounds({
        image,
        cacheKey: atlasSheetPath(atlas, sheet),
        sourceX,
        sourceY,
        width: atlas.cellWidth,
        height: atlas.cellHeight,
      })
      const catScale = COMPOSE_ART_SCALE[placed.artMode] * outputScale * placed.scale
      const width = bounds.width * catScale
      const height = bounds.height * catScale
      const offsetX = (bounds.x + bounds.width / 2 - atlas.cellWidth / 2) * catScale
      const offsetY = (bounds.y + bounds.height / 2 - atlas.cellHeight / 2) * catScale

      context.scale(placed.flipX ? -1 : 1, placed.flipY ? -1 : 1)
      const isolatedSprite = getIsolatedSprite({
        image,
        cacheKey: atlasSheetPath(atlas, sheet),
        sourceX,
        sourceY,
        bounds,
      })
      if (isolatedSprite) {
        context.drawImage(isolatedSprite, offsetX - width / 2, offsetY - height / 2, width, height)
      } else {
        context.drawImage(
          image,
          sourceX + bounds.x,
          sourceY + bounds.y,
          bounds.width,
          bounds.height,
          offsetX - width / 2,
          offsetY - height / 2,
          width,
          height,
        )
      }
    } else if (placed.kind === 'rect') {
      const width = placed.width * dimensions.width * placed.scale
      const height = placed.height * dimensions.height * placed.scale
      context.scale(placed.flipX ? -1 : 1, placed.flipY ? -1 : 1)
      context.fillStyle = placed.fill
      context.fillRect(-width / 2, -height / 2, width, height)
    } else {
      context.scale(
        (placed.flipX ? -1 : 1) * placed.scale * outputScale,
        (placed.flipY ? -1 : 1) * placed.scale * outputScale,
      )
      context.font = `${placed.fontSize}px ${placed.fontFamily}`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.lineJoin = 'round'
      context.lineWidth = placed.strokeWidth
      context.fillStyle = placed.fill
      context.strokeStyle = placed.stroke
      const lines = placed.text.split('\n')
      const lineHeight = placed.fontSize * 1.1
      const firstLineY = -((lines.length - 1) * lineHeight) / 2
      lines.forEach((line, index) => {
        const y = firstLineY + index * lineHeight
        if (placed.strokeWidth > 0) context.strokeText(line, 0, y)
        context.fillText(line, 0, y)
      })
    }
    context.restore()
  }

  return imageBlob(canvas)
}
