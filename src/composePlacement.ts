export const COMPOSE_RECTANGLE_DEFAULT_WIDTH = 0.28
export const COMPOSE_RECTANGLE_DEFAULT_HEIGHT = 0.2
export const COMPOSE_RECTANGLE_MIN_SIZE = 0.04
export const COMPOSE_PLACEMENT_DRAG_THRESHOLD_PX = 8

export interface ComposeStagePoint {
  x: number
  y: number
}

export interface ComposeClientPoint {
  clientX: number
  clientY: number
}

export interface ComposeStageBounds {
  left: number
  top: number
  width: number
  height: number
}

export interface ComposeRectanglePlacement extends ComposeStagePoint {
  width: number
  height: number
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

export function getComposeStagePoint(
  point: ComposeClientPoint,
  bounds: Pick<ComposeStageBounds, 'left' | 'top' | 'width' | 'height'>,
): ComposeStagePoint {
  return {
    x: bounds.width > 0 ? clamp((point.clientX - bounds.left) / bounds.width) : 0.5,
    y: bounds.height > 0 ? clamp((point.clientY - bounds.top) / bounds.height) : 0.5,
  }
}

export function getComposePointerDistance(start: ComposeClientPoint, current: ComposeClientPoint) {
  return Math.hypot(current.clientX - start.clientX, current.clientY - start.clientY)
}

export function isComposePlacementDrag(
  start: ComposeClientPoint,
  current: ComposeClientPoint,
  threshold = COMPOSE_PLACEMENT_DRAG_THRESHOLD_PX,
) {
  return getComposePointerDistance(start, current) >= threshold
}

export function getDefaultComposeRectanglePlacement(
  center: ComposeStagePoint,
  width = COMPOSE_RECTANGLE_DEFAULT_WIDTH,
  height = COMPOSE_RECTANGLE_DEFAULT_HEIGHT,
): ComposeRectanglePlacement {
  return { x: clamp(center.x), y: clamp(center.y), width, height }
}

export function getComposeRectangleDragPlacement(
  start: ComposeStagePoint,
  end: ComposeStagePoint,
  minSize = COMPOSE_RECTANGLE_MIN_SIZE,
): ComposeRectanglePlacement {
  const left = Math.min(start.x, end.x)
  const right = Math.max(start.x, end.x)
  const top = Math.min(start.y, end.y)
  const bottom = Math.max(start.y, end.y)

  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    width: Math.max(right - left, minSize),
    height: Math.max(bottom - top, minSize),
  }
}

export function getComposeRectanglePlacement(
  start: ComposeStagePoint,
  end: ComposeStagePoint,
  isDrag: boolean,
): ComposeRectanglePlacement {
  return isDrag ? getComposeRectangleDragPlacement(start, end) : getDefaultComposeRectanglePlacement(start)
}
