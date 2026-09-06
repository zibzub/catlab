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

  it('coalesces multiple previews into one committed transaction', () => {
    const initial = createComposeHistory([cat('one')])
    const started = composeHistoryReducer(initial, { type: 'beginTransaction' })
    const previewed = composeHistoryReducer(started, {
      type: 'preview',
      update: (objects) => objects.map((object) => ({ ...object, x: 0.4 })),
    })
    const previewedAgain = composeHistoryReducer(previewed, {
      type: 'preview',
      update: (objects) => objects.map((object) => ({ ...object, x: 0.6 })),
    })
    const committed = composeHistoryReducer(previewedAgain, { type: 'commitTransaction' })

    expect(committed.past).toHaveLength(1)
    expect(committed.present.placedObjects[0].x).toBe(0.6)
    expect(committed.transaction).toBeNull()
    expect(composeHistoryReducer(committed, { type: 'undo' }).present.placedObjects[0].x).toBe(0.25)
  })

  it('does not record a transaction that stays at its baseline', () => {
    const initial = createComposeHistory([cat('one')])
    const started = composeHistoryReducer(initial, { type: 'beginTransaction' })
    const noOpPreview = composeHistoryReducer(started, {
      type: 'preview',
      update: (objects) => objects.map((object) => ({ ...object })),
    })
    expect(noOpPreview).toBe(started)
    const noOpCommitted = composeHistoryReducer(noOpPreview, { type: 'commitTransaction' })
    expect(noOpCommitted.past).toHaveLength(0)

    const restarted = composeHistoryReducer(noOpCommitted, { type: 'beginTransaction' })
    const previewed = composeHistoryReducer(restarted, {
      type: 'preview',
      update: (objects) => objects.map((object) => ({ ...object, x: 0.4 })),
    })
    const returned = composeHistoryReducer(previewed, {
      type: 'preview',
      update: (objects) => objects.map((object) => ({ ...object, x: 0.25 })),
    })
    const committed = composeHistoryReducer(returned, { type: 'commitTransaction' })

    expect(committed.past).toHaveLength(0)
    expect(committed.future).toHaveLength(0)
    expect(committed.transaction).toBeNull()
  })

  it('clones a transaction baseline and safely ignores duplicate starts', () => {
    const initial = createComposeHistory([cat('one')])
    const started = composeHistoryReducer(initial, { type: 'beginTransaction' })
    const duplicateStart = composeHistoryReducer(started, { type: 'beginTransaction' })
    const previewed = composeHistoryReducer(duplicateStart, {
      type: 'preview',
      update: (objects) => objects.map((object) => ({ ...object, x: 0.4 })),
    })

    expect(duplicateStart).toBe(started)
    expect(previewed.transaction?.placedObjects[0].x).toBe(0.25)
    expect(previewed.present.placedObjects[0].x).toBe(0.4)
  })

  it('clears redo when a changed transaction branches after Undo', () => {
    const initial = createComposeHistory([cat('one')])
    const committed = composeHistoryReducer(initial, {
      type: 'commit',
      update: (objects) => objects.map((object) => ({ ...object, x: 0.4 })),
    })
    const undone = composeHistoryReducer(committed, { type: 'undo' })
    const started = composeHistoryReducer(undone, { type: 'beginTransaction' })
    const previewed = composeHistoryReducer(started, {
      type: 'preview',
      update: (objects) => objects.map((object) => ({ ...object, x: 0.6 })),
    })
    const branched = composeHistoryReducer(previewed, { type: 'commitTransaction' })

    expect(branched.future).toHaveLength(0)
    expect(branched.present.placedObjects[0].x).toBe(0.6)
  })

  it('preserves redo when a transaction returns to its baseline', () => {
    const initial = createComposeHistory([cat('one')])
    const committed = composeHistoryReducer(initial, {
      type: 'commit',
      update: (objects) => objects.map((object) => ({ ...object, x: 0.4 })),
    })
    const undone = composeHistoryReducer(committed, { type: 'undo' })
    const started = composeHistoryReducer(undone, { type: 'beginTransaction' })
    const previewed = composeHistoryReducer(started, {
      type: 'preview',
      update: (objects) => objects.map((object) => ({ ...object, x: 0.6 })),
    })
    const returned = composeHistoryReducer(previewed, {
      type: 'preview',
      update: (objects) => objects.map((object) => ({ ...object, x: 0.25 })),
    })
    const completed = composeHistoryReducer(returned, { type: 'commitTransaction' })

    expect(completed.future).toHaveLength(1)
    expect(composeHistoryReducer(completed, { type: 'redo' }).present.placedObjects[0].x).toBe(0.4)
  })

  it('clears a transaction when replacing an opened document', () => {
    const started = composeHistoryReducer(createComposeHistory([cat('one')]), { type: 'beginTransaction' })
    const replaced = composeHistoryReducer(started, { type: 'replace', placedObjects: [cat('loaded')] })

    expect(replaced.transaction).toBeNull()
    expect(replaced.past).toHaveLength(0)
    expect(replaced.future).toHaveLength(0)
  })

  it('commits an active transaction before Undo and treats a missing transaction as a no-op', () => {
    const initial = createComposeHistory([cat('one')])
    const committed = composeHistoryReducer(initial, {
      type: 'commit',
      update: (objects) => objects.map((object) => ({ ...object, x: 0.4 })),
    })
    const undone = composeHistoryReducer(committed, { type: 'undo' })
    const started = composeHistoryReducer(undone, { type: 'beginTransaction' })
    const previewed = composeHistoryReducer(started, {
      type: 'preview',
      update: (objects) => objects.map((object) => ({ ...object, x: 0.6 })),
    })
    const undoneTransaction = composeHistoryReducer(previewed, { type: 'undo' })

    expect(undoneTransaction.present.placedObjects[0].x).toBe(0.25)
    expect(undoneTransaction.transaction).toBeNull()
    expect(composeHistoryReducer(undoneTransaction, { type: 'commitTransaction' })).toBe(undoneTransaction)
  })

  it('caps transaction history at the existing limit', () => {
    let history = createComposeHistory([cat('one')])
    for (let index = 1; index <= COMPOSE_HISTORY_LIMIT + 5; index += 1) {
      history = composeHistoryReducer(history, { type: 'beginTransaction' })
      history = composeHistoryReducer(history, {
        type: 'preview',
        update: (objects) => objects.map((object) => ({ ...object, x: index / 100 })),
      })
      history = composeHistoryReducer(history, { type: 'commitTransaction' })
    }

    expect(history.past).toHaveLength(COMPOSE_HISTORY_LIMIT)
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
