import { describe, expect, it } from 'vitest'
import {
  isDay1RescueOrder,
  isDay2RescueOrder,
  isValidRescueOrder,
  MAX_RESCUE_ORDER,
  MOONCAT_COUNT,
} from '../domain'
import { compareFirstNamed, compareRecentlyNamed } from '../sorts'
import type { CatRecord } from '../../types'

function cat(rescueOrder: number, nameTimestamp: number | null): CatRecord {
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
    nameTimestamp,
  }
}

describe('MoonCat domain boundaries', () => {
  it('keeps the count and maximum rescue order relationship', () => {
    expect(MOONCAT_COUNT).toBe(25_440)
    expect(MAX_RESCUE_ORDER).toBe(MOONCAT_COUNT - 1)
  })

  it('validates the complete integer rescue-order range', () => {
    expect(isValidRescueOrder(0)).toBe(true)
    expect(isValidRescueOrder(25_439)).toBe(true)
    expect(isValidRescueOrder(-1)).toBe(false)
    expect(isValidRescueOrder(25_440)).toBe(false)
    expect(isValidRescueOrder(1.5)).toBe(false)
    expect(isValidRescueOrder(Number.NaN)).toBe(false)
  })

  it('preserves Day 1 and Day 2 boundaries', () => {
    expect(isDay1RescueOrder(0)).toBe(true)
    expect(isDay1RescueOrder(491)).toBe(true)
    expect(isDay1RescueOrder(492)).toBe(false)
    expect(isDay2RescueOrder(492)).toBe(true)
    expect(isDay2RescueOrder(903)).toBe(true)
    expect(isDay2RescueOrder(491)).toBe(false)
    expect(isDay2RescueOrder(904)).toBe(false)
  })
})

describe('MoonCat naming comparators', () => {
  const records = [cat(4, null), cat(2, 100), cat(3, 100), cat(1, 200)]

  it('sorts Recently Named newest first', () => {
    expect([...records].sort(compareRecentlyNamed).map((item) => item.rescueOrder)).toEqual([1, 2, 3, 4])
  })

  it('sorts First Named oldest first', () => {
    expect([...records].sort(compareFirstNamed).map((item) => item.rescueOrder)).toEqual([2, 3, 1, 4])
  })

  it('uses rescue order for equal and missing timestamps', () => {
    expect(compareRecentlyNamed(cat(8, 100), cat(9, 100))).toBeLessThan(0)
    expect(compareFirstNamed(cat(8, null), cat(9, null))).toBeLessThan(0)
    expect(compareRecentlyNamed(cat(8, null), cat(9, 100))).toBeGreaterThan(0)
    expect(compareFirstNamed(cat(8, 100), cat(9, null))).toBeLessThan(0)
  })
})
