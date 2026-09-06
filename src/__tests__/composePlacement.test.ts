import { describe, expect, it } from 'vitest'
import {
  COMPOSE_PLACEMENT_DRAG_THRESHOLD_PX,
  COMPOSE_RECTANGLE_DEFAULT_HEIGHT,
  COMPOSE_RECTANGLE_DEFAULT_WIDTH,
  COMPOSE_RECTANGLE_MIN_SIZE,
  getComposePointerDistance,
  getComposeRectangleDragPlacement,
  getComposeRectanglePlacement,
  getComposeStagePoint,
  isComposePlacementDrag,
} from '../composePlacement'

describe('Compose placement geometry', () => {
  it('converts stage client points to normalized coordinates and clamps the edges', () => {
    const bounds = { left: 100, top: 50, width: 800, height: 400 }

    expect(getComposeStagePoint({ clientX: 500, clientY: 250 }, bounds)).toEqual({ x: 0.5, y: 0.5 })
    expect(getComposeStagePoint({ clientX: 100, clientY: 50 }, bounds)).toEqual({ x: 0, y: 0 })
    expect(getComposeStagePoint({ clientX: 1000, clientY: 600 }, bounds)).toEqual({ x: 1, y: 1 })
    expect(getComposeStagePoint({ clientX: 0, clientY: 900 }, bounds)).toEqual({ x: 0, y: 1 })
  })

  it('uses a Euclidean pointer threshold for taps versus drags', () => {
    const start = { clientX: 20, clientY: 40 }
    const below = { clientX: 25, clientY: 45 }
    const above = { clientX: 26, clientY: 46 }

    expect(getComposePointerDistance(start, below)).toBeCloseTo(Math.sqrt(50))
    expect(isComposePlacementDrag(start, below)).toBe(false)
    expect(isComposePlacementDrag(start, above)).toBe(true)
    expect(isComposePlacementDrag(start, below, Math.sqrt(50))).toBe(true)
    expect(COMPOSE_PLACEMENT_DRAG_THRESHOLD_PX).toBe(8)
  })

  it('creates independent normalized bounds for every drag direction', () => {
    const expected = { x: 0.45, y: 0.55, width: 0.5, height: 0.5 }
    for (const [start, end] of [
      [
        { x: 0.2, y: 0.3 },
        { x: 0.7, y: 0.8 },
      ],
      [
        { x: 0.7, y: 0.8 },
        { x: 0.2, y: 0.3 },
      ],
      [
        { x: 0.2, y: 0.8 },
        { x: 0.7, y: 0.3 },
      ],
    ] as const) {
      const placement = getComposeRectangleDragPlacement(start, end)
      expect(placement.x).toBeCloseTo(expected.x)
      expect(placement.y).toBeCloseTo(expected.y)
      expect(placement.width).toBeCloseTo(expected.width)
      expect(placement.height).toBeCloseTo(expected.height)
    }
  })

  it('keeps very thin drags usable with the practical minimum size', () => {
    expect(getComposeRectangleDragPlacement({ x: 0.4, y: 0.4 }, { x: 0.4, y: 0.4 })).toEqual({
      x: 0.4,
      y: 0.4,
      width: COMPOSE_RECTANGLE_MIN_SIZE,
      height: COMPOSE_RECTANGLE_MIN_SIZE,
    })
  })

  it('uses the existing default rectangle size for a sub-threshold placement', () => {
    const start = { x: 0.2, y: 0.75 }
    expect(getComposeRectanglePlacement(start, { x: 0.21, y: 0.76 }, false)).toEqual({
      x: 0.2,
      y: 0.75,
      width: COMPOSE_RECTANGLE_DEFAULT_WIDTH,
      height: COMPOSE_RECTANGLE_DEFAULT_HEIGHT,
    })
  })

  it('does not mutate source points', () => {
    const start = { x: 0.8, y: 0.7 }
    const end = { x: 0.1, y: 0.2 }
    const startBefore = { ...start }
    const endBefore = { ...end }

    getComposeRectangleDragPlacement(start, end)

    expect(start).toEqual(startBefore)
    expect(end).toEqual(endBefore)
  })
})
