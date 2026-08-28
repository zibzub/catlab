export interface AlphaBounds {
  x: number
  y: number
  width: number
  height: number
}

interface AlphaBoundsOptions {
  image: HTMLImageElement
  cacheKey: string
  sourceX: number
  sourceY: number
  width: number
  height: number
  padding?: number
}

const DEFAULT_ALPHA_PADDING = 0
const alphaBoundsCache = new Map<string, AlphaBounds>()
const isolatedSpriteCache = new Map<string, HTMLCanvasElement>()

function fullCellBounds(width: number, height: number): AlphaBounds {
  return { x: 0, y: 0, width, height }
}

export function getAlphaBounds({
  image,
  cacheKey,
  sourceX,
  sourceY,
  width,
  height,
  padding = DEFAULT_ALPHA_PADDING,
}: AlphaBoundsOptions): AlphaBounds {
  const key = `${cacheKey}:${sourceX}:${sourceY}:${width}:${height}:${padding}`
  const cached = alphaBoundsCache.get(key)
  if (cached) return cached

  const fallback = fullCellBounds(width, height)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      alphaBoundsCache.set(key, fallback)
      return fallback
    }

    context.clearRect(0, 0, width, height)
    context.drawImage(image, sourceX, sourceY, width, height, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height).data
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (pixels[(y * width + x) * 4 + 3] === 0) continue
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }

    if (maxX < minX || maxY < minY) {
      alphaBoundsCache.set(key, fallback)
      return fallback
    }

    const safePadding = Math.max(0, Math.floor(padding))
    const left = Math.max(0, minX - safePadding)
    const top = Math.max(0, minY - safePadding)
    const right = Math.min(width, maxX + 1 + safePadding)
    const bottom = Math.min(height, maxY + 1 + safePadding)
    const bounds = { x: left, y: top, width: right - left, height: bottom - top }
    alphaBoundsCache.set(key, bounds)
    return bounds
  } catch {
    alphaBoundsCache.set(key, fallback)
    return fallback
  }
}

interface IsolatedSpriteOptions {
  image: HTMLImageElement
  cacheKey: string
  sourceX: number
  sourceY: number
  bounds: AlphaBounds
}

export function getIsolatedSprite({
  image,
  cacheKey,
  sourceX,
  sourceY,
  bounds,
}: IsolatedSpriteOptions): HTMLCanvasElement | null {
  const key = `${cacheKey}:${sourceX}:${sourceY}:${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`
  const cached = isolatedSpriteCache.get(key)
  if (cached) return cached

  try {
    const canvas = document.createElement('canvas')
    canvas.width = bounds.width
    canvas.height = bounds.height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, bounds.width, bounds.height)
    context.drawImage(
      image,
      sourceX + bounds.x,
      sourceY + bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height,
    )
    isolatedSpriteCache.set(key, canvas)
    return canvas
  } catch {
    return null
  }
}
