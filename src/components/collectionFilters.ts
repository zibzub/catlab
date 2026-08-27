import {
  CHARACTER_CLASSIFICATION_KEYS,
  type MoonCatClassifications,
  type MoonCatNames,
} from '../mooncatDetails'
import type { CatRecord, FilterState } from '../types'

export const CLASSIFICATION_FILTER_OPTIONS = [
  { value: 'genesis', label: 'Genesis' },
  { value: 'day1', label: 'Day 1' },
  { value: 'day2', label: 'Day 2' },
  { value: 'week1', label: 'Week 1' },
  { value: 'earlyRescues', label: 'Early Rescues' },
  { value: 'sub100', label: 'Sub-100' },
  { value: 'garfield', label: 'Garfield' },
  { value: 'cheshire', label: 'Cheshire' },
  { value: 'pinkpanther', label: 'Pink Panther' },
  { value: 'alien', label: 'Alien' },
  { value: 'zombie', label: 'Zombie' },
  { value: 'simba', label: 'Simba' },
  { value: 'golden', label: 'Golden' },
  { value: 'pikachu', label: 'Pikachu' },
] as const

export type ClassificationFilterKey = (typeof CLASSIFICATION_FILTER_OPTIONS)[number]['value']

export type RemovableFilterKey =
  | 'classifications'
  | 'rescueYears'
  | 'hueNames'
  | 'pale'
  | 'patterns'
  | 'poses'
  | 'expressions'
  | 'facings'
  | 'naming'

export interface FilterCounts {
  classifications: Record<string, number>
  rescueYears: Record<string, number>
  hueNames: Record<string, number>
  patterns: Record<string, number>
  poses: Record<string, number>
  expressions: Record<string, number>
  facings: Record<string, number>
  pale: {
    pale: number
    normal: number
  }
  naming: {
    named: number
    unnamed: number
  }
}

export interface FilterIndex {
  totalCount: number
  classificationSets: Record<string, Set<number>>
  namedOrders: Set<number>
  counts: FilterCounts
  options: {
    rescueYears: number[]
    hueNames: string[]
    patterns: string[]
    poses: string[]
    expressions: string[]
    facings: string[]
  }
}

export interface ActiveFilterChip {
  key: RemovableFilterKey
  value: string | number
  label: string
}

const EMPTY_COUNT_MAP = () => ({}) as Record<string, number>

function increment(counts: Record<string, number>, value: string) {
  counts[value] = (counts[value] ?? 0) + 1
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase())
}

export function createEmptyFilterState(): FilterState {
  return {
    query: '',
    classifications: [],
    rescueYears: [],
    hueNames: [],
    pale: 'all',
    patterns: [],
    poses: [],
    expressions: [],
    facings: [],
    naming: 'all',
  }
}

export function cloneFilterState(filters: FilterState): FilterState {
  return {
    ...filters,
    classifications: [...filters.classifications],
    rescueYears: [...filters.rescueYears],
    hueNames: [...filters.hueNames],
    patterns: [...filters.patterns],
    poses: [...filters.poses],
    expressions: [...filters.expressions],
    facings: [...filters.facings],
  }
}

export function buildFilterIndex(
  cats: CatRecord[],
  names: MoonCatNames,
  classifications: MoonCatClassifications | null,
): FilterIndex {
  // Option counts are intentionally stable catalog totals. The active result count
  // remains live, while these totals avoid rebuilding every option against every
  // combination of draft filters while the drawer is open.
  const classificationSets: Record<string, Set<number>> = Object.fromEntries(
    CLASSIFICATION_FILTER_OPTIONS.map(({ value }) => [value, new Set<number>()]),
  )
  const counts: FilterCounts = {
    classifications: EMPTY_COUNT_MAP(),
    rescueYears: EMPTY_COUNT_MAP(),
    hueNames: EMPTY_COUNT_MAP(),
    patterns: EMPTY_COUNT_MAP(),
    poses: EMPTY_COUNT_MAP(),
    expressions: EMPTY_COUNT_MAP(),
    facings: EMPTY_COUNT_MAP(),
    pale: { pale: 0, normal: 0 },
    naming: { named: 0, unnamed: 0 },
  }
  const namedOrders = new Set<number>()

  for (const cat of cats) {
    if (cat.genesis) classificationSets.genesis.add(cat.rescueOrder)
    if (cat.rescueOrder < 100) classificationSets.sub100.add(cat.rescueOrder)
    if (cat.rescueOrder <= 491) classificationSets.day1.add(cat.rescueOrder)
    else if (cat.rescueOrder <= 903) classificationSets.day2.add(cat.rescueOrder)

    increment(counts.rescueYears, String(cat.rescueYear))
    increment(counts.hueNames, cat.hueName)
    increment(counts.patterns, cat.pattern)
    increment(counts.poses, cat.pose)
    increment(counts.expressions, cat.expression)
    increment(counts.facings, cat.facing)
    if (cat.pale) counts.pale.pale += 1
    else counts.pale.normal += 1
    if (names[String(cat.rescueOrder)]) {
      namedOrders.add(cat.rescueOrder)
      counts.naming.named += 1
    } else {
      counts.naming.unnamed += 1
    }
  }

  for (const key of ['week1', 'earlyRescues', ...CHARACTER_CLASSIFICATION_KEYS]) {
    const ids = classifications?.categories[key]?.ids ?? []
    classificationSets[key] = new Set(ids)
  }
  for (const { value } of CLASSIFICATION_FILTER_OPTIONS) {
    counts.classifications[value] = classificationSets[value].size
  }

  return {
    totalCount: cats.length,
    classificationSets,
    namedOrders,
    counts,
    options: {
      rescueYears: Object.keys(counts.rescueYears).map(Number).sort((a, b) => a - b),
      hueNames: Object.keys(counts.hueNames).sort((a, b) => a.localeCompare(b)),
      patterns: Object.keys(counts.patterns).sort((a, b) => a.localeCompare(b)),
      poses: Object.keys(counts.poses).sort((a, b) => a.localeCompare(b)),
      expressions: Object.keys(counts.expressions).sort((a, b) => a.localeCompare(b)),
      facings: Object.keys(counts.facings).sort((a, b) => a.localeCompare(b)),
    },
  }
}

