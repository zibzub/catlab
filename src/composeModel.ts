export interface ComposeObjectState {
  locked: boolean
  visible: boolean
}

export interface ComposeTransform {
  scale: number
  rotation: number
  opacity: number
  flipX: boolean
  flipY: boolean
}

export function defaultComposeObjectState(): ComposeObjectState {
  return { locked: false, visible: true }
}

export function resetComposeTransform<T extends ComposeTransform>(object: T): T {
  return {
    ...object,
    scale: 1,
    rotation: 0,
    opacity: 1,
    flipX: false,
    flipY: false,
  }
}

export function canTransformComposeObject(object: Pick<ComposeObjectState, 'locked' | 'visible'>): boolean {
  return object.visible && !object.locked
}
