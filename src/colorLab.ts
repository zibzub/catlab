import type { CatRecord } from './types'

export interface RgbColor {
  r: number
  g: number
  b: number
}

export interface HslColor {
  h: number
  s: number
  l: number
}

export type MoonCatColorKind = 'normal' | 'pale' | 'black' | 'white' | 'unknown'

export interface MoonCatColorDetection {
  kind: MoonCatColorKind
  hueInt: number | null
  pale: boolean | null
}

export interface MoonCatPixelSample {
  rgb: RgbColor
  alpha: number
}

export interface CanvasColorSample extends MoonCatPixelSample {
  hex: string
}

export interface ColorLabSample extends MoonCatPixelSample {
  hex: string
  hue: number
  detection: MoonCatColorDetection
}

export interface MoonCatColorMatch {
  hueInt: number
  pale: boolean | null
  kind: Exclude<MoonCatColorKind, 'unknown'>
}

export interface PreparedColorLabImage {
  width: number
  height: number
  scale: number
}

export const MIN_SAMPLE_ALPHA = 240
export const MAX_COLORLAB_CANVAS_SIZE = 1600
export const GENESIS_DARK_MIN_CHANNEL = 10
export const GENESIS_DARK_MAX_CHANNEL = 24
export const GENESIS_DARK_MAX_SPREAD = 4
export const GENESIS_LIGHT_MIN_CHANNEL = 240
export const GENESIS_LIGHT_MAX_SPREAD = 8

export const MOONCAT_COAT_HUE_TARGETS = [
  { hue: 0, label: 'Red' },
  { hue: 30, label: 'Orange' },
  { hue: 60, label: 'Yellow' },
  { hue: 90, label: 'Chartreuse' },
  { hue: 120, label: 'Green' },
  { hue: 150, label: 'Teal' },
  { hue: 180, label: 'Cyan' },
  { hue: 210, label: 'Sky Blue' },
  { hue: 240, label: 'Blue' },
  { hue: 270, label: 'Purple' },
  { hue: 300, label: 'Magenta' },
  { hue: 330, label: 'Fuchsia' },
] as const

function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(255, Math.round(value)))
}

function normalizeHue(hue: number): number {
  return ((Math.floor(hue) % 360) + 360) % 360
}

function normalizeRoundedHue(hue: number): number {
  return ((Math.round(hue) % 360) + 360) % 360
}

function circularHueDistance(a: number, b: number): number {
  const distance = Math.abs(normalizeHue(a) - normalizeHue(b))
  return Math.min(distance, 360 - distance)
}

export function isGenesisDarkSample(r: number, g: number, b: number): boolean {
  const channels = [clampChannel(r), clampChannel(g), clampChannel(b)]
  const min = Math.min(...channels)
  const max = Math.max(...channels)
  return min >= GENESIS_DARK_MIN_CHANNEL && max <= GENESIS_DARK_MAX_CHANNEL && max - min <= GENESIS_DARK_MAX_SPREAD
}