function matchesAny<T>(selected: T[], value: T) {
  return selected.length === 0 || selected.includes(value)
}

export function matchesFilters(cat: CatRecord, filters: FilterState, index: FilterIndex) {
  const query = filters.query.trim().toLowerCase()
  if (query && !String(cat.rescueOrder).includes(query)) {
    return false
  }

  if (
    filters.classifications.length > 0 &&
    !filters.classifications.some((key) => index.classificationSets[key]?.has(cat.rescueOrder))
  ) {
    return false
  }
  if (!matchesAny(filters.rescueYears, cat.rescueYear)) return false
  if (!matchesAny(filters.hueNames, cat.hueName)) return false
  if (filters.pale === 'pale' && !cat.pale) return false
  if (filters.pale === 'normal' && cat.pale) return false
  if (!matchesAny(filters.patterns, cat.pattern)) return false
  if (!matchesAny(filters.poses, cat.pose)) return false
  if (!matchesAny(filters.expressions, cat.expression)) return false
  if (!matchesAny(filters.facings, cat.facing)) return false
  if (filters.naming === 'named' && !index.namedOrders.has(cat.rescueOrder)) return false
  if (filters.naming === 'unnamed' && index.namedOrders.has(cat.rescueOrder)) return false
  return true
}

export function activeFilterCount(filters: FilterState) {
  return (
    filters.classifications.length +
    filters.rescueYears.length +
    filters.hueNames.length +
    filters.patterns.length +
    filters.poses.length +
    filters.expressions.length +
    filters.facings.length +
    (filters.pale === 'all' ? 0 : 1) +
    (filters.naming === 'all' ? 0 : 1)
  )
}

export function removeFilterValue(
  filters: FilterState,
  key: RemovableFilterKey,
  value: string | number,
) {
  const next = cloneFilterState(filters)
  switch (key) {
    case 'classifications':
      next.classifications = next.classifications.filter((item) => item !== value)
      break
    case 'rescueYears':
      next.rescueYears = next.rescueYears.filter((item) => item !== value)
      break
    case 'hueNames':
      next.hueNames = next.hueNames.filter((item) => item !== value)
      break
    case 'pale':
      next.pale = 'all'
      break
    case 'patterns':
      next.patterns = next.patterns.filter((item) => item !== value)
      break
    case 'poses':
      next.poses = next.poses.filter((item) => item !== value)
      break
    case 'expressions':
      next.expressions = next.expressions.filter((item) => item !== value)
      break
    case 'facings':
      next.facings = next.facings.filter((item) => item !== value)
      break
    case 'naming':
      next.naming = 'all'
      break
  }
  return next
}

export function getActiveFilterChips(filters: FilterState): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = []
  const classificationLabels = new Map<string, string>(
    CLASSIFICATION_FILTER_OPTIONS.map(({ value, label }) => [value, label]),
  )
  filters.classifications.forEach((value) => {
    chips.push({
      key: 'classifications',
      value,
      label: classificationLabels.get(value) ?? titleCase(value),
    })
  })
  filters.rescueYears.forEach((value) => chips.push({ key: 'rescueYears', value, label: `Year ${value}` }))
  filters.hueNames.forEach((value) => chips.push({ key: 'hueNames', value, label: `Hue ${titleCase(value)}` }))
  filters.pale !== 'all' && chips.push({
    key: 'pale',
    value: filters.pale,
    label: filters.pale === 'pale' ? 'Pale' : 'Normal',
  })
  filters.patterns.forEach((value) => chips.push({ key: 'patterns', value, label: `Pattern ${titleCase(value)}` }))
  filters.poses.forEach((value) => chips.push({ key: 'poses', value, label: `Pose ${titleCase(value)}` }))
  filters.expressions.forEach((value) => chips.push({ key: 'expressions', value, label: `Expression ${titleCase(value)}` }))
  filters.facings.forEach((value) => chips.push({ key: 'facings', value, label: `Facing ${titleCase(value)}` }))
  filters.naming !== 'all' && chips.push({
    key: 'naming',
    value: filters.naming,
    label: filters.naming === 'named' ? 'Named' : 'Unnamed',
  })
  return chips
}
