import { describe, expect, it } from 'vitest'
import { buildFilterIndex, createEmptyFilterState, matchesFilters } from '../filters'
import { deriveMoonCatIndexResult } from '../result'
import type { CatRecord, FilterState } from '../../types'
import type { MoonCatClassifications, MoonCatNames } from '../../mooncatDetails'

const classificationKeys = ['week1', 'earlyRescues', 'garfield', 'cheshire', 'pinkpanther', 'alien', 'zombie', 'simba', 'golden', 'pikachu']

function cat(overrides: Partial<CatRecord> & Pick<CatRecord, 'rescueOrder'>): CatRecord {
  const { rescueOrder, ...rest } = overrides
  return {
    rescueOrder,
    catId: String(rescueOrder),
    rescueYear: 2017,
    hueInt: 100,
    hueName: 'red',
    pale: false,
    facing: 'left',
    expression: 'calm',
    pattern: 'solid',
    pose: 'sitting',
    genesis: false,
    nameTimestamp: null,
    ...rest,
  }
}

function filters(overrides: Partial<FilterState> = {}): FilterState {
  return { ...createEmptyFilterState(), ...overrides }
}

const cats = [
  cat({ rescueOrder: 0, nameTimestamp: 100 }),
  cat({ rescueOrder: 100, pattern: 'striped' }),
  cat({ rescueOrder: 491, genesis: true, nameTimestamp: 50 }),
  cat({ rescueOrder: 492, hueName: 'blue', nameTimestamp: 75 }),
  cat({ rescueOrder: 903 }),
  cat({ rescueOrder: 904, nameTimestamp: 25 }),
]

const names: MoonCatNames = {
  '0': { name: 'Alpha', timestamp: 100 },
  '491': { name: 'Bravo', timestamp: 50 },
  '492': { name: 'Charlie', timestamp: 75 },
  '904': { name: 'Delta', timestamp: 25 },
}

const classifications: MoonCatClassifications = {
  schemaVersion: 1,
  count: 25_440,
  maxId: 25_439,
  categories: Object.fromEntries(classificationKeys.map((key) => [key, {
    label: key,
    group: 'test',
    ids: key === 'garfield' ? [904] : [],
  }])),
}

const index = buildFilterIndex(cats, names, classifications)

function result(currentFilters: Partial<FilterState> = {}, extras: {
  colorMatchingOrders?: ReadonlySet<number> | null
  ownedOrders?: ReadonlySet<number> | null
} = {}) {
  return deriveMoonCatIndexResult({
    cats,
    filterIndex: index,
    filters: filters(currentFilters),
    colorMatchingOrders: extras.colorMatchingOrders ?? null,
    ownedOrders: extras.ownedOrders ?? null,
  }).map((item) => item.rescueOrder)
}

describe('MoonCat filter index', () => {
  it('builds classification, naming, and option counts', () => {
    expect(index.totalCount).toBe(cats.length)
    expect(index.counts.classifications.day1).toBe(3)
    expect(index.counts.classifications.day2).toBe(2)
    expect(index.counts.classifications.garfield).toBe(1)
    expect(index.counts.classifications.genesis).toBe(1)
    expect(index.counts.naming).toEqual({ named: 4, unnamed: 2 })
    expect(index.options.rescueYears).toEqual([2017])
    expect(index.options.hueNames).toEqual(['blue', 'red'])
  })

  it('matches query, classification, and combined filter semantics', () => {
    expect(matchesFilters(cats[1], filters({ query: '10' }), index)).toBe(true)
    expect(matchesFilters(cats[1], filters({ query: 'alpha' }), index)).toBe(false)
    expect(result({ query: '49' })).toEqual([491, 492])
    expect(result({ query: 'cha' })).toEqual([492])
    expect(result({ classifications: ['day1'] })).toEqual([0, 100, 491])
    expect(result({ classifications: ['day2'] })).toEqual([492, 903])
    expect(result({ classifications: ['garfield'] })).toEqual([904])
    expect(result({ classifications: ['genesis'] })).toEqual([491])
    expect(result({ classifications: ['day2'], hueNames: ['blue'] })).toEqual([492])
  })

  it('keeps named-state filtering exact', () => {
    expect(result({ naming: 'named' })).toEqual([0, 100, 491, 492, 904].filter((order) => order !== 100))
    expect(result({ naming: 'unnamed' })).toEqual([100, 903])
  })
})

describe('MoonCat index result derivation', () => {
  it('preserves base order and intersects ColorLab and wallet constraints', () => {
    expect(result()).toEqual([0, 100, 491, 492, 903, 904])
    expect(result({}, { colorMatchingOrders: new Set([491, 492, 904]) })).toEqual([491, 492, 904])
    expect(result({}, { ownedOrders: new Set([492, 904]) })).toEqual([492, 904])
    expect(result({ classifications: ['day2'] }, { ownedOrders: new Set([492]) })).toEqual([492])
    expect(result({ classifications: ['day2'] }, {
      colorMatchingOrders: new Set([492, 903]),
      ownedOrders: new Set([903]),
    })).toEqual([903])
  })

  it('sorts chronological modes while excluding unnamed records', () => {
    expect(result({ naming: 'recentlyNamed' })).toEqual([0, 492, 491, 904])
    expect(result({ naming: 'firstNamed' })).toEqual([904, 491, 492, 0])
  })
})