export function isGenesisLightSample(r: number, g: number, b: number): boolean {
  const channels = [clampChannel(r), clampChannel(g), clampChannel(b)]
  const min = Math.min(...channels)
  const max = Math.max(...channels)
  return min >= GENESIS_LIGHT_MIN_CHANNEL && max - min <= GENESIS_LIGHT_MAX_SPREAD
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  return [r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
    .padStart(6, '0')
    .replace(/^/, '#')
}

export function rgbToHsl({ r, g, b }: RgbColor): HslColor {
  const red = clampChannel(r) / 255
  const green = clampChannel(g) / 255
  const blue = clampChannel(b) / 255

  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

  if (delta === 0) return { h: 0, s, l }

  let hue: number
  if (max === red) {
    hue = 60 * (((green - blue) / delta) % 6)
  } else if (max === green) {
    hue = 60 * ((blue - red) / delta + 2)
  } else {
    hue = 60 * ((red - green) / delta + 4)
  }

  if (hue < 0) hue += 360
  return { h: hue, s, l }
}

export function rgbToHue(color: RgbColor): number {
  return normalizeHue(rgbToHsl(color).h)
}

export function detectMoonCatColorFromRgb(color: RgbColor): MoonCatColorDetection {
  const { h, s } = rgbToHsl(color)
  const channels = [clampChannel(color.r), clampChannel(color.g), clampChannel(color.b)]
  const min = Math.min(...channels)
  const max = Math.max(...channels)
  const range = max - min
  const isNearlyNeutral = range <= 8 || s < 0.06

  if (isGenesisDarkSample(color.r, color.g, color.b)) return { kind: 'black', hueInt: 1000, pale: false }
  if (isGenesisLightSample(color.r, color.g, color.b)) return { kind: 'white', hueInt: 2000, pale: true }

  if (isNearlyNeutral) {
    return { kind: 'unknown', hueInt: null, pale: null }
  }

  if (s < 0.18) return { kind: 'unknown', hueInt: null, pale: null }

  if (max < 140) return { kind: 'unknown', hueInt: normalizeRoundedHue(h), pale: null }

  // Pale MoonCats invert the parser palette: the light base coat is hue - 40,
  // while the light pattern color still uses the canonical hue.
  if (min >= 120 && max >= 180) return { kind: 'pale', hueInt: normalizeRoundedHue(h + 40), pale: true }
  if (min >= 95 && max >= 210) return { kind: 'pale', hueInt: normalizeRoundedHue(h), pale: true }
  if (min < 120) return { kind: 'normal', hueInt: rgbToHue(color), pale: false }
  return { kind: 'unknown', hueInt: rgbToHue(color), pale: null }
}

export function samplePixel(ctx: CanvasRenderingContext2D, x: number, y: number): MoonCatPixelSample {
  const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data
  return {
    rgb: {
      r: pixel[0] ?? 0,
      g: pixel[1] ?? 0,
      b: pixel[2] ?? 0,
    },
    alpha: pixel[3] ?? 0,
  }
}

export function sampleCanvasColor(ctx: CanvasRenderingContext2D, x: number, y: number): CanvasColorSample {
  const pixelSample = samplePixel(ctx, x, y)
  return {
    ...pixelSample,
    hex: rgbToHex(pixelSample.rgb),
  }
}

export function createColorLabSample(pixelSample: MoonCatPixelSample): ColorLabSample {
  return {
    ...pixelSample,
    hex: rgbToHex(pixelSample.rgb),
    hue: rgbToHue(pixelSample.rgb),
    detection: detectMoonCatColorFromRgb(pixelSample.rgb),
  }
}

export function isUsableColorLabSample(sample: ColorLabSample): boolean {
  return sample.alpha >= MIN_SAMPLE_ALPHA && sample.detection.kind !== 'unknown'
}

export function findValidNearbySample(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  x: number,
  y: number,
): ColorLabSample | null {
  const validSamples = new Map<string, { sample: ColorLabSample; count: number; firstIndex: number }>()
  let sampleIndex = 0

  for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
    for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
      if (xOffset === 0 && yOffset === 0) continue
      const sampleX = x + xOffset
      const sampleY = y + yOffset
      if (sampleX < 0 || sampleY < 0 || sampleX >= width || sampleY >= height) continue

      const nearbySample = createColorLabSample(samplePixel(ctx, sampleX, sampleY))
      if (!isUsableColorLabSample(nearbySample)) continue

      const key = `${nearbySample.rgb.r},${nearbySample.rgb.g},${nearbySample.rgb.b}`
      const existingSample = validSamples.get(key)
      if (existingSample) {
        existingSample.count += 1
      } else {
        validSamples.set(key, { sample: nearbySample, count: 1, firstIndex: sampleIndex })
      }
      sampleIndex += 1
    }
  }

  return Array.from(validSamples.values())
    .sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex)[0]?.sample ?? null
}

export function getClosestMoonCatCoatHueLabel(detection: MoonCatColorDetection, sampledHue: number): string {
  if (detection.kind === 'black') return 'Genesis Black'
  if (detection.kind === 'white') return 'Genesis White'

  const targetHue = detection.hueInt ?? sampledHue
  return MOONCAT_COAT_HUE_TARGETS.reduce((closest, target) => (
    circularHueDistance(targetHue, target.hue) < circularHueDistance(targetHue, closest.hue) ? target : closest
  )).label
}

export function getMoonCatColorMatch(sample: ColorLabSample): MoonCatColorMatch | null {
  const { kind, hueInt, pale } = sample.detection
  if (kind === 'unknown' || hueInt === null) return null
  return { kind, hueInt, pale }
}

export function matchesMoonCatColor(cat: CatRecord, match: MoonCatColorMatch): boolean {
  return cat.hueInt === match.hueInt && (match.pale === null || cat.pale === match.pale)
}

export function findMoonCatsByExactHue(
  moonCats: CatRecord[],
  sampledHue: number,
  pale?: boolean | null,
): CatRecord[] {
  return moonCats
    .filter((moonCat) => Number.isFinite(moonCat.hueInt))
    .filter((moonCat) => pale == null || moonCat.pale === pale)
    .filter((moonCat) => moonCat.hueInt === sampledHue)
    .sort((a, b) => a.rescueOrder - b.rescueOrder)
}

export function loadColorLabImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load the ColorLab image.'))
    image.src = src
  })
}

export function drawColorLabImage(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  maxSize = MAX_COLORLAB_CANVAS_SIZE,
): PreparedColorLabImage {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  if (sourceWidth <= 0 || sourceHeight <= 0) throw new Error('The ColorLab image has no readable dimensions.')

  const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight))
  canvas.width = Math.max(1, Math.round(sourceWidth * scale))
  canvas.height = Math.max(1, Math.round(sourceHeight * scale))

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not prepare the ColorLab image canvas.')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = false
  ctx.imageSmoothingQuality = 'low'
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  return { width: canvas.width, height: canvas.height, scale }
}
