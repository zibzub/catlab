import type { CatRecord } from '../types'

export type NamedSortDirection = 'asc' | 'desc'

/**
 * Compares named records chronologically while keeping missing timestamps last
 * and rescue order as the deterministic tie-break.
 */
export function compareNamedCats(
  first: CatRecord,
  second: CatRecord,
  direction: NamedSortDirection,
) {
  if (first.nameTimestamp === null && second.nameTimestamp !== null) return 1
  if (first.nameTimestamp !== null && second.nameTimestamp === null) return -1
  if (first.nameTimestamp !== null && second.nameTimestamp !== null && first.nameTimestamp !== second.nameTimestamp) {
    return (second.nameTimestamp - first.nameTimestamp) * (direction === 'desc' ? 1 : -1)
  }
  return first.rescueOrder - second.rescueOrder
}

export function compareRecentlyNamed(first: CatRecord, second: CatRecord) {
  return compareNamedCats(first, second, 'desc')
}

export function compareFirstNamed(first: CatRecord, second: CatRecord) {
  return compareNamedCats(first, second, 'asc')
}
