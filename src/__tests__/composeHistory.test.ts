import { describe, expect, it } from 'vitest'
import type { ComposePlacedObject } from '../composeExport'
import {
  COMPOSE_HISTORY_LIMIT,
  areComposeObjectsEqual,
  composeHistoryReducer,
  createComposeHistory,
  reconcileComposeSelection,
} from '../composeHistory'

const cat = (id: string, z = 0): ComposePlacedObject => ({
  id,
  kind: 'cat',
  rescueOrder: 42,
  instanceNumber: 3,
  artMode: 'faces',
  x: 0.25,
  y: 0.75,
  scale: 1.5,
  rotation: 15,
  opacity: 0.8,
  flipX: true,
  flipY: false,
  z,
  locked: true,
  visible: false,
})

describe('Compose object history', () => {
  it('undoes and redoes a committed object change', () => {
    const initial = createComposeHistory([cat('one')])
    const changed = composeHistoryReducer(initial, { type: 'commit', update: (objects) => [...objects, cat('two', 1)] })

    expect(changed.present.placedObjects.map((object) => object.id)).toEqual(['one', 'two'])
    const undone = composeHistoryReducer(changed, { type: 'undo' })
    expect(undone.present.placedObjects.map((object) => object.id)).toEqual(['one'])
    const redone = composeHistoryReducer(undone, { type: 'redo' })
    expect(redone.present.placedObjects.map((object) => object.id)).toEqual(['one', 'two'])
  })

  it('clears redo after a new committed action', () => {
    const initial = createComposeHistory([cat('one')])
    const changed = composeHistoryReducer(initial, { type: 'commit', update: (objects) => [...objects, cat('two', 1)] })
    const undone = composeHistoryReducer(changed, { type: 'undo' })
    const branched = composeHistoryReducer(undone, {
      type: 'commit',
      update: (objects) => [...objects, cat('three', 1)],
    })

    expect(branched.future).toHaveLength(0)
    expect(composeHistoryReducer(branched, { type: 'redo' })).toBe(branched)
  })

  it('clears redo after a changed preview branch without committing it', () => {
    const initial = createComposeHistory([cat('one')])
    const committed = composeHistoryReducer(initial, {
      type: 'commit',
      update: (objects) => objects.map((object) => ({ ...object, opacity: 0.4 })),
    })
    const undone = composeHistoryReducer(committed, { type: 'undo' })
    expect(undone.future).toHaveLength(1)

    const previewed = composeHistoryReducer(undone, {
      type: 'preview',
      update: (objects) => objects.map((object) => ({ ...object, opacity: 0.6 })),
    })

    expect(previewed.future).toHaveLength(0)
    expect(previewed.present.placedObjects[0].opacity).toBe(0.6)
    expect(previewed.past).toHaveLength(0)
  })

  it('keeps redo after an identical preview branch', () => {
    const initial = createComposeHistory([cat('one')])
    const committed = composeHistoryReducer(initial, {
      type: 'commit',
      update: (objects) => objects.map((object) => ({ ...object, opacity: 0.4 })),
    })
    const undone = composeHistoryReducer(committed, { type: 'undo' })
    const previewed = composeHistoryReducer(undone, {
      type: 'preview',
      update: (objects) => objects.map((object) => ({ ...object })),
    })

    expect(previewed).toBe(undone)
    expect(previewed.future).toHaveLength(1)
  })

  it('caps history and ignores structurally identical updates', () => {
    let history = createComposeHistory([cat('one')])
    history = composeHistoryReducer(history, { type: 'commit', update: (objects) => objects })
    expect(history.past).toHaveLength(0)

    for (let index = 0; index < COMPOSE_HISTORY_LIMIT + 5; index += 1) {
      history = composeHistoryReducer(history, {
        type: 'commit',
        update: (objects) => objects.map((object) => ({ ...object, x: index / 100 })),
      })
    }

    expect(history.past).toHaveLength(COMPOSE_HISTORY_LIMIT)
  })

  it('keeps stored snapshots independent from later live updates', () => {
    const initial = createComposeHistory([cat('one')])
    const changed = composeHistoryReducer(initial, {
      type: 'commit',
      update: (objects) => objects.map((object) => ({ ...object, opacity: 0.2 })),
    })
    const previewed = composeHistoryReducer(changed, {
      type: 'preview',
      update: (objects) => objects.map((object) => ({ ...object, opacity: 0.4 })),
    })

    expect(previewed.present.placedObjects[0].opacity).toBe(0.4)
    expect(previewed.past[0].placedObjects[0].opacity).toBe(0.8)
    expect(previewed.past[0].placedObjects[0]).toMatchObject({ instanceNumber: 3, locked: true, visible: false })
  })

  it('replaces a loaded document and clears both history directions', () => {
    const changed = composeHistoryReducer(createComposeHistory([cat('one')]), {
      type: 'commit',
      update: (objects) => [...objects, cat('two', 1)],
    })
    const undone = composeHistoryReducer(changed, { type: 'undo' })
    const replaced = composeHistoryReducer(undone, { type: 'replace', placedObjects: [cat('loaded', 4)] })

    expect(replaced.past).toHaveLength(0)
    expect(replaced.future).toHaveLength(0)
    expect(replaced.present.placedObjects[0].id).toBe('loaded')
  })

  it('reconciles selection without making it historical', () => {
    const objects = [cat('kept'), cat('other', 1)]
    expect(reconcileComposeSelection('kept', objects)).toBe('kept')
    expect(reconcileComposeSelection('removed', objects)).toBeNull()
    expect(reconcileComposeSelection(null, objects)).toBeNull()
    expect(
      areComposeObjectsEqual(
        objects,
        objects.map((object) => ({ ...object })),
      ),
    ).toBe(true)
  })
})
