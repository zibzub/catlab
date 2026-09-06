import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { getMoonCatAtlasCell } from '../mooncat-index/atlas'
import { orderComposeLayers } from '../composeModel'
import type { ComposePlacedObject } from '../composeExport'
import type { AtlasManifest } from '../types'
import { CatLabIcon } from './CatLabIcon'

interface ComposeLayersPanelProps {
  objects: ComposePlacedObject[]
  manifest: AtlasManifest
  selectedId: string | null
  selectedObject: ComposePlacedObject | null
  onSelect: (id: string) => void
  onUpdate: (id: string, update: Partial<ComposePlacedObject>) => void
  onReorder: (id: string, targetIndex: number) => void
  onOpacityChange: (opacity: number) => void
  onBeginTransaction: () => void
  onCommitTransaction: () => void
}

export function getComposeLayerLabel(object: ComposePlacedObject) {
  if (object.kind === 'cat') {
    return `MoonCat ${object.rescueOrder}${object.instanceNumber > 1 ? ` (${object.instanceNumber})` : ''}`
  }
  if (object.kind === 'rect') return 'Rectangle'
  return 'Text'
}

export function getComposeLayerDescription(object: ComposePlacedObject) {
  if (object.kind === 'cat') return object.artMode === 'faces' ? 'Face' : 'Full'
  if (object.kind === 'rect') return object.fill
  const excerpt = object.text.trim().replace(/\s+/g, ' ')
  return excerpt || 'Empty text'
}

function LayerPreview({ object, manifest }: { object: ComposePlacedObject; manifest: AtlasManifest }) {
  if (object.kind === 'cat') {
    const cell = getMoonCatAtlasCell(manifest, object.rescueOrder, object.artMode)
    const scale = 32 / Math.max(cell.cellWidth, cell.cellHeight)
    const style: CSSProperties = {
      backgroundImage: `url(${cell.assetUrl})`,
      backgroundPosition: `-${cell.x * scale}px -${cell.y * scale}px`,
      backgroundSize: `${cell.atlas.width * scale}px ${cell.atlas.height * scale}px`,
    }
    return (
      <span className="compose-layer-row__preview compose-layer-row__preview--cat" style={style} aria-hidden="true" />
    )
  }

  if (object.kind === 'rect') {
    return (
      <span
        className="compose-layer-row__preview compose-layer-row__preview--rect"
        style={{ backgroundColor: object.fill }}
        aria-hidden="true"
      />
    )
  }

  return (
    <span className="compose-layer-row__preview compose-layer-row__preview--text" aria-hidden="true">
      T
    </span>
  )
}

