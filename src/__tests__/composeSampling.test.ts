import { describe, expect, it } from 'vitest'
import {
  getComposeSamplingReadyMessage,
  getComposeSamplingTransparentMessage,
  isComposeSamplingTargetValid,
} from '../composeSampling'
import type { ComposePlacedObject } from '../composeExport'

const rect = { id: 'rect-1', kind: 'rect' } as ComposePlacedObject
const text = { id: 'text-1', kind: 'text' } as ComposePlacedObject
const cat = { id: 'cat-1', kind: 'cat' } as ComposePlacedObject

describe('Compose sampling targets', () => {
  it('allows global foreground sampling without an object', () => {
    expect(isComposeSamplingTargetValid({ kind: 'foreground' }, undefined)).toBe(true)
  })

  it('validates object properties against the targeted object', () => {
    expect(isComposeSamplingTargetValid({ kind: 'object', objectId: 'rect-1', property: 'fill' }, rect)).toBe(true)
    expect(isComposeSamplingTargetValid({ kind: 'object', objectId: 'rect-1', property: 'stroke' }, rect)).toBe(false)
    expect(isComposeSamplingTargetValid({ kind: 'object', objectId: 'text-1', property: 'fill' }, text)).toBe(true)
    expect(isComposeSamplingTargetValid({ kind: 'object', objectId: 'text-1', property: 'stroke' }, text)).toBe(true)
    expect(isComposeSamplingTargetValid({ kind: 'object', objectId: 'cat-1', property: 'fill' }, cat)).toBe(false)
    expect(isComposeSamplingTargetValid({ kind: 'object', objectId: 'rect-1', property: 'fill' }, text)).toBe(false)
  })

  it('provides target-specific status copy', () => {
    expect(getComposeSamplingReadyMessage({ kind: 'foreground' })).toContain('foreground color')
    expect(getComposeSamplingReadyMessage({ kind: 'object', objectId: 'text-1', property: 'stroke' })).toContain(
      'outline color',
    )
    expect(getComposeSamplingTransparentMessage({ kind: 'foreground' })).toContain('Foreground was not changed')
  })
})
