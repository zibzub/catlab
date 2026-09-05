import { matchesFilters, type FilterIndex } from './filters'
import { compareFirstNamed, compareRecentlyNamed } from './sorts'
import type { CatRecord, FilterState } from '../types'

export interface MoonCatIndexResultOptions {
  cats: CatRecord[]
  filterIndex: FilterIndex
  filters: FilterState
  colorMatchingOrders: ReadonlySet<number> | null
  ownedOrders: ReadonlySet<number> | null
}

export function deriveMoonCatIndexResult({
  cats,
  filterIndex,
  filters,
  colorMatchingOrders,
  ownedOrders,
}: MoonCatIndexResultOptions): CatRecord[] {
  const matchingCats = cats.filter((cat) => (
    matchesFilters(cat, filters, filterIndex)
    && (colorMatchingOrders === null || colorMatchingOrders.has(cat.rescueOrder))
    && (ownedOrders === null || ownedOrders.has(cat.rescueOrder))
  ))
  if (filters.naming === 'recentlyNamed') return [...matchingCats].sort(compareRecentlyNamed)
  if (filters.naming === 'firstNamed') return [...matchingCats].sort(compareFirstNamed)
  return matchingCats
}
