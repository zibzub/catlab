import { assetPath } from './data'
import { getMoonCatAtlasCell } from './mooncat-index/atlas'
import { isDay1RescueOrder, isDay2RescueOrder, isValidRescueOrder } from './mooncat-index/domain'
import type { AtlasManifest, CatRecord } from './types'

export const CHARACTER_CLASSIFICATION_KEYS = [
  'garfield',
  'cheshire',
  'pinkpanther',
  'alien',
  'zombie',
  'simba',
  'golden',
  'pikachu',
] as const

export const CLASSIFICATION_CATEGORY_KEYS = [
  'sub100',
  'day1',
  'week1',
  'earlyRescues',
  ...CHARACTER_CLASSIFICATION_KEYS,
] as const

export interface MoonCatClassificationCategory {
  label: string
  group: string
  ids: number[]
}

export interface MoonCatClassifications {
  schemaVersion: number
  count: number
  maxId: number
  categories: Record<string, MoonCatClassificationCategory>
}

export interface MoonCatNameRecord {
  name: string
  timestamp: number | null
}

export type MoonCatNames = Record<string, MoonCatNameRecord>

export type GenesisCoat = 'black' | 'white'

let namesPromise: Promise<MoonCatNames> | null = null
let classificationsPromise: Promise<MoonCatClassifications> | null = null

export function validateMoonCatNames(value: unknown): MoonCatNames | null {
  if (!isObject(value)) return null
  const names: MoonCatNames = {}
  for (const [id, entry] of Object.entries(value)) {
    if (!/^\d+$/.test(id)) return null
    const rescueOrder = Number(id)
    if (String(rescueOrder) !== id || !isValidRescueOrder(rescueOrder) || !isObject(entry)) return null
    if (typeof entry.name !== 'string' || entry.name.length === 0) return null
    if (entry.timestamp !== null && (typeof entry.timestamp !== 'number' || !Number.isFinite(entry.timestamp) || entry.timestamp < 0)) return null
    names[id] = { name: entry.name, timestamp: entry.timestamp }
  }
  return names
}

