import { describe, expect, it } from 'vitest'
import { canTransformComposeObject, moveComposeLayer, orderComposeLayers, resetComposeTransform } from '../composeModel'

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

  it('orders layers from front to back without mutating the source array', () => {
    const objects = [
      { id: 'back', z: 0 },
      { id: 'front', z: 4 },
      { id: 'middle', z: 2 },
    ]

    expect(orderComposeLayers(objects).map((object) => object.id)).toEqual(['front', 'middle', 'back'])
    expect(objects.map((object) => object.id)).toEqual(['back', 'front', 'middle'])
  })

  it('moves a layer and normalizes z while preserving object state', () => {
    const objects = [
      { id: 'back', z: 10, kind: 'rect', locked: true, visible: false, width: 0.4 },
      { id: 'middle', z: 20, kind: 'text', locked: false, visible: true, text: 'Layer' },
      { id: 'front', z: 30, kind: 'cat', locked: false, visible: true, rescueOrder: 42 },
    ]

    const moved = moveComposeLayer(objects, 'back', 'front')
    expect(moved.map((object) => [object.id, object.z])).toEqual([
      ['middle', 0],
      ['front', 1],
      ['back', 2],
    ])
    expect(moved[2]).toMatchObject({ kind: 'rect', locked: true, visible: false, width: 0.4 })
    expect(objects.map((object) => object.id)).toEqual(['back', 'middle', 'front'])
    expect(moveComposeLayer(moved, 'middle', 'back').map((object) => object.id)).toEqual(['middle', 'front', 'back'])
  })
})
