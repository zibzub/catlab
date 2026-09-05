import { describe, expect, it } from 'vitest'
import {
  canTransformComposeObject,
  moveComposeLayer,
  moveComposeLayerToIndex,
  orderComposeLayers,
  resetComposeTransform,
} from '../composeModel'

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

  it('moves a layer to a front-to-back index without mutating input', () => {
    const objects = [
      { id: 'back', z: 0, kind: 'rect', locked: true, visible: false, width: 0.4 },
      { id: 'middle', z: 1, kind: 'text', locked: false, visible: true, text: 'Layer' },
      { id: 'front', z: 2, kind: 'cat', locked: false, visible: true, rescueOrder: 42 },
    ]

    const frontToMiddle = moveComposeLayerToIndex(objects, 'front', 1)
    expect(orderComposeLayers(frontToMiddle).map((object) => object.id)).toEqual(['middle', 'front', 'back'])
    expect(frontToMiddle.map((object) => object.z).sort()).toEqual([0, 1, 2])

    const backToFront = moveComposeLayerToIndex(objects, 'back', 0)
    expect(orderComposeLayers(backToFront).map((object) => object.id)).toEqual(['back', 'front', 'middle'])

    const middleToBack = moveComposeLayerToIndex(objects, 'middle', 2)
    expect(orderComposeLayers(middleToBack).map((object) => object.id)).toEqual(['front', 'back', 'middle'])
    expect(middleToBack.find((object) => object.id === 'middle')).toMatchObject({
      kind: 'text',
      locked: false,
      visible: true,
      text: 'Layer',
    })

    expect(moveComposeLayerToIndex(objects, 'middle', 1)).toBe(objects)
    expect(objects.map((object) => [object.id, object.z])).toEqual([
      ['back', 0],
      ['middle', 1],
      ['front', 2],
    ])
  })
})