export function getMoonCatName(names: MoonCatNames, rescueOrder: number) {
  return names[String(rescueOrder)]?.name ?? ''
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isValidIdList(value: unknown, maxId: number): value is number[] {
  if (!Array.isArray(value)) return false
  let previous = -1
  return value.every((id) => {
    if (!Number.isInteger(id) || id < 0 || id > maxId || id <= previous) return false
    previous = id
    return true
  })
}

export function validateMoonCatClassifications(value: unknown): MoonCatClassifications | null {
  if (!isObject(value) || value.schemaVersion !== 1) return null
  const count = value.count
  const maxId = value.maxId
  if (typeof count !== 'number' || typeof maxId !== 'number' || !Number.isInteger(count) || !Number.isInteger(maxId) || count <= 0) return null
  if (!isObject(value.categories)) return null

  const categories: Record<string, MoonCatClassificationCategory> = {}
  for (const key of CLASSIFICATION_CATEGORY_KEYS) {
    const category = value.categories[key]
    if (!isObject(category)) return null
    if (typeof category.label !== 'string' || typeof category.group !== 'string') return null
    if (!isValidIdList(category.ids, maxId)) return null
    categories[key] = {
      label: category.label,
      group: category.group,
      ids: category.ids,
    }
  }

  return {
    schemaVersion: value.schemaVersion,
    count,
    maxId,
    categories,
  }
}

export function loadMoonCatNames(fetchImpl: typeof globalThis.fetch = globalThis.fetch) {
  if (!namesPromise) {
    namesPromise = (async () => {
      if (typeof fetchImpl !== 'function') return {}
      try {
        const response = await fetchImpl(assetPath('data/names-timestamp-live.json'))
        if (!response.ok) return {}
        return validateMoonCatNames(await response.json()) ?? {}
      } catch {
        return {}
      }
    })()
  }
  return namesPromise!
}

export function loadMoonCatClassifications(fetchImpl: typeof globalThis.fetch = globalThis.fetch) {
  if (!classificationsPromise) {
    classificationsPromise = (async () => {
      if (typeof fetchImpl !== 'function') throw new Error('Classification loading is unavailable.')
      const response = await fetchImpl(assetPath('data/mooncat-classifications.json'))
      if (!response.ok) throw new Error('Could not load MoonCat classifications.')
      const classifications = validateMoonCatClassifications(await response.json())
      if (!classifications) throw new Error('MoonCat classifications are invalid.')
      return classifications
    })()
  }
  return classificationsPromise
}

export function formatMoonCatTitle(cat: CatRecord, names: MoonCatNames) {
  const name = getMoonCatName(names, cat.rescueOrder)
  return name ? `MoonCat ${cat.rescueOrder} : ${name}` : `MoonCat ${cat.rescueOrder}`
}

export function classifyGenesisDetail(cat: CatRecord): GenesisCoat | null {
  if (!cat.genesis) return null
  const hueName = cat.hueName.trim().toLowerCase()
  if (cat.hueInt === 1000 && hueName === 'black') return 'black'
  if (cat.hueInt === 2000 && hueName === 'white') return 'white'
  return null
}

export function formatMoonCatHue(cat: CatRecord) {
  return classifyGenesisDetail(cat) ? 'genesis' : String(cat.hueInt)
}

export function getMoonCatClassificationLabels(
  cat: CatRecord,
  classifications: MoonCatClassifications | null,
) {
  if (!classifications || cat.rescueOrder < 0 || cat.rescueOrder > classifications.maxId) return []
  const labels: string[] = []
  if (isDay1RescueOrder(cat.rescueOrder)) labels.push('day 1')
  else if (isDay2RescueOrder(cat.rescueOrder)) labels.push('day 2')
  else if (classifications.categories.week1.ids.includes(cat.rescueOrder)) labels.push('week 1')

  if (cat.genesis) {
    labels.push('genesis')
  } else {
    const characterKey = CHARACTER_CLASSIFICATION_KEYS.find((key) => (
      classifications.categories[key].ids.includes(cat.rescueOrder)
    ))
    if (characterKey) labels.push(characterKey)
  }
  return labels
}

export function formatMoonCatClassificationFooter(labels: string[]) {
  return labels
    .map((label) => label.toLowerCase() === 'pinkpanther' ? 'PINK PANTHER' : label.toUpperCase())
    .join(' • ')
}

export function getDetailCardCoat(cat: CatRecord) {
  const genesis = classifyGenesisDetail(cat)
  if (genesis === 'black') return { coat: '#17191f', outline: '#b9c0cb', genesis }
  if (genesis === 'white') return { coat: '#f3eee4', outline: '#4a505b', genesis }

  const sourceHue = ((cat.hueInt % 360) + 360) % 360
  const coatHue = cat.pale ? (sourceHue + 320) % 360 : sourceHue
  return {
    coat: `hsl(${coatHue} 100% ${cat.pale ? 80 : 45}%)`,
    outline: `hsl(${sourceHue} 68% ${cat.pale ? 42 : 38}%)`,
    genesis: null,
  }
}

export function fitSingleLineText(
  element: HTMLElement | null,
  { minFontSize = 12, step = 0.25 }: { minFontSize?: number; step?: number } = {},
) {
  if (!element) return null

  element.style.removeProperty('font-size')
  const computedFontSize = Number.parseFloat(globalThis.getComputedStyle?.(element)?.fontSize ?? '')
  const maxFontSize = Number.isFinite(computedFontSize) ? computedFontSize : minFontSize
  element.style.fontSize = `${maxFontSize}px`

  const availableWidth = element.clientWidth
  if (availableWidth <= 0 || element.scrollWidth <= availableWidth) return maxFontSize

  let fittedFontSize = Math.max(minFontSize, maxFontSize * (availableWidth / element.scrollWidth))
  element.style.fontSize = `${fittedFontSize}px`
  let attempts = 0
  while (element.scrollWidth > element.clientWidth && fittedFontSize > minFontSize && attempts < 64) {
    fittedFontSize = Math.max(minFontSize, fittedFontSize - step)
    element.style.fontSize = `${fittedFontSize}px`
    attempts += 1
  }
  return fittedFontSize
}

export interface DetailAtlasCell {
  url: string
  sheet: number
  x: number
  y: number
  width: number
  height: number
}

export function getDetailAtlasCell(cat: CatRecord, manifest: AtlasManifest): DetailAtlasCell | null {
  if (!Number.isInteger(cat.rescueOrder) || cat.rescueOrder < 0 || cat.rescueOrder >= manifest.count) return null
  const atlasCell = getMoonCatAtlasCell(manifest, cat.rescueOrder, 'bodies')
  return {
    url: atlasCell.assetUrl,
    sheet: atlasCell.sheetIndex,
    x: atlasCell.x,
    y: atlasCell.y,
    width: atlasCell.cellWidth,
    height: atlasCell.cellHeight,
  }
}
