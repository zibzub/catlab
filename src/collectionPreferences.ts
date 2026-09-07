import { isIdlePattern, isIdleSpeed } from './idleAnimation'
import type { GridSize, GridViewMode, IdlePattern, IdleSpeed, RingStyle } from './types'

export const COLLECTION_DISPLAY_PREFS_KEY = 'catlab.collection-display.v1'
export const COLLECTION_RING_STYLE_MIGRATION = 1

export interface CollectionDisplayPreferences {
  viewMode?: GridViewMode
  gridSize?: GridSize
  ringStyle?: RingStyle
  ringStyleMigration?: number
  showStars?: boolean
  showSky?: boolean
  showVignette?: boolean
  showIndex?: boolean
  showNames?: boolean
  idlePattern?: IdlePattern
  idleSpeed?: IdleSpeed
}

export interface StoredCollectionDisplayPreferences {
  viewMode: GridViewMode
  gridSize: GridSize
  ringStyle: RingStyle
  ringStyleMigration: typeof COLLECTION_RING_STYLE_MIGRATION
  showStars: boolean
  showSky: boolean
  showVignette: boolean
  showIndex: boolean
  showNames: boolean
  idlePattern: IdlePattern
  idleSpeed: IdleSpeed
}

export function parseCollectionDisplayPreferences(raw: string | null): CollectionDisplayPreferences {
  if (!raw) return { ringStyle: 'dynamic', ringStyleMigration: COLLECTION_RING_STYLE_MIGRATION }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ringStyle: 'dynamic', ringStyleMigration: COLLECTION_RING_STYLE_MIGRATION }
    }
    const values = parsed as Record<string, unknown>
    const migratedIdlePattern = values.idlePattern === 'snake' ? 'worm' : values.idlePattern
    const parsedRingStyle =
      values.ringStyle === 'off' ||
      values.ringStyle === 'ac' ||
      values.ringStyle === 'outline' ||
      values.ringStyle === 'dynamic'
        ? values.ringStyle
        : typeof values.showRings === 'boolean'
          ? values.showRings
            ? 'outline'
            : 'off'
          : undefined
    const ringStyle =
      values.ringStyleMigration === COLLECTION_RING_STYLE_MIGRATION ? (parsedRingStyle ?? 'dynamic') : 'dynamic'
    const showStars = typeof values.showStars === 'boolean' ? values.showStars : undefined
    const showSky = typeof values.showSky === 'boolean' ? values.showSky : undefined
    return {
      viewMode:
        values.viewMode === 'compact' || values.viewMode === 'detailed' || values.viewMode === 'list'
          ? values.viewMode
          : undefined,
      gridSize:
        values.gridSize === 'small' || values.gridSize === 'medium' || values.gridSize === 'large'
          ? values.gridSize
          : undefined,
      ringStyle,
      ringStyleMigration: COLLECTION_RING_STYLE_MIGRATION,
      showStars,
      showSky: showStars === true ? false : showSky,
      showVignette: typeof values.showVignette === 'boolean' ? values.showVignette : undefined,
      showIndex: typeof values.showIndex === 'boolean' ? values.showIndex : undefined,
      showNames: typeof values.showNames === 'boolean' ? values.showNames : undefined,
      idlePattern: isIdlePattern(migratedIdlePattern) ? migratedIdlePattern : undefined,
      idleSpeed: isIdleSpeed(values.idleSpeed) ? values.idleSpeed : undefined,
    }
  } catch {
    return { ringStyle: 'dynamic', ringStyleMigration: COLLECTION_RING_STYLE_MIGRATION }
  }
}

export function loadCollectionDisplayPreferences(): CollectionDisplayPreferences {
  if (typeof window === 'undefined') return {}
  try {
    return parseCollectionDisplayPreferences(window.localStorage.getItem(COLLECTION_DISPLAY_PREFS_KEY))
  } catch {
    return {}
  }
}

export function serializeCollectionDisplayPreferences(values: StoredCollectionDisplayPreferences) {
  return JSON.stringify(values)
}

export function effectiveCollectionVignette(showVignette: boolean, showSky: boolean) {
  return showVignette && !showSky
}
