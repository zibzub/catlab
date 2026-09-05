import { describe, expect, it } from 'vitest'
import { canTransformComposeObject, resetComposeTransform } from '../composeModel'

describe('Compose object model', () => {
  it('resets only the common transform fields', () => {
    const object = {
      kind: 'rect' as const,
      id: 'rect-1',
      x: 0.2,
      y: 0.8,
      z: 7,
      scale: 2.5,
      rotation: 45,
      opacity: 0.4,
      flipX: true,
      flipY: true,
      locked: true,
      visible: false,
      width: 0.6,
      height: 0.3,
      fill: '#abcdef',
    }

    expect(resetComposeTransform(object)).toEqual({
      ...object,
      scale: 1,
      rotation: 0,
      opacity: 1,
      flipX: false,
      flipY: false,
    })
  })

  it('allows transforms only for visible unlocked objects', () => {
    expect(canTransformComposeObject({ locked: false, visible: true })).toBe(true)
    expect(canTransformComposeObject({ locked: true, visible: true })).toBe(false)
    expect(canTransformComposeObject({ locked: false, visible: false })).toBe(false)
  })
})
