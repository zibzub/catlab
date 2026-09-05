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

export const MAX_COMPOSE_LAYERS = 40

export function canAddComposeLayer(currentCount: number) {
  return currentCount < MAX_COMPOSE_LAYERS
}

export type ComposeClipboardSnapshot<T extends { id: string; z: number }> = T extends unknown
  ? Omit<T, 'id' | 'z'>
  : never

export function createComposeClipboardSnapshot<T extends { id: string; z: number }>(
  object: T,
): ComposeClipboardSnapshot<T> {
  const { id: _id, z: _z, ...snapshot } = object
  return snapshot as ComposeClipboardSnapshot<T>
}

export function createComposeObjectId(prefix: string, existingIds?: ReadonlySet<string>) {
  let id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  while (existingIds?.has(id)) {
    id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  }
  return id
}

export function offsetComposePosition(position: { x: number; y: number }) {
  const offset = (value: number) =>
    value > 0.92 ? clampComposePosition(value - 0.04) : clampComposePosition(value + 0.04)
  return { x: offset(position.x), y: offset(position.y) }
}

export function resizeComposeRectangle(
  start: {
    x: number
    y: number
    width: number
    height: number
    scale: number
    rotation: number
  },
  scale: readonly [number, number],
  direction: readonly [number, number],
  stageSize: { width: number; height: number },
) {
  const startWidth = clampComposePosition(start.width * Math.abs(start.scale), 0.04, 1.5)
  const startHeight = clampComposePosition(start.height * Math.abs(start.scale), 0.04, 1.5)
  const widthScale = direction[0] === 0 ? 1 : Math.max(0, scale[0])
  const heightScale = direction[1] === 0 ? 1 : Math.max(0, scale[1])
  const width = clampComposePosition(startWidth * widthScale, 0.04, 1.5)
  const height = clampComposePosition(startHeight * heightScale, 0.04, 1.5)

  const localShiftX = (direction[0] * (width - startWidth) * stageSize.width) / 2
  const localShiftY = (direction[1] * (height - startHeight) * stageSize.height) / 2
  const rotation = (start.rotation * Math.PI) / 180
  const worldShiftX = localShiftX * Math.cos(rotation) - localShiftY * Math.sin(rotation)
  const worldShiftY = localShiftX * Math.sin(rotation) + localShiftY * Math.cos(rotation)

  return {
    x: stageSize.width > 0 ? clampComposePosition(start.x + worldShiftX / stageSize.width) : start.x,
    y: stageSize.height > 0 ? clampComposePosition(start.y + worldShiftY / stageSize.height) : start.y,
    width,
    height,
    scale: 1,
  }
}

export function getComposePastePosition(origin: { x: number; y: number }, pasteNumber: number) {
  const advance = (value: number) => {
    const direction = value > 0.92 ? -1 : 1
    const next = value + direction * 0.04 * pasteNumber
    if (next >= 0 && next <= 1) return next
    return ((next % 1) + 1) % 1
  }
  return { x: advance(origin.x), y: advance(origin.y) }
}

export function cloneComposeObjectFromSnapshot<T extends { id: string; z: number; x: number; y: number }>(
  snapshot: ComposeClipboardSnapshot<T>,
  id: string,
  z: number,
  position: { x: number; y: number },
): T {
  return { ...snapshot, id, z, ...position } as T
}

function clampComposePosition(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
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

function orderComposeLayersBackToFront<T extends { z: number }>(objects: T[]): T[] {
  return objects
    .map((object, index) => ({ object, index }))
    .sort((a, b) => a.object.z - b.object.z || a.index - b.index)
    .map(({ object }) => object)
}

function moveOrderedComposeLayer<T>(objects: T[], sourceIndex: number, targetIndex: number): T[] {
  if (sourceIndex === targetIndex) return objects
  const movedObjects = [...objects]
  const [moved] = movedObjects.splice(sourceIndex, 1)
  movedObjects.splice(targetIndex, 0, moved)
  return movedObjects
}

export function moveComposeLayer<T extends { id: string; z: number }>(
  objects: T[],
  id: string,
  direction: ComposeLayerMove,
): T[] {
  const ordered = orderComposeLayersBackToFront(objects)
  const index = ordered.findIndex((object) => object.id === id)
  if (index < 0) return objects

  let target = index
  if (direction === 'forward') target = Math.min(index + 1, ordered.length - 1)
  if (direction === 'backward') target = Math.max(index - 1, 0)
  if (direction === 'front') target = ordered.length - 1
  if (direction === 'back') target = 0
  if (target === index) return objects

  return moveOrderedComposeLayer(ordered, index, target).map((object, z) => ({ ...object, z }))
}

/** Move a layer to a front-to-back list position (0 is frontmost). */
export function moveComposeLayerToIndex<T extends { id: string; z: number }>(
  objects: T[],
  id: string,
  targetIndex: number,
): T[] {
  const ordered = orderComposeLayers(objects)
  const sourceIndex = ordered.findIndex((object) => object.id === id)
  if (sourceIndex < 0) return objects

  const clampedIndex = Math.max(0, Math.min(targetIndex, ordered.length - 1))
  if (sourceIndex === clampedIndex) return objects

  const movedObjects = moveOrderedComposeLayer(ordered, sourceIndex, clampedIndex)
  return movedObjects
    .slice()
    .reverse()
    .map((object, z) => ({ ...object, z }))
}
