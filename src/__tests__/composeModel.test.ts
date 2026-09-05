import { describe, expect, it } from 'vitest'
import {
  canAddComposeLayer,
  canTransformComposeObject,
  cloneComposeObjectFromSnapshot,
  createComposeClipboardSnapshot,
  getComposePastePosition,
  moveComposeLayer,
  moveComposeLayerToIndex,
  offsetComposePosition,
  orderComposeLayers,
  resetComposeTransform,
  resizeComposeRectangle,
} from '../composeModel'

describe('Compose object model', () => {
  it('enforces the editor layer limit without mutating anything', () => {
    expect(canAddComposeLayer(39)).toBe(true)
    expect(canAddComposeLayer(40)).toBe(false)
    expect(canAddComposeLayer(41)).toBe(false)
  })

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

  it('creates ID-free snapshots and clones each placed-object shape', () => {
    const cat = {
      id: 'cat-1',
      kind: 'cat' as const,
      rescueOrder: 42,
      artMode: 'faces' as const,
      x: 0.2,
      y: 0.3,
      z: 4,
      scale: 1.4,
      rotation: 12,
      opacity: 0.7,
      flipX: true,
      flipY: false,
      locked: true,
      visible: false,
    }
    const text = {
      id: 'text-1',
      kind: 'text' as const,
      text: 'Hello',
      fill: '#fff',
      stroke: '#000',
      strokeWidth: 2,
      fontSize: 56,
      fontFamily: 'sans-serif',
      x: 0.4,
      y: 0.5,
      z: 2,
      scale: 1,
      rotation: 0,
      opacity: 1,
      flipX: false,
      flipY: true,
      locked: false,
      visible: true,
    }
    const rect = {
      id: 'rect-1',
      kind: 'rect' as const,
      width: 0.4,
      height: 0.2,
      fill: '#abcdef',
      x: 0.6,
      y: 0.7,
      z: 1,
      scale: 0.8,
      rotation: -15,
      opacity: 0.5,
      flipX: false,
      flipY: false,
      locked: true,
      visible: true,
    }

    const catSnapshot = createComposeClipboardSnapshot(cat)
    const textSnapshot = createComposeClipboardSnapshot(text)
    const rectSnapshot = createComposeClipboardSnapshot(rect)
    expect(catSnapshot).not.toHaveProperty('id')
    expect(catSnapshot).not.toHaveProperty('z')
    expect(cloneComposeObjectFromSnapshot(catSnapshot, 'cat-2', 8, { x: 0.24, y: 0.34 })).toMatchObject({
      id: 'cat-2',
      z: 8,
      rescueOrder: 42,
      artMode: 'faces',
      locked: true,
      visible: false,
      x: 0.24,
      y: 0.34,
    })
    expect(cloneComposeObjectFromSnapshot(textSnapshot, 'text-2', 9, { x: 0.44, y: 0.54 })).toMatchObject({
      id: 'text-2',
      z: 9,
      text: 'Hello',
      fill: '#fff',
      flipY: true,
    })
    expect(cloneComposeObjectFromSnapshot(rectSnapshot, 'rect-2', 10, { x: 0.64, y: 0.74 })).toMatchObject({
      id: 'rect-2',
      z: 10,
      width: 0.4,
      height: 0.2,
      locked: true,
    })
    expect(cat.id).toBe('cat-1')
    expect(cat.z).toBe(4)
  })

  it('offsets repeated paste positions and clamps them to the stage', () => {
    expect(offsetComposePosition({ x: 0.5, y: 0.5 })).toEqual({ x: 0.54, y: 0.54 })
    expect(offsetComposePosition({ x: 0.96, y: 0.95 })).toEqual({ x: expect.closeTo(0.92), y: expect.closeTo(0.91) })
    expect(offsetComposePosition({ x: 0, y: 1 })).toEqual({ x: 0.04, y: 0.96 })
  })

  it('cascades successive paste positions without edge oscillation', () => {
    const source = { x: 0.9, y: 0.9 }
    const positions = [1, 2, 3, 4].map((pasteNumber) => getComposePastePosition(source, pasteNumber))

    expect(positions[0].x).toBeCloseTo(0.94)
    expect(positions[0].y).toBeCloseTo(0.94)
    expect(positions[1].x).toBeCloseTo(0.98)
    expect(positions[1].y).toBeCloseTo(0.98)
    expect(positions[2].x).toBeCloseTo(0.02)
    expect(positions[2].y).toBeCloseTo(0.02)
    expect(new Set(positions.map((position) => `${position.x}:${position.y}`)).size).toBe(4)
    for (const position of positions) {
      expect(position.x).toBeGreaterThanOrEqual(0)
      expect(position.x).toBeLessThanOrEqual(1)
      expect(position.y).toBeGreaterThanOrEqual(0)
      expect(position.y).toBeLessThanOrEqual(1)
    }
    expect(source).toEqual({ x: 0.9, y: 0.9 })
  })

  it('resizes each rectangle axis from a fixed start and anchors the opposite edge', () => {
    const rectangle = { x: 0.5, y: 0.5, width: 0.2, height: 0.3, scale: 1, rotation: 0 }
    const stage = { width: 100, height: 100 }
    const east = resizeComposeRectangle(rectangle, [2, 1], [1, 0], stage)
    const west = resizeComposeRectangle(rectangle, [2, 1], [-1, 0], stage)
    const north = resizeComposeRectangle(rectangle, [1, 2], [0, -1], stage)
    const south = resizeComposeRectangle(rectangle, [1, 2], [0, 1], stage)
    const corner = resizeComposeRectangle(rectangle, [2, 1.5], [1, 1], stage)

    expect(east).toEqual({ x: 0.6, y: 0.5, width: 0.4, height: 0.3, scale: 1 })
    expect(west).toEqual({ x: 0.4, y: 0.5, width: 0.4, height: 0.3, scale: 1 })
    expect(north).toEqual({ x: 0.5, y: 0.35, width: 0.2, height: 0.6, scale: 1 })
    expect(south).toEqual({ x: 0.5, y: 0.65, width: 0.2, height: 0.6, scale: 1 })
    expect(corner.x).toBeCloseTo(0.6)
    expect(corner.y).toBeCloseTo(0.575)
    expect(corner.width).toBeCloseTo(0.4)
    expect(corner.height).toBeCloseTo(0.45)
    expect(corner.scale).toBe(1)
    expect(rectangle).toEqual({ x: 0.5, y: 0.5, width: 0.2, height: 0.3, scale: 1, rotation: 0 })
  })

  it.each([
    { rotation: 45, direction: [1, -1] as const, scale: [1.5, 2] as const },
    { rotation: 90, direction: [1, 0] as const, scale: [2, 1] as const },
  ])('keeps the opposite anchor fixed for a $rotation degree rectangle', ({ rotation, direction, scale }) => {
    const rectangle = { x: 0.5, y: 0.5, width: 0.2, height: 0.3, scale: 1, rotation }
    const stage = { width: 800, height: 600 }
    const resized = resizeComposeRectangle(rectangle, scale, direction, stage)

    const fixedAnchor = (value: typeof rectangle | typeof resized) => {
      const radians = (rotation * Math.PI) / 180
      const localX = (-direction[0] * value.width * stage.width) / 2
      const localY = (-direction[1] * value.height * stage.height) / 2
      return [
        value.x * stage.width + localX * Math.cos(radians) - localY * Math.sin(radians),
        value.y * stage.height + localX * Math.sin(radians) + localY * Math.cos(radians),
      ]
    }

    const beforeAnchor = fixedAnchor(rectangle)
    const afterAnchor = fixedAnchor(resized)
    expect(afterAnchor[0]).toBeCloseTo(beforeAnchor[0])
    expect(afterAnchor[1]).toBeCloseTo(beforeAnchor[1])
    expect(resized.scale).toBe(1)
  })

  it('uses clamped size deltas for anchoring and stops at the crossing minimum', () => {
    const rectangle = { x: 0.5, y: 0.5, width: 0.2, height: 0.3, scale: 1, rotation: 0 }
    const stage = { width: 100, height: 100 }
    const atMinimum = resizeComposeRectangle(rectangle, [0, 1], [1, 0], stage)
    const pastCrossing = resizeComposeRectangle(rectangle, [-4, 1], [1, 0], stage)
    const atMaximum = resizeComposeRectangle({ ...rectangle, width: 1 }, [4, 1], [1, 0], stage)
    const pastMaximum = resizeComposeRectangle({ ...rectangle, width: 1 }, [20, 1], [1, 0], stage)

    expect(atMinimum).toEqual({ x: 0.42, y: 0.5, width: 0.04, height: 0.3, scale: 1 })
    expect(pastCrossing).toEqual(atMinimum)
    expect(atMaximum).toEqual({ x: 0.75, y: 0.5, width: 1.5, height: 0.3, scale: 1 })
    expect(pastMaximum).toEqual(atMaximum)
  })

  it('returns deterministic geometry from the same immutable resize-start snapshot', () => {
    const rectangle = { x: 0.4, y: 0.6, width: 0.25, height: 0.2, scale: 1, rotation: 30 }
    const original = { ...rectangle }
    const stage = { width: 640, height: 480 }
    const first = resizeComposeRectangle(rectangle, [1.8, 0.7], [-1, 1], stage)
    const second = resizeComposeRectangle(rectangle, [1.8, 0.7], [-1, 1], stage)

    expect(second).toEqual(first)
    expect(rectangle).toEqual(original)
  })
})
