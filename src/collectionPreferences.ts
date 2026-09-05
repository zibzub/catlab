import { isIdlePattern, isIdleSpeed } from './idleAnimation'
import type {
  GridSize,
  GridViewMode,
  IdlePattern,
  IdleSpeed,
  RingStyle,
} from './types'

export const COLLECTION_DISPLAY_PREFS_KEY = 'catlab.collection-display.v1'

export interface CollectionDisplayPreferences {
  viewMode?: GridViewMode
  gridSize?: GridSize
  ringStyle?: RingStyle
  showStars?: boolean
  showVignette?: boolean
  idlePattern?: IdlePattern
  idleSpeed?: IdleSpeed
}

export interface StoredCollectionDisplayPreferences {
  viewMode: GridViewMode
  gridSize: GridSize
  ringStyle: RingStyle
  showStars: boolean
  showVignette: boolean
  idlePattern: IdlePattern
  idleSpeed: IdleSpeed
}

export function parseCollectionDisplayPreferences(raw: string | null): CollectionDisplayPreferences {
  if (!raw) return {}

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const values = parsed as Record<string, unknown>
    const migratedIdlePattern = values.idlePattern === 'snake' ? 'worm' : values.idlePattern
    const ringStyle = values.ringStyle === 'off' || values.ringStyle === 'ac' || values.ringStyle === 'outline'
      ? values.ringStyle
      : typeof values.showRings === 'boolean'
        ? values.showRings ? 'outline' : 'off'
        : undefined
    return {
      viewMode: values.viewMode === 'compact' || values.viewMode === 'detailed' || values.viewMode === 'list'
        ? values.viewMode
        : undefined,
      gridSize: values.gridSize === 'small' || values.gridSize === 'medium' || values.gridSize === 'large'
        ? values.gridSize
        : undefined,
      ringStyle,
      showStars: typeof values.showStars === 'boolean' ? values.showStars : undefined,
      showVignette: typeof values.showVignette === 'boolean' ? values.showVignette : undefined,
      idlePattern: isIdlePattern(migratedIdlePattern) ? migratedIdlePattern : undefined,
      idleSpeed: isIdleSpeed(values.idleSpeed) ? values.idleSpeed : undefined,
    }
  } catch {
    return {}
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
