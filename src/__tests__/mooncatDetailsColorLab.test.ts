import { describe, expect, it } from 'vitest'
import {
  classifyGenesisDetail,
  formatMoonCatClassificationFooter,
  formatMoonCatHue,
  getMoonCatClassificationLabels,
  getMoonCatName,
  validateMoonCatClassifications,
  validateMoonCatNames,
} from '../mooncatDetails'
import {
  createColorLabSample,
  detectMoonCatColorFromRgb,
  findMoonCatsByExactHue,
  getClosestMoonCatCoatHueLabel,
  getMoonCatColorMatch,
  isUsableColorLabSample,
  rgbToHex,
} from '../colorLab'
import type { CatRecord } from '../types'

function cat(overrides: Partial<CatRecord> & Pick<CatRecord, 'rescueOrder'>): CatRecord {
  const { rescueOrder, ...rest } = overrides
  return {
    rescueOrder,
    catId: String(rescueOrder),
    rescueYear: 2017,
    hueInt: 120,
    hueName: 'green',
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

const categories = Object.fromEntries([
  ['sub100', [0]], ['day1', [0, 491]], ['week1', [904]], ['earlyRescues', [904]],
  ['garfield', [904]], ['cheshire', []], ['pinkpanther', []], ['alien', []],
  ['zombie', []], ['simba', []], ['golden', []], ['pikachu', []],
].map(([key, ids]) => [key, { label: key, group: 'test', ids }]))

describe('MoonCat name and classification helpers', () => {
  it('validates name metadata and rejects invalid rescue-order entries', () => {
    expect(validateMoonCatNames({ '0': { name: 'Alpha', timestamp: 1 } })).toEqual({ '0': { name: 'Alpha', timestamp: 1 } })
    expect(validateMoonCatNames({ '25440': { name: 'Too far', timestamp: null } })).toBeNull()
    expect(validateMoonCatNames({ '1': { name: '', timestamp: null } })).toBeNull()
    expect(getMoonCatName({ '1': { name: 'Named', timestamp: null } }, 1)).toBe('Named')
  })

  it('classifies rescue periods, genesis, and character cats', () => {
    const classifications = validateMoonCatClassifications({ schemaVersion: 1, count: 25_440, maxId: 25_439, categories })
    expect(classifications).not.toBeNull()
    expect(getMoonCatClassificationLabels(cat({ rescueOrder: 491 }), classifications)).toEqual(['day 1'])
    expect(getMoonCatClassificationLabels(cat({ rescueOrder: 492 }), classifications)).toEqual(['day 2'])
    expect(getMoonCatClassificationLabels(cat({ rescueOrder: 904 }), classifications)).toEqual(['week 1', 'garfield'])
    expect(getMoonCatClassificationLabels(cat({ rescueOrder: 10, genesis: true }), classifications)).toEqual(['day 1', 'genesis'])
    expect(formatMoonCatClassificationFooter(['pinkpanther', 'day 1'])).toBe('PINK PANTHER • DAY 1')
  })

  it('handles Genesis detail and coat hue formatting', () => {
    expect(classifyGenesisDetail(cat({ rescueOrder: 1, genesis: true, hueInt: 1000, hueName: 'black' }))).toBe('black')
    expect(classifyGenesisDetail(cat({ rescueOrder: 2, genesis: true, hueInt: 2000, hueName: 'white' }))).toBe('white')
    expect(formatMoonCatHue(cat({ rescueOrder: 1, genesis: true, hueInt: 1000, hueName: 'black' }))).toBe('genesis')
  })
})

describe('ColorLab pure matching helpers', () => {
  it('recognizes Genesis samples, normal coats, and unusable neutral samples', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 15 })).toBe('#FF000F')
    expect(detectMoonCatColorFromRgb({ r: 16, g: 18, b: 20 })).toEqual({ kind: 'black', hueInt: 1000, pale: false })
    expect(detectMoonCatColorFromRgb({ r: 245, g: 247, b: 244 })).toEqual({ kind: 'white', hueInt: 2000, pale: true })
    expect(detectMoonCatColorFromRgb({ r: 80, g: 80, b: 80 })).toEqual({ kind: 'unknown', hueInt: null, pale: null })
    const sample = createColorLabSample({ rgb: { r: 255, g: 0, b: 0 }, alpha: 255 })
    expect(isUsableColorLabSample(sample)).toBe(true)
    expect(getMoonCatColorMatch(sample)).toEqual({ kind: 'normal', hueInt: 0, pale: false })
    expect(getClosestMoonCatCoatHueLabel(sample.detection, sample.hue)).toBe('Red')
  })

  it('finds exact hue matches in rescue-order order with pale filtering', () => {
    const cats = [
      cat({ rescueOrder: 9, hueInt: 120, pale: false }),
      cat({ rescueOrder: 2, hueInt: 120, pale: false }),
      cat({ rescueOrder: 5, hueInt: 120, pale: true }),
      cat({ rescueOrder: 1, hueInt: 90, pale: false }),
    ]
    expect(findMoonCatsByExactHue(cats, 120).map((item) => item.rescueOrder)).toEqual([2, 5, 9])
    expect(findMoonCatsByExactHue(cats, 120, false).map((item) => item.rescueOrder)).toEqual([2, 9])
  })
})
