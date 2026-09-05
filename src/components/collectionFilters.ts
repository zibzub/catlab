import type { FilterState } from '../types'
import { cloneFilterState } from '../mooncat-index/filters'

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
  | 'hueValue'
  | 'pale'
  | 'patterns'
  | 'poses'
  | 'expressions'
  | 'facings'
  | 'naming'

export interface ActiveFilterChip {
  key: RemovableFilterKey
  value: string | number
  label: string
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase())
}

export function activeFilterCount(filters: FilterState) {
  return (
    filters.classifications.length +
    filters.rescueYears.length +
    filters.hueNames.length +
    (filters.hueValueMin !== null || filters.hueValueMax !== null ? 1 : 0) +
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
    case 'hueValue':
      next.hueValueMin = null
      next.hueValueMax = null
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
  if (filters.hueValueMin !== null || filters.hueValueMax !== null) {
    const range = filters.hueValueMin !== null && filters.hueValueMax !== null
      ? `${filters.hueValueMin}–${filters.hueValueMax}`
      : filters.hueValueMin !== null
        ? `≥${filters.hueValueMin}`
        : `≤${filters.hueValueMax}`
    chips.push({ key: 'hueValue', value: 'range', label: `Hue value ${range}` })
  }
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
    label: filters.naming === 'named'
      ? 'Named'
      : filters.naming === 'recentlyNamed'
        ? 'Recently Named'
        : filters.naming === 'firstNamed'
          ? 'First Named'
          : 'Unnamed',
  })
  return chips
}
