import { describe, expect, it } from 'vitest'
import {
  columnsForWidth,
  continuousScrollTarget,
  pageScrollTarget,
  reachedScrollEndpoint,
  rowEstimateFor,
} from '../components/collectionGridMetrics'

describe('collection grid metrics', () => {
  it('preserves compact and detailed column caps across art modes', () => {
    expect(columnsForWidth(5_000, 'compact', 'bodies', 'small')).toBe(16)
    expect(columnsForWidth(5_000, 'compact', 'bodies', 'medium')).toBe(16)
    expect(columnsForWidth(5_000, 'compact', 'bodies', 'large')).toBe(14)
    expect(columnsForWidth(5_000, 'compact', 'faces', 'small')).toBe(16)
    expect(columnsForWidth(5_000, 'detailed', 'bodies', 'small')).toBe(9)
    expect(columnsForWidth(5_000, 'detailed', 'faces', 'large')).toBe(9)
  })

  it('keeps phone minimums and face/body density rules', () => {
    expect(columnsForWidth(0, 'compact', 'bodies', 'medium')).toBe(1)
    expect(columnsForWidth(200, 'compact', 'bodies', 'medium')).toBe(4)
    expect(columnsForWidth(200, 'compact', 'faces', 'medium')).toBe(2)
    expect(columnsForWidth(620, 'compact', 'bodies', 'small')).toBe(9)
    expect(columnsForWidth(621, 'compact', 'bodies', 'small')).toBe(7)
  })

  it('uses the current virtual-row estimates', () => {
    expect(rowEstimateFor('compact', 'bodies', 'small')).toBe(126)
    expect(rowEstimateFor('compact', 'faces', 'medium')).toBe(126)
    expect(rowEstimateFor('detailed', 'bodies', 'large')).toBe(250)
    expect(rowEstimateFor('detailed', 'faces', 'large')).toBe(224)
  })
})

describe('collection grid scroll arithmetic', () => {
  it('uses a 92% page step and clamps at both ends', () => {
    expect(pageScrollTarget(0, 500, 2_000, 1)).toEqual({ maxScroll: 1_500, target: 460 })
    expect(pageScrollTarget(1_400, 500, 2_000, 1)).toEqual({ maxScroll: 1_500, target: 1_500 })
    expect(pageScrollTarget(100, 500, 2_000, -1)).toEqual({ maxScroll: 1_500, target: 0 })
  })

  it('allows a held down/up action to move away from the opposite endpoint before stopping', () => {
    const fromTop = continuousScrollTarget(0, 500, 2_000, 1, 16)
    const fromBottom = continuousScrollTarget(1_500, 500, 2_000, -1, 16)
    expect(fromTop.target).toBeGreaterThan(0)
    expect(reachedScrollEndpoint(fromTop.target, fromTop.maxScroll, 1)).toBe(false)
    expect(fromBottom.target).toBeLessThan(1_500)
    expect(reachedScrollEndpoint(fromBottom.target, fromBottom.maxScroll, -1)).toBe(false)
    expect(reachedScrollEndpoint(0, 1_500, -1)).toBe(true)
    expect(reachedScrollEndpoint(1_500, 1_500, 1)).toBe(true)
  })
})
