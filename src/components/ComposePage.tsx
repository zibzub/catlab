import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import Moveable, { type Able, type MoveableManagerInterface, type OnDrag, type OnRotate, type OnScale, type OnScaleStart, type Renderer } from 'react-moveable'
import { renderComposition, type ComposeBackground, type ComposePlacedObject, type ComposePlacedRect } from '../composeExport'
import { assetPath } from '../data'
import type { AtlasManifest, CatRecord, GridArtMode } from '../types'

interface ComposePageProps {
  cats: CatRecord[]
  manifest: AtlasManifest
  placedObjects: ComposePlacedObject[]
  setPlacedObjects: Dispatch<SetStateAction<ComposePlacedObject[]>>
  background: ComposeBackground | null
  onBackgroundChange: (background: ComposeBackground | null) => void
  onBack: () => void
}

const ART_SCALE: Record<GridArtMode, number> = { bodies: 3, faces: 4 }
const EMPTY_STAGE_RATIO = 4 / 3
const COMPOSE_TEXT_FONT = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const COMPOSE_TEXT_FONTS = [
  { label: 'System sans', value: COMPOSE_TEXT_FONT },
  { label: 'System serif', value: 'ui-serif, Georgia, Cambria, "Times New Roman", serif' },
  { label: 'Monospace', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
  { label: 'Pixel Operator', value: '"Pixel Operator", monospace' },
  { label: 'Pixel Operator Bold', value: '"Pixel Operator Bold", monospace' },
  { label: 'Press Start 2P', value: '"Press Start 2P", monospace' },
  { label: 'Setback', value: '"Setback TT (BRK)", monospace' },
  { label: 'Anton (Impact-like)', value: 'Anton, sans-serif' },
  { label: 'Arimo (Arial-like)', value: 'Arimo, Arial, sans-serif' },
  { label: 'Roboto (Helvetica-like)', value: 'Roboto, Arial, sans-serif' },
] as const

interface ComposeObjectToggleOptions {
  label: string
  nextLabel: string
  onToggle: () => void
}

interface ComposeObjectToggleProps {
  composeObjectToggle?: ComposeObjectToggleOptions
}

const ComposeObjectToggleAble: Able<ComposeObjectToggleProps> = {
  name: 'composeObjectToggle',
  props: ['composeObjectToggle'],
  events: [],
  render(moveable: MoveableManagerInterface<ComposeObjectToggleProps>, React: Renderer) {
    const options = moveable.props.composeObjectToggle
    if (!options) return []

    const { renderPoses, rotation } = moveable.getState()
    const x = (renderPoses[2][0] + renderPoses[3][0]) / 2
    const y = (renderPoses[2][1] + renderPoses[3][1]) / 2 + 26
    const zoom = moveable.props.zoom ?? 1

    return [React.createElement('button', {
      key: 'compose-object-toggle',
      className: 'moveable-compose-object-toggle',
      type: 'button',
      'aria-label': `${options.label} view. Switch to ${options.nextLabel}.`,
      title: `Switch to ${options.nextLabel}`,
      style: {
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}rad) scale(${zoom})`,
      },
      onPointerDown: (event: Event) => event.stopPropagation(),
      onClick: (event: Event) => {
        event.preventDefault()
        event.stopPropagation()
        options.onToggle()
      },
    }, options.label)]
  },
}

function atlasSheetPath(atlas: AtlasManifest['atlas'] | AtlasManifest['faceAtlas'], sheet: number) {
  const filename = atlas.pattern.replace('{sheet:03}', String(sheet).padStart(3, '0'))
  return assetPath(`${atlas.directory}/${filename}`)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function nextLayer(placed: ComposePlacedObject[]) {
  return placed.reduce((highest, item) => Math.max(highest, item.z), -1) + 1
}

export function ComposePage({ cats, manifest, placedObjects, setPlacedObjects, background, onBackgroundChange, onBack }: ComposePageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const backgroundInputRef = useRef<HTMLInputElement>(null)
  const moveableRef = useRef<Moveable>(null)
  const inlineTextEditorRef = useRef<HTMLTextAreaElement>(null)
  const rectangleScaleStartRef = useRef<{ id: string; width: number; height: number; scale: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [backgroundError, setBackgroundError] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (
        target.closest('[data-compose-id]') ||
        target.closest('.moveable-control-box') ||
        target.closest('.compose-controls')
      ) {
        return
      }
      setEditingTextId(null)
      setSelectedId(null)
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown)
    return () => document.removeEventListener('pointerdown', handleDocumentPointerDown)
  }, [])

  useEffect(() => {
    if (!selectedId) return

    function handleKeyDown(event: KeyboardEvent) {
      if (editingTextId) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        ((target.matches('button, input, textarea, select') && !target.matches('.compose-cat')) || target.isContentEditable)
      ) {
        return
      }

      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        duplicateSelected()
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        setPlacedObjects((current) => current.filter((item) => item.id !== selectedId))
        setSelectedId(null)
        return
      }

      const directions: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }
      const direction = directions[event.key]
      const rect = stageRef.current?.getBoundingClientRect()
      if (!direction || !rect) return

      event.preventDefault()
      const step = event.shiftKey ? 10 : 1
      setPlacedObjects((current) => current.map((item) => item.id === selectedId
        ? {
            ...item,
            x: clamp(item.x + (direction[0] * step) / rect.width, 0, 1),
            y: clamp(item.y + (direction[1] * step) / rect.height, 0, 1),
          }
        : item))
      window.requestAnimationFrame(() => moveableRef.current?.updateRect())
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editingTextId, selectedId])

  useEffect(() => {
    if (!editingTextId) return
    window.requestAnimationFrame(() => {
      const editor = inlineTextEditorRef.current
      editor?.focus()
      editor?.setSelectionRange(editor.value.length, editor.value.length)
    })
  }, [editingTextId])

  const selected = placedObjects.find((item) => item.id === selectedId) ?? null
  const selectedCat = selected?.kind === 'cat' ? cats.find((cat) => cat.rescueOrder === selected.rescueOrder) ?? null : null
  const stageRatio = background ? background.width / background.height : EMPTY_STAGE_RATIO
  const stageStyle = {
    '--compose-ratio': stageRatio,
  } as CSSProperties

  const sourceCats = cats

  function addCat(cat: CatRecord) {
    const id = `${cat.rescueOrder}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setPlacedObjects((current) => [...current, {
      id,
      kind: 'cat',
      rescueOrder: cat.rescueOrder,
      artMode: 'bodies',
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      opacity: 1,
      flipX: false,
      flipY: false,
      z: nextLayer(current),
    }])
    setSelectedId(id)
  }

  function addText() {
    const id = `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setPlacedObjects((current) => [...current, {
      id,
      kind: 'text',
      text: 'Text',
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2,
      fontSize: 56,
      fontFamily: COMPOSE_TEXT_FONT,
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      opacity: 1,
      flipX: false,
      flipY: false,
      z: nextLayer(current),
    }])
    setSelectedId(id)
  }

  function addRectangle() {
    const id = `rect-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setPlacedObjects((current) => {
      const rectangle: ComposePlacedRect = {
        id,
        kind: 'rect',
        width: 0.28,
        height: 0.2,
        fill: '#e5e5ee',
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
        opacity: 1,
        flipX: false,
        flipY: false,
        z: nextLayer(current),
      }
      return [...current, rectangle]
    })
    setSelectedId(id)
  }

  function duplicateSelected() {
    if (!selectedId) return
    const id = `${selectedId}-copy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const offsetPosition = (value: number) => value > 0.92
      ? clamp(value - 0.04, 0, 1)
      : clamp(value + 0.04, 0, 1)

    setPlacedObjects((current) => {
      const source = current.find((item) => item.id === selectedId)
      if (!source) return current
      return [...current, {
        ...source,
        id,
        x: offsetPosition(source.x),
        y: offsetPosition(source.y),
        z: nextLayer(current),
      }]
    })
    setSelectedId(id)
  }

  function updateSelected(update: Partial<ComposePlacedObject>) {
    if (!selectedId) return
    setPlacedObjects((current) => current.map((item) => (item.id === selectedId ? { ...item, ...update } as ComposePlacedObject : item)))
    window.requestAnimationFrame(() => moveableRef.current?.updateRect())
  }

  function finishTextEditing() {
    if (!editingTextId) return
    setEditingTextId(null)
    window.requestAnimationFrame(() => moveableRef.current?.updateRect())
  }

  function handleBackground(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      onBackgroundChange({ url, width: image.naturalWidth, height: image.naturalHeight, name: file.name })
      setBackgroundError(null)
      setExportError(null)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      setBackgroundError('That image could not be read. Choose another local image.')
    }
    image.src = url
    event.currentTarget.value = ''
  }

  function moveableTargetId(target: Element) {
    return target.getAttribute('data-compose-id')
  }

  function handleMoveableDrag(event: OnDrag) {
    const rect = stageRef.current?.getBoundingClientRect()
    const id = moveableTargetId(event.target)
    if (!id || !rect) return
    setPlacedObjects((current) => current.map((item) => {
      if (item.id !== id) return item
      return {
        ...item,
        x: clamp(item.x + event.delta[0] / rect.width, 0, 1),
        y: clamp(item.y + event.delta[1] / rect.height, 0, 1),
      }
    }))
  }

  function handleMoveableScaleStart(event: OnScaleStart) {
    const id = moveableTargetId(event.target)
    const item = id ? placedObjects.find((candidate) => candidate.id === id) : null
    if (!id || item?.kind !== 'rect') {
      rectangleScaleStartRef.current = null
      return
    }
    rectangleScaleStartRef.current = { id, width: item.width, height: item.height, scale: item.scale }
  }

  function handleMoveableScale(event: OnScale) {
    const id = moveableTargetId(event.target)
    if (!id) return
    setPlacedObjects((current) => current.map((item) => {
      if (item.id !== id) return item
      if (item.kind === 'rect') {
        const start = rectangleScaleStartRef.current?.id === id
          ? rectangleScaleStartRef.current
          : { width: item.width, height: item.height, scale: item.scale }
        return {
          ...item,
          width: clamp(start.width * start.scale * Math.abs(event.scale[0]), 0.04, 1.5),
          height: clamp(start.height * start.scale * Math.abs(event.scale[1]), 0.04, 1.5),
          scale: 1,
        }
      }
      return { ...item, scale: clamp(Math.abs(event.scale[0]), 0.4, 12) }
    }))
  }

  function handleMoveableRotate(event: OnRotate) {
    const id = moveableTargetId(event.target)
    if (!id) return
    setPlacedObjects((current) => current.map((item) => item.id === id
      ? { ...item, rotation: event.rotation }
      : item))
  }

  function handleObjectPointerDown(event: React.PointerEvent<HTMLElement>, id: string) {
    if (selectedId === id) return
    setSelectedId(id)
    const nativeEvent = event.nativeEvent
    window.requestAnimationFrame(() => moveableRef.current?.dragStart(nativeEvent))
  }

  function reorderSelected(direction: 'forward' | 'backward' | 'front' | 'back') {
    if (!selectedId) return
    setPlacedObjects((current) => {
      const ordered = [...current].sort((a, b) => a.z - b.z)
      const index = ordered.findIndex((item) => item.id === selectedId)
      if (index < 0) return current
      let target = index
      if (direction === 'forward') target = Math.min(index + 1, ordered.length - 1)
      if (direction === 'backward') target = Math.max(index - 1, 0)
      if (direction === 'front') target = ordered.length - 1
      if (direction === 'back') target = 0
      if (target === index) return current
      const [moved] = ordered.splice(index, 1)
      ordered.splice(target, 0, moved)
      return ordered.map((item, z) => ({ ...item, z }))
    })
  }

  async function handleExport() {
    const stageWidth = stageRef.current?.getBoundingClientRect().width ?? 0
    if (stageWidth <= 0 || exportBusy) return
    setExportBusy(true)
    setExportError(null)
    try {
      const blob = await renderComposition({
        placedObjects,
        cats,
        manifest,
        background,
        stageWidth,
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'catlab-composition.png'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (error: unknown) {
      setExportError(error instanceof Error ? error.message : 'Could not export the composition.')
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <main className="compose-page">
      <section className="compose-workspace" aria-labelledby="compose-title">
        <div className="compose-heading">
          <div>
            <h1 id="compose-title">Compose</h1>
            <p>Build a simple scene from your Palette. Everything stays in this browser.</p>
          </div>
          <button className="compose-back" type="button" onClick={onBack}>← Collection</button>
        </div>

        <div className="compose-action-bar" aria-label="Composition actions">
          <div className="compose-action-bar__title">
            <strong>Composition</strong>
          </div>
          <div className="compose-action-bar__future" aria-label="Project actions coming soon">
            <button type="button" disabled title="Open projects are coming soon">Open</button>
            <button type="button" disabled title="Save projects are coming soon">Save</button>
          </div>
          <div className="compose-action-bar__actions">
            <button
              className="compose-clear"
              type="button"
              disabled={placedObjects.length === 0}
              onClick={() => { setPlacedObjects([]); setSelectedId(null) }}
            >
              Clear composition
            </button>
            <button className="compose-export" type="button" disabled={exportBusy} onClick={handleExport}>
              {exportBusy ? 'Preparing…' : 'Export PNG'}
            </button>
          </div>
        </div>
        {exportError && (
          <div className="compose-action-status">
            <p className="compose-message compose-message--error" role="alert">{exportError}</p>
          </div>
        )}

        <div className="compose-canvas-area">
          <nav className="compose-tool-rail" aria-label="Canvas tools">
            <button className="compose-tool is-active" type="button" aria-label="Select and move" aria-pressed="true" title="Select and move">
              <span className="compose-tool__icon" aria-hidden="true">↖</span>
              <span className="compose-tool__label">Select / Move</span>
            </button>
            <button className="compose-tool" type="button" onClick={addRectangle} aria-label="Add rectangle" title="Add rectangle">
              <span className="compose-tool__icon" aria-hidden="true">□</span>
              <span className="compose-tool__label">Rectangle</span>
            </button>
            <button className="compose-tool" type="button" onClick={addText} aria-label="Add text" title="Add text">
              <span className="compose-tool__icon" aria-hidden="true">T</span>
              <span className="compose-tool__label">Text</span>
            </button>
            <button className="compose-tool" type="button" disabled aria-label="Eyedropper tool coming soon" title="Eyedropper tool coming soon">
              <span className="compose-tool__icon" aria-hidden="true">⌖</span>
              <span className="compose-tool__label">Eyedropper</span>
            </button>
          </nav>
          <div className="compose-stage-wrap">
            <div
              className={`compose-stage${selected ? ' compose-stage--has-selection' : ''}`}
              ref={stageRef}
              style={stageStyle}
            >
              <div className="compose-stage__content">
                {background ? (
                  <img className="compose-stage__background" src={background.url} alt="" draggable="false" />
                ) : (
                  <button
                    className="compose-stage__empty"
                    type="button"
                    onClick={() => backgroundInputRef.current?.click()}
                    aria-label="Choose a background image"
                  >
                    <span>+</span>
                    <strong>Add a background</strong>
                    <small>Your local image will fit this stage.</small>
                  </button>
                )}
                {placedObjects
                  .slice()
                  .sort((a, b) => a.z - b.z)
                  .map((item) => {
                if (item.kind === 'cat') {
                  const cat = cats.find((candidate) => candidate.rescueOrder === item.rescueOrder)
                  if (!cat) return null
                  const atlas = item.artMode === 'faces' ? manifest.faceAtlas : manifest.atlas
                  const cell = cat.rescueOrder % atlas.catsPerAtlas
                  const sheet = Math.floor(cat.rescueOrder / atlas.catsPerAtlas)
                  const column = cell % atlas.columns
                  const row = Math.floor(cell / atlas.columns)
                  const artScale = ART_SCALE[item.artMode]
                  const spriteStyle = {
                    width: atlas.cellWidth * artScale,
                    height: atlas.cellHeight * artScale,
                    backgroundImage: `url(${atlasSheetPath(atlas, sheet)})`,
                    backgroundPosition: `-${column * atlas.cellWidth * artScale}px -${row * atlas.cellHeight * artScale}px`,
                    backgroundSize: `${atlas.width * artScale}px ${atlas.height * artScale}px`,
                    opacity: item.opacity,
                    left: `${item.x * 100}%`,
                    top: `${item.y * 100}%`,
                    zIndex: item.z + 1,
                    transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale * (item.flipX ? -1 : 1)}, ${item.scale * (item.flipY ? -1 : 1)})`,
                  } as CSSProperties
                  return (
                    <button
                      className="compose-cat"
                      key={item.id}
                      type="button"
                      aria-label={`MoonCat ${cat.rescueOrder}, ${item.artMode === 'faces' ? 'Face' : 'Full'}`}
                      data-compose-id={item.id}
                      style={spriteStyle}
                      onPointerDown={(event) => handleObjectPointerDown(event, item.id)}
                      onClick={() => setSelectedId(item.id)}
                    />
                  )
                }

                if (item.kind === 'rect') {
                  const rectangleStyle = {
                    left: `${item.x * 100}%`,
                    top: `${item.y * 100}%`,
                    width: `${item.width * 100}%`,
                    height: `${item.height * 100}%`,
                    zIndex: item.z + 1,
                    opacity: item.opacity,
                    backgroundColor: item.fill,
                    transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale * (item.flipX ? -1 : 1)}, ${item.scale * (item.flipY ? -1 : 1)})`,
                  } as CSSProperties
                  return (
                    <div
                      className="compose-rectangle"
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      aria-label="Rectangle layer"
                      data-compose-id={item.id}
                      style={rectangleStyle}
                      onPointerDown={(event) => handleObjectPointerDown(event, item.id)}
                      onClick={() => setSelectedId(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedId(item.id)
                        }
                      }}
                    />
                  )
                }

                const textStyle = {
                  left: `${item.x * 100}%`,
                  top: `${item.y * 100}%`,
                  zIndex: item.z + 1,
                  color: item.fill,
                  fontFamily: item.fontFamily,
                  fontSize: `${item.fontSize}px`,
                  lineHeight: 1.1,
                  opacity: item.opacity,
                  paintOrder: 'stroke fill',
                  textAlign: 'center',
                  whiteSpace: 'pre-wrap',
                  WebkitTextStroke: `${item.strokeWidth}px ${item.stroke}`,
                  transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale * (item.flipX ? -1 : 1)}, ${item.scale * (item.flipY ? -1 : 1)})`,
                } as CSSProperties
                if (editingTextId === item.id) {
                  return (
                    <textarea
                      ref={inlineTextEditorRef}
                      className="compose-text compose-text-editor"
                      key={item.id}
                      aria-label="Edit text layer"
                      data-compose-id={item.id}
                      rows={Math.max(3, item.text.split('\n').length)}
                      value={item.text}
                      style={{
                        ...textStyle,
                        width: 'min(70vw, 420px)',
                        maxWidth: 'calc(100vw - 48px)',
                        minHeight: '100px',
                        color: item.fill,
                        paintOrder: 'normal',
                        WebkitTextStroke: '0 transparent',
                      }}
                      onChange={(event) => updateSelected({ text: event.currentTarget.value })}
                      onBlur={finishTextEditing}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          finishTextEditing()
                        }
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                    />
                  )
                }
                return (
                  <div
                    className="compose-text"
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Text layer: ${item.text}`}
                    data-compose-id={item.id}
                    style={textStyle}
                    onPointerDown={(event) => handleObjectPointerDown(event, item.id)}
                    onClick={() => setSelectedId(item.id)}
                    onDoubleClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setSelectedId(item.id)
                      setEditingTextId(item.id)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedId(item.id)
                      }
                    }}
                  >
                    {item.text}
                  </div>
                )
                  })}
              </div>
              <Moveable
                ref={moveableRef}
                ables={[ComposeObjectToggleAble]}
                target={selectedId && !editingTextId ? `[data-compose-id="${selectedId}"]` : null}
                container={stageRef.current}
                props={{
                  composeObjectToggle: selected?.kind === 'cat' ? {
                    label: selected.artMode === 'bodies' ? 'Full' : 'Face',
                    nextLabel: selected.artMode === 'bodies' ? 'Face' : 'Full',
                    onToggle: () => updateSelected({ artMode: selected.artMode === 'bodies' ? 'faces' : 'bodies' }),
                  } : undefined,
                }}
                draggable
                scalable
                keepRatio={selected?.kind !== 'rect'}
                rotatable
                origin={false}
                renderDirections={['nw', 'ne', 'sw', 'se']}
                rotationPosition="top"
                throttleDrag={0}
                throttleScale={0}
                throttleRotate={0}
                onDrag={handleMoveableDrag}
                onScaleStart={handleMoveableScaleStart}
                onScale={handleMoveableScale}
                onRotate={handleMoveableRotate}
              />
            </div>
          </div>
        </div>
      </section>

      <aside className="compose-controls" aria-label="Compose controls">
        <section className="compose-card compose-sources" aria-labelledby="compose-sources-title">
          <div className="compose-card__header">
            <div>
              <h2 id="compose-sources-title">Selected cats</h2>
            </div>
            <span className="compose-count">{sourceCats.length}</span>
          </div>
          {sourceCats.length === 0 ? (
            <p className="compose-help">Select cats in the collection first. They will appear here as sources.</p>
          ) : (
            <div className="compose-source-list">
              {sourceCats.map((cat) => {
                const atlas = manifest.atlas
                const cell = cat.rescueOrder % atlas.catsPerAtlas
                const sheet = Math.floor(cat.rescueOrder / atlas.catsPerAtlas)
                const column = cell % atlas.columns
                const row = Math.floor(cell / atlas.columns)
                const sourceScale = 2
                return (
                  <button
                    className="compose-source"
                    key={cat.rescueOrder}
                    type="button"
                    onClick={() => addCat(cat)}
                    title={`Add MoonCat ${cat.rescueOrder}`}
                  >
                    <span
                      className="compose-source__sprite"
                      style={{
                        backgroundImage: `url(${atlasSheetPath(atlas, sheet)})`,
                        backgroundPosition: `-${column * atlas.cellWidth * sourceScale}px -${row * atlas.cellHeight * sourceScale}px`,
                        backgroundSize: `${atlas.width * sourceScale}px ${atlas.height * sourceScale}px`,
                      }}
                      aria-hidden="true"
                    />
                    <strong>{cat.rescueOrder}</strong>
                  </button>
                )
              })}
            </div>
          )}
          <p className="compose-help">Tap a source to add another instance. Repeats are allowed.</p>
        </section>

        <section className="compose-card compose-background" aria-labelledby="compose-background-title">
          <div className="compose-card__header">
            <div>
              <h2 id="compose-background-title">Background</h2>
            </div>
            {background && <span className="compose-file-name" title={background.name}>{background.name}</span>}
          </div>
          <label className="compose-upload">
            <span>{background ? 'Replace image' : 'Choose image'}</span>
            <input ref={backgroundInputRef} type="file" accept="image/*" onChange={handleBackground} />
          </label>
          {background && <button className="compose-text-button" type="button" onClick={() => onBackgroundChange(null)}>Remove background</button>}
          {backgroundError && <p className="compose-message compose-message--error" role="alert">{backgroundError}</p>}
          <p className="compose-export-note">PNG uses the background's natural pixel dimensions. Without one, export is a transparent 1200×900 canvas.</p>
        </section>

        <section className="compose-card compose-selected" aria-labelledby="compose-selected-title">
          <div className="compose-card__header">
            <div>
              <h2 id="compose-selected-title">Selected layer</h2>
            </div>
            {selected && <span className="compose-layer-number">{selected.z + 1}</span>}
          </div>
          {!selected ? (
            <p className="compose-help">Select a placed object to edit its content, style, layer, and transforms.</p>
          ) : (
            <>
              <div className="compose-selected-id">
                {selected.kind === 'cat' && selectedCat ? (
                  <>
                    <strong>MoonCat {selectedCat.rescueOrder}</strong>
                    <span>{selectedCat.catId}</span>
                  </>
                ) : selected.kind === 'rect' ? (
                  <>
                    <strong>Rectangle layer</strong>
                    <span>Editable rectangle object</span>
                  </>
                ) : (
                  <>
                    <strong>Text layer</strong>
                    <span>Editable text object</span>
                  </>
                )}
              </div>
              {selected.kind === 'cat' && (
                <div className="compose-art-options" role="group" aria-label="Placed cat art">
                  <button type="button" className={selected.artMode === 'bodies' ? 'is-active' : ''} aria-pressed={selected.artMode === 'bodies'} onClick={() => updateSelected({ artMode: 'bodies' })}>Full</button>
                  <button type="button" className={selected.artMode === 'faces' ? 'is-active' : ''} aria-pressed={selected.artMode === 'faces'} onClick={() => updateSelected({ artMode: 'faces' })}>Face</button>
                </div>
              )}
              {selected.kind === 'text' && (
                <div className="compose-text-options">
                  <label className="compose-text-field">
                    <span>Text</span>
                    <textarea rows={3} value={selected.text} onChange={(event) => updateSelected({ text: event.currentTarget.value })} />
                  </label>
                  <label className="compose-text-field">
                    <span>Font family</span>
                    <select value={selected.fontFamily} onChange={(event) => updateSelected({ fontFamily: event.currentTarget.value })}>
                      {COMPOSE_TEXT_FONTS.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}
                    </select>
                  </label>
                  <div className="compose-color-options">
                    <label className="compose-color-field">
                      <input type="color" value={selected.fill} onChange={(event) => updateSelected({ fill: event.currentTarget.value })} />
                      <span>Fill</span>
                    </label>
                    <label className="compose-color-field">
                      <input type="color" value={selected.stroke} onChange={(event) => updateSelected({ stroke: event.currentTarget.value })} />
                      <span>Outline</span>
                    </label>
                  </div>
                  <label className="compose-range">
                    <span>Outline width <output>{selected.strokeWidth.toFixed(1)} px</output></span>
                    <input type="range" min="0" max="16" step="0.5" value={selected.strokeWidth} onChange={(event) => updateSelected({ strokeWidth: Number(event.currentTarget.value) })} />
                  </label>
                  <label className="compose-range">
                    <span>Font size <output>{selected.fontSize} px</output></span>
                    <input type="range" min="12" max="240" step="1" value={selected.fontSize} onChange={(event) => updateSelected({ fontSize: Number(event.currentTarget.value) })} />
                  </label>
                </div>
              )}
              {selected.kind === 'rect' && (
                <div className="compose-color-options compose-rectangle-options">
                  <label className="compose-color-field">
                    <input type="color" value={selected.fill} onChange={(event) => updateSelected({ fill: event.currentTarget.value })} />
                    <span>Fill</span>
                  </label>
                </div>
              )}
              <div className="compose-art-options compose-flip-options" role="group" aria-label="Flip selected object">
                <button type="button" className={selected.flipX ? 'is-active' : ''} aria-pressed={selected.flipX} onClick={() => updateSelected({ flipX: !selected.flipX })}>Flip Horizontal</button>
                <button type="button" className={selected.flipY ? 'is-active' : ''} aria-pressed={selected.flipY} onClick={() => updateSelected({ flipY: !selected.flipY })}>Flip Vertical</button>
              </div>
              <div className="compose-object-actions">
                <button className="compose-duplicate" type="button" onClick={duplicateSelected}>Duplicate selected</button>
              </div>
              <label className="compose-range">
                <span>Opacity <output>{Math.round(selected.opacity * 100)}%</output></span>
                <input aria-label="Selected object opacity" type="range" min="0" max="1" step="0.01" value={selected.opacity} onChange={(event) => updateSelected({ opacity: Number(event.currentTarget.value) })} />
              </label>
              <label className="compose-range">
                <span>Scale <output>{selected.scale.toFixed(2)}×</output></span>
                <input type="range" min="0.4" max="12" step="0.05" value={selected.scale} onChange={(event) => updateSelected({ scale: Number(event.currentTarget.value) })} />
              </label>
              <label className="compose-range">
                <span>Rotation <output>{selected.rotation}°</output></span>
                <input type="range" min="-180" max="180" step="1" value={selected.rotation} onChange={(event) => updateSelected({ rotation: Number(event.currentTarget.value) })} />
              </label>
              <div className="compose-layer-actions" role="group" aria-label="Layer order">
                <button type="button" onClick={() => reorderSelected('back')}>Back</button>
                <button type="button" onClick={() => reorderSelected('backward')}>Behind</button>
                <button type="button" onClick={() => reorderSelected('forward')}>Forward</button>
                <button type="button" onClick={() => reorderSelected('front')}>Front</button>
              </div>
              <button className="compose-remove" type="button" onClick={() => { setPlacedObjects((current) => current.filter((item) => item.id !== selected.id)); setSelectedId(null) }}>Remove selected</button>
            </>
          )}
        </section>

      </aside>
    </main>
  )
}
