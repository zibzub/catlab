import { assetPath } from './data'
import type { AtlasManifest, CatRecord, GridArtMode } from './types'

export interface ComposePlacedCat {
  id: string
  rescueOrder: number
  artMode: GridArtMode
  x: number
  y: number
  scale: number
  rotation: number
  z: number
}

export interface ComposeBackground {
  url: string
  width: number
  height: number
  name: string
}

export interface ComposeExportOptions {
  placedCats: ComposePlacedCat[]
  cats: CatRecord[]
  manifest: AtlasManifest
  background: ComposeBackground | null
  stageWidth: number
}

const EMPTY_COMPOSITION = { width: 1200, height: 900 }
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
  return promise
}

function loadBackground(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not read the local background image.'))
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
  placedCats,
  cats,
  manifest,
  background,
  stageWidth,
}: ComposeExportOptions) {
  const dimensions = background ?? EMPTY_COMPOSITION
  const canvas = document.createElement('canvas')
  canvas.width = dimensions.width
  canvas.height = dimensions.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not create an export canvas.')

  if (background) {
    const backgroundImage = await loadBackground(background.url)
    context.drawImage(backgroundImage, 0, 0, dimensions.width, dimensions.height)
  }

  context.imageSmoothingEnabled = false
  const outputScale = dimensions.width / Math.max(1, stageWidth)
  const catsByOrder = new Map(cats.map((cat) => [cat.rescueOrder, cat]))
  const ordered = [...placedCats].sort((a, b) => a.z - b.z)

  for (const placed of ordered) {
    const cat = catsByOrder.get(placed.rescueOrder)
    if (!cat) continue
    const atlas = placed.artMode === 'faces' ? manifest.faceAtlas : manifest.atlas
    const cell = cat.rescueOrder % atlas.catsPerAtlas
    const sheet = Math.floor(cat.rescueOrder / atlas.catsPerAtlas)
    const column = cell % atlas.columns
    const row = Math.floor(cell / atlas.columns)
    const image = await loadImage(atlasSheetPath(atlas, sheet))
    const width = atlas.cellWidth * COMPOSE_ART_SCALE[placed.artMode] * outputScale * placed.scale
    const height = atlas.cellHeight * COMPOSE_ART_SCALE[placed.artMode] * outputScale * placed.scale

    context.save()
    context.translate(placed.x * dimensions.width, placed.y * dimensions.height)
    context.rotate((placed.rotation * Math.PI) / 180)
    context.drawImage(
      image,
      column * atlas.cellWidth,
      row * atlas.cellHeight,
      atlas.cellWidth,
      atlas.cellHeight,
      -width / 2,
      -height / 2,
      width,
      height,
    )
    context.restore()
  }

  return imageBlob(canvas)
}
