import { describe, expect, it } from 'vitest'
import { getDynamicRingScale } from '../collectionRing'

describe('dynamic Collection ring sizing', () => {
  it('maps compact and broad poses to stable width scales', () => {
    expect(getDynamicRingScale('standing')).toBe(0.78)
    expect(getDynamicRingScale('sleeping')).toBe(1.18)
    expect(getDynamicRingScale('stalking')).toBe(0.98)
    expect(getDynamicRingScale('pouncing')).toBe(1.08)
  })

  it('keeps unknown poses at a neutral scale and clamps the supported range', () => {
    expect(getDynamicRingScale('future-pose')).toBe(1)
    expect(getDynamicRingScale('')).toBe(1)
  })
})
