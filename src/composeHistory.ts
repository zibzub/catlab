import type { ComposePlacedObject } from './composeExport'

export const COMPOSE_HISTORY_LIMIT = 50

export type ComposeObjectsUpdate = ComposePlacedObject[] | ((current: ComposePlacedObject[]) => ComposePlacedObject[])

export interface ComposeHistorySnapshot {
  placedObjects: ComposePlacedObject[]
}

export interface ComposeHistoryState {
  past: ComposeHistorySnapshot[]
  present: ComposeHistorySnapshot
  future: ComposeHistorySnapshot[]
}

export type ComposeHistoryAction =
  | { type: 'preview'; update: ComposeObjectsUpdate }
  | { type: 'commit'; update: ComposeObjectsUpdate }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace'; placedObjects: ComposePlacedObject[] }

function cloneObject(object: ComposePlacedObject): ComposePlacedObject {
  return { ...object }
}

export function cloneComposeObjects(objects: ComposePlacedObject[]): ComposePlacedObject[] {
  return objects.map(cloneObject)
}

export function createComposeHistory(placedObjects: ComposePlacedObject[] = []): ComposeHistoryState {
  return {
    past: [],
    present: { placedObjects: cloneComposeObjects(placedObjects) },
    future: [],
  }
}

function cloneSnapshot(snapshot: ComposeHistorySnapshot): ComposeHistorySnapshot {
  return { placedObjects: cloneComposeObjects(snapshot.placedObjects) }
}

function resolveUpdate(current: ComposePlacedObject[], update: ComposeObjectsUpdate) {
  return Array.isArray(update) ? update : update(cloneComposeObjects(current))
}

export function areComposeObjectsEqual(a: ComposePlacedObject[], b: ComposePlacedObject[]) {
  if (a.length !== b.length) return false
  return a.every((object, index) => {
    const other = b[index]
    if (!other || object.kind !== other.kind) return false
    const keys = Object.keys(object) as Array<keyof ComposePlacedObject>
    return keys.length === Object.keys(other).length && keys.every((key) => object[key] === other[key])
  })
}

function pushBounded(entries: ComposeHistorySnapshot[], snapshot: ComposeHistorySnapshot) {
  return [...entries, cloneSnapshot(snapshot)].slice(-COMPOSE_HISTORY_LIMIT)
}

export function composeHistoryReducer(state: ComposeHistoryState, action: ComposeHistoryAction): ComposeHistoryState {
  if (action.type === 'replace') return createComposeHistory(action.placedObjects)

  if (action.type === 'undo') {
    if (state.past.length === 0) return state
    const previous = state.past[state.past.length - 1]
    return {
      past: state.past.slice(0, -1),
      present: cloneSnapshot(previous),
      future: [cloneSnapshot(state.present), ...state.future].slice(0, COMPOSE_HISTORY_LIMIT),
    }
  }

  if (action.type === 'redo') {
    if (state.future.length === 0) return state
    const next = state.future[0]
    return {
      past: pushBounded(state.past, state.present),
      present: cloneSnapshot(next),
      future: state.future.slice(1),
    }
  }

  const nextObjects = resolveUpdate(state.present.placedObjects, action.update)
  if (areComposeObjectsEqual(state.present.placedObjects, nextObjects)) return state

  const nextPresent = { placedObjects: cloneComposeObjects(nextObjects) }
  if (action.type === 'preview') {
    return { ...state, present: nextPresent, future: [] }
  }

  return {
    past: pushBounded(state.past, state.present),
    present: nextPresent,
    future: [],
  }
}

export function reconcileComposeSelection(selectedId: string | null, placedObjects: ComposePlacedObject[]) {
  if (!selectedId) return null
  return placedObjects.some((object) => object.id === selectedId) ? selectedId : null
}
