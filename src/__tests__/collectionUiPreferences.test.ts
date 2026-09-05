import { describe, expect, it } from 'vitest'
import {
  parseCollectionDisplayPreferences,
  serializeCollectionDisplayPreferences,
} from '../collectionPreferences'
import {
  activeFilterCount,
  getActiveFilterChips,
  removeFilterValue,
} from '../components/collectionFilters'
import { createEmptyFilterState } from '../mooncat-index/filters'

describe('collection display preference persistence', () => {
  it('parses valid preferences and migrates legacy values', () => {
    expect(parseCollectionDisplayPreferences(JSON.stringify({
      viewMode: 'list',
      gridSize: 'small',
      showRings: true,
      showStars: false,
      showVignette: true,
      idlePattern: 'snake',
      idleSpeed: 'fast',
    }))).toEqual({
      viewMode: 'list',
      gridSize: 'small',
      ringStyle: 'outline',
      showStars: false,
      showVignette: true,
      idlePattern: 'worm',
      idleSpeed: 'fast',
    })
  })

  it('falls back safely for malformed values and serializes current state', () => {
    expect(parseCollectionDisplayPreferences('{bad json')).toEqual({})
    expect(parseCollectionDisplayPreferences(JSON.stringify({ viewMode: 'tiles', idlePattern: 'legacy' }))).toEqual({})
    expect(serializeCollectionDisplayPreferences({
      viewMode: 'compact', gridSize: 'medium', ringStyle: 'ac', showStars: true,
      showVignette: false, idlePattern: 'wave', idleSpeed: 'slow',
    })).toBe('{"viewMode":"compact","gridSize":"medium","ringStyle":"ac","showStars":true,"showVignette":false,"idlePattern":"wave","idleSpeed":"slow"}')
  })
})

describe('collection filter UI helpers', () => {
  const filters = {
    ...createEmptyFilterState(),
    classifications: ['day1', 'pinkpanther'],
    rescueYears: [2017],
    hueNames: ['sky blue'],
    hueValueMin: 10,
    hueValueMax: 20,
    pale: 'pale' as const,
    patterns: ['striped'],
    poses: ['standing'],
    expressions: ['smiling'],
    facings: ['left'],
    naming: 'recentlyNamed' as const,
  }

  it('counts and labels every active filter deterministically', () => {
    expect(activeFilterCount(filters)).toBe(11)
    expect(getActiveFilterChips(filters)).toEqual([
      { key: 'classifications', value: 'day1', label: 'Day 1' },
      { key: 'classifications', value: 'pinkpanther', label: 'Pink Panther' },
      { key: 'rescueYears', value: 2017, label: 'Year 2017' },
      { key: 'hueNames', value: 'sky blue', label: 'Hue Sky Blue' },
      { key: 'hueValue', value: 'range', label: 'Hue value 10–20' },
      { key: 'pale', value: 'pale', label: 'Pale' },
      { key: 'patterns', value: 'striped', label: 'Pattern Striped' },
      { key: 'poses', value: 'standing', label: 'Pose Standing' },
      { key: 'expressions', value: 'smiling', label: 'Expression Smiling' },
      { key: 'facings', value: 'left', label: 'Facing Left' },
      { key: 'naming', value: 'recentlyNamed', label: 'Recently Named' },
    ])
  })

  it('removes only the requested chip value and resets singleton filter values', () => {
    expect(removeFilterValue(filters, 'classifications', 'day1').classifications).toEqual(['pinkpanther'])
    expect(removeFilterValue(filters, 'hueValue', 'range')).toMatchObject({ hueValueMin: null, hueValueMax: null })
    expect(removeFilterValue(filters, 'pale', 'pale').pale).toBe('all')
    expect(removeFilterValue(filters, 'naming', 'recentlyNamed').naming).toBe('all')
  })
})