export function ComposeLayersPanel({
  objects,
  manifest,
  selectedId,
  selectedObject,
  onSelect,
  onUpdate,
  onReorder,
  onOpacityChange,
  onBeginTransaction,
  onCommitTransaction,
}: ComposeLayersPanelProps) {
  const [open, setOpen] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [dropIndicatorTop, setDropIndicatorTop] = useState<number | null>(null)
  const dragRef = useRef<{ id: string; pointerId: number; targetIndex: number } | null>(null)
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const listRef = useRef<HTMLDivElement | null>(null)
  const autoScrollFrameRef = useRef<number | null>(null)
  const pointerYRef = useRef<number | null>(null)
  const orderedObjects = orderComposeLayers(objects)
  const orderedObjectsRef = useRef(orderedObjects)
  orderedObjectsRef.current = orderedObjects

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const index = orderedObjects.findIndex((object) => object.id === id)
    if (index < 0) return
    pointerYRef.current = event.clientY
    dragRef.current = { id, pointerId: event.pointerId, targetIndex: index }
    setDraggingId(id)
    setDropIndex(index)
  }

  useEffect(() => {
    if (!draggingId) return

    const updateDropIndex = (clientY: number) => {
      const drag = dragRef.current
      if (!drag) return
      const candidates = orderedObjectsRef.current.filter((object) => object.id !== drag.id)
      let targetIndex = candidates.length
      for (let index = 0; index < candidates.length; index += 1) {
        const row = rowRefs.current.get(candidates[index].id)
        if (!row) continue
        const bounds = row.getBoundingClientRect()
        if (clientY < bounds.top + bounds.height / 2) {
          targetIndex = index
          break
        }
      }
      const list = listRef.current
      const targetRow = candidates[targetIndex] ? rowRefs.current.get(candidates[targetIndex].id) : null
      const lastRow = candidates.length > 0 ? rowRefs.current.get(candidates[candidates.length - 1].id) : null
      if (!list || (!targetRow && !lastRow)) {
        setDropIndicatorTop(null)
      } else {
        const listBounds = list.getBoundingClientRect()
        const rowBounds = (targetRow ?? lastRow)!.getBoundingClientRect()
        const boundary = targetRow ? rowBounds.top : rowBounds.bottom
        setDropIndicatorTop(boundary - listBounds.top + list.scrollTop)
      }
      drag.targetIndex = targetIndex
      setDropIndex(targetIndex)
    }

    const stopAutoScroll = () => {
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current)
        autoScrollFrameRef.current = null
      }
    }

    const autoScroll = () => {
      const list = listRef.current
      const pointerY = pointerYRef.current
      const drag = dragRef.current
      if (!list || pointerY === null || !drag) {
        autoScrollFrameRef.current = null
        return
      }

      const bounds = list.getBoundingClientRect()
      const edgeZone = 36
      const maxStep = 12
      let step = 0
      if (pointerY < bounds.top + edgeZone && list.scrollTop > 0) {
        step = -Math.min(maxStep, Math.max(2, ((bounds.top + edgeZone - pointerY) / edgeZone) * maxStep))
      } else if (pointerY > bounds.bottom - edgeZone && list.scrollTop + list.clientHeight < list.scrollHeight - 1) {
        step = Math.min(maxStep, Math.max(2, ((pointerY - (bounds.bottom - edgeZone)) / edgeZone) * maxStep))
      }

      if (step === 0) {
        autoScrollFrameRef.current = null
        return
      }

      list.scrollTop += step
      updateDropIndex(pointerY)
      autoScrollFrameRef.current = window.requestAnimationFrame(autoScroll)
    }

    const updatePointerPosition = (clientY: number) => {
      pointerYRef.current = clientY
      updateDropIndex(clientY)
      if (autoScrollFrameRef.current === null) autoScrollFrameRef.current = window.requestAnimationFrame(autoScroll)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragRef.current?.pointerId) return
      event.preventDefault()
      updatePointerPosition(event.clientY)
    }

    const finishDrag = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      stopAutoScroll()
      dragRef.current = null
      pointerYRef.current = null
      setDraggingId(null)
      setDropIndex(null)
      setDropIndicatorTop(null)
      if (event.type === 'pointerup') onReorder(drag.id, drag.targetIndex)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('pointercancel', finishDrag)
    if (pointerYRef.current !== null) updateDropIndex(pointerYRef.current)
    return () => {
      stopAutoScroll()
      pointerYRef.current = null
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishDrag)
      window.removeEventListener('pointercancel', finishDrag)
    }
  }, [draggingId, onReorder])

  const renderRow = (object: ComposePlacedObject) => {
    const label = getComposeLayerLabel(object)
    const description = getComposeLayerDescription(object)
    const primary = object.kind === 'text' ? description : label
    const secondary = object.kind === 'text' ? label : description
    return (
      <div
        className={`compose-layer-row${selectedId === object.id ? ' is-selected' : ''}${draggingId === object.id ? ' is-dragging' : ''}`}
        role="listitem"
        key={object.id}
        ref={(node) => {
          if (node) rowRefs.current.set(object.id, node)
          else rowRefs.current.delete(object.id)
        }}
      >
        <button
          className="compose-layer-row__drag"
          type="button"
          aria-label={`Drag to reorder ${label} layer`}
          title="Drag to reorder"
          onPointerDown={(event) => beginDrag(event, object.id)}
        >
          <span aria-hidden="true">⠿</span>
        </button>
        <button
          className="compose-layer-row__select"
          type="button"
          aria-label={`Select ${label} layer`}
          aria-pressed={selectedId === object.id}
          onClick={() => onSelect(object.id)}
        >
          <LayerPreview object={object} manifest={manifest} />
          <span className="compose-layer-row__copy">
            <strong title={primary}>{primary}</strong>
            <span title={secondary}>{secondary}</span>
          </span>
        </button>
        <span className="compose-layer-row__actions">
          <button
            className="compose-layer-row__control"
            type="button"
            aria-label={`${object.visible ? 'Hide' : 'Show'} ${label}`}
            title={`${object.visible ? 'Hide' : 'Show'} ${label}`}
            onClick={(event) => {
              event.stopPropagation()
              onUpdate(object.id, { visible: !object.visible })
            }}
          >
            <CatLabIcon name={object.visible ? 'eye' : 'eye-off'} className="compose-layer-row__icon" />
          </button>
          <button
            className="compose-layer-row__control"
            type="button"
            aria-label={`${object.locked ? 'Unlock' : 'Lock'} ${label}`}
            title={`${object.locked ? 'Unlock' : 'Lock'} ${label}`}
            onClick={(event) => {
              event.stopPropagation()
              onUpdate(object.id, { locked: !object.locked })
            }}
          >
            <CatLabIcon name={object.locked ? 'lock' : 'lock-open'} className="compose-layer-row__icon" />
          </button>
        </span>
      </div>
    )
  }

  return (
    <details
      className="compose-card compose-layers"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="compose-card__header compose-layers__summary">
        <span>
          <h2>
            <CatLabIcon name="box-multiple" className="compose-panel-title__icon" />
            <span>Layers</span>
          </h2>
          <small>Front to back</small>
        </span>
        <span className="compose-count">{objects.length}</span>
      </summary>
      <label className="compose-range compose-layers__opacity">
        <span>
          Opacity <output>{selectedObject ? `${Math.round(selectedObject.opacity * 100)}%` : '—'}</output>
        </span>
        <input
          aria-label="Selected object opacity"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={selectedObject?.opacity ?? 1}
          disabled={!selectedObject}
          onFocus={onBeginTransaction}
          onKeyDown={onBeginTransaction}
          onPointerDown={onBeginTransaction}
          onPointerUp={onCommitTransaction}
          onKeyUp={onCommitTransaction}
          onBlur={onCommitTransaction}
          onChange={(event) => onOpacityChange(Number(event.currentTarget.value))}
        />
      </label>
      {orderedObjects.length === 0 ? (
        <p className="compose-help">Add an object to see it here.</p>
      ) : (
        <div ref={listRef} className="compose-layer-list" role="list" aria-label="Composition layers">
          {orderedObjects.map(renderRow)}
          {draggingId && dropIndex !== null && dropIndicatorTop !== null && (
            <div className="compose-layer-drop-indicator" style={{ top: `${dropIndicatorTop}px` }} aria-hidden="true" />
          )}
        </div>
      )}
    </details>
  )
}
