import { matchesFilters, type FilterIndex } from '../components/collectionFilters'
import type { CatRecord, FilterState } from '../types'

export interface MoonCatIndexResultOptions {
  cats: CatRecord[]
  filterIndex: FilterIndex
  filters: FilterState
  colorMatchingOrders: ReadonlySet<number> | null
  ownedOrders: ReadonlySet<number> | null
}

function sortNamed(cats: CatRecord[], direction: 'asc' | 'desc') {
  return [...cats].sort((first, second) => {
    if (first.nameTimestamp === null && second.nameTimestamp !== null) return 1
    if (first.nameTimestamp !== null && second.nameTimestamp === null) return -1
    if (first.nameTimestamp !== null && second.nameTimestamp !== null && first.nameTimestamp !== second.nameTimestamp) {
      return (second.nameTimestamp - first.nameTimestamp) * (direction === 'desc' ? 1 : -1)
    }
    return first.rescueOrder - second.rescueOrder
  })
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
  if (filters.naming === 'recentlyNamed') return sortNamed(matchingCats, 'desc')
  if (filters.naming === 'firstNamed') return sortNamed(matchingCats, 'asc')
  return matchingCats
}
