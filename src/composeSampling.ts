import type { ComposePlacedObject } from './composeExport'

export type ComposeColorTarget = 'fill' | 'stroke'

export type ComposeSamplingTarget =
  { kind: 'foreground' } | { kind: 'object'; objectId: string; property: ComposeColorTarget }

export function isComposeSamplingTargetValid(
  target: ComposeSamplingTarget,
  object: ComposePlacedObject | undefined,
): boolean {
  if (target.kind === 'foreground') return true
  if (!object || object.id !== target.objectId) return false
  if (object.kind === 'text') return true
  return object.kind === 'rect' && target.property === 'fill'
}

export function getComposeSamplingReadyMessage(target: ComposeSamplingTarget): string {
  if (target.kind === 'foreground') return 'Click the stage to sample the foreground color. Press Escape to cancel.'
  const label = target.property === 'stroke' ? 'outline' : 'fill'
  return `Click the stage to sample this ${label} color. Press Escape to cancel.`
}

export function getComposeSamplingTransparentMessage(target: ComposeSamplingTarget): string {
  if (target.kind === 'foreground') return 'That point is transparent. Foreground was not changed.'
  return 'That point is transparent. No color was changed.'
}
