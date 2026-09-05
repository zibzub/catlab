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

export type ComposeLayerMove = 'forward' | 'backward' | 'front' | 'back'

export function orderComposeLayers<T extends { z: number }>(objects: T[]): T[] {
  return objects
    .map((object, index) => ({ object, index }))
    .sort((a, b) => b.object.z - a.object.z || a.index - b.index)
    .map(({ object }) => object)
}

export function moveComposeLayer<T extends { id: string; z: number }>(
  objects: T[],
  id: string,
  direction: ComposeLayerMove,
): T[] {
  const ordered = objects
    .map((object, index) => ({ object, index }))
    .sort((a, b) => a.object.z - b.object.z || a.index - b.index)
    .map(({ object }) => object)
  const index = ordered.findIndex((object) => object.id === id)
  if (index < 0) return objects

  let target = index
  if (direction === 'forward') target = Math.min(index + 1, ordered.length - 1)
  if (direction === 'backward') target = Math.max(index - 1, 0)
  if (direction === 'front') target = ordered.length - 1
  if (direction === 'back') target = 0
  if (target === index) return objects

  const [moved] = ordered.splice(index, 1)
  ordered.splice(target, 0, moved)
  return ordered.map((object, z) => ({ ...object, z }))
}
