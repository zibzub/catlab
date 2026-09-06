import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Moveable, {
  type Able,
  type MoveableManagerInterface,
  type OnDrag,
  type OnDragEnd,
  type OnDragStart,
  type OnRotate,
  type OnRotateEnd,
  type OnRotateStart,
  type OnScale,
  type OnScaleEnd,
  type OnScaleStart,
  type Renderer,
} from 'react-moveable'
import { requestScreenColor, supportsColorPicker } from '../colorPicker'
import { sampleCanvasColor } from '../colorLab'
import {
  loadComposeBackground,
  renderComposition,
  type ComposeBackground,
  type ComposePlacedCat,
  type ComposePlacedObject,
} from '../composeExport'
import { parseComposeDocument, serializeComposeDocument, type LoadedComposeDocument } from '../composeDocument'
import {
  getComposeRectanglePlacement,
  getComposeStagePoint,
  isComposePlacementDrag,
  type ComposeClientPoint,
  type ComposeRectanglePlacement,
  type ComposeStagePoint,
} from '../composePlacement'
import {
  canTransformComposeObject,
  canAddComposeLayer,
  assignNextMoonCatInstanceNumber,
  cloneComposeObjectFromSnapshot,
  createComposeClipboardSnapshot,
  createComposeObjectId,
  defaultComposeObjectState,
  getComposePastePosition,
  getNextMoonCatInstanceNumber,
  MAX_COMPOSE_LAYERS,
  moveComposeLayer,
  moveComposeLayerToIndex,
  offsetComposePosition,
  resizeComposeRectangle,
  resetComposeTransform,
  type ComposeClipboardSnapshot,
  type ComposeLayerMove,
} from '../composeModel'
import { reconcileComposeSelection, type ComposeObjectsUpdate } from '../composeHistory'
import { ComposeLayersPanel } from './ComposeLayersPanel'
import { ComposePropertiesPanel } from './ComposePropertiesPanel'
import { ComposeToolbar } from './ComposeToolbar'
import { ComposeColorSwatches } from './ComposeColorSwatches'
import { CatLabIcon } from './CatLabIcon'
import { getComposeCreationColors, type ComposeEditorColors } from '../composeColors'
import { getMoonCatAtlasCell } from '../mooncat-index/atlas'
import type { AtlasManifest, CatRecord, GridArtMode } from '../types'

interface ComposePageProps {
  sourceCats: CatRecord[]
  catalogCats: CatRecord[]
  manifest: AtlasManifest
  placedObjects: ComposePlacedObject[]
  setPlacedObjects: (update: ComposeObjectsUpdate) => void
  applyPlacedObjects: (update: ComposeObjectsUpdate) => void
  replacePlacedObjects: (placedObjects: ComposePlacedObject[]) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  historyNavigationToken: number
  onBeginTransaction: () => void
  onCommitTransaction: () => void
  onClearTransaction: () => void
  editorColors: ComposeEditorColors
  onForegroundColorChange: (color: string) => void
  onBackgroundColorChange: (color: string) => void
  onSwapEditorColors: () => void
  onResetEditorColors: () => void
  background: ComposeBackground | null
  onBackgroundChange: (background: ComposeBackground | null) => void
  onBack: () => void
}

interface PendingOpenDocument {
  document: LoadedComposeDocument
  compositionName: string
}

const ART_SCALE: Record<GridArtMode, number> = { bodies: 3, faces: 4 }
const EMPTY_STAGE_RATIO = 4 / 3
const COMPOSE_TEXT_FONT = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const DEFAULT_COMPOSE_FILENAME = 'catlab-composition'
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
type ComposeColorTarget = 'fill' | 'stroke'
type ComposeTool = 'select' | 'rectangle' | 'text' | 'eyedropper'

interface RectangleGesture {
  pointerId: number
  startClient: ComposeClientPoint
  startPoint: ComposeStagePoint
  currentPoint: ComposeStagePoint
  isDrag: boolean
}

interface RectangleDraft extends RectangleGesture {
  placement: ComposeRectanglePlacement
}

interface TextGesture {
  pointerId: number
  startClient: ComposeClientPoint
  startPoint: ComposeStagePoint
  isDrag: boolean
}

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

    return [
      React.createElement(
        'button',
        {
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
        },
        options.label,
      ),
    ]
  },
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function nextLayer(placed: ComposePlacedObject[]) {
  return placed.reduce((highest, item) => Math.max(highest, item.z), -1) + 1
}

function normalizeComposeFilename(value: string, extension: 'catlab' | 'png') {
  let filename = value.trim().replace(new RegExp(`(?:\\.${extension})+$`, 'i'), '')
  filename = filename.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-').trim()
  filename = filename.replace(/[. ]+$/g, '')

  if (
    !filename ||
    filename === '.' ||
    filename === '..' ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(filename)
  ) {
    return DEFAULT_COMPOSE_FILENAME
  }
  return filename
}

export function ComposePage({
  sourceCats,
  catalogCats,
  manifest,
  placedObjects,
  setPlacedObjects,
  applyPlacedObjects,
  replacePlacedObjects,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  historyNavigationToken,
  onBeginTransaction,
  onCommitTransaction,
  onClearTransaction,
  editorColors,
  onForegroundColorChange,
  onBackgroundColorChange,
  onSwapEditorColors,
  onResetEditorColors,
  background,
  onBackgroundChange,
  onBack,
}: ComposePageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const stageContentRef = useRef<HTMLDivElement>(null)
  const backgroundInputRef = useRef<HTMLInputElement>(null)
  const openConfirmDialogRef = useRef<HTMLDialogElement>(null)
  const openConfirmCancelRef = useRef<HTMLButtonElement>(null)
  const clearDialogRef = useRef<HTMLDialogElement>(null)
  const clearDialogCancelRef = useRef<HTMLButtonElement>(null)
  const saveDialogRef = useRef<HTMLDialogElement>(null)
  const saveFilenameInputRef = useRef<HTMLInputElement>(null)
  const exportDialogRef = useRef<HTMLDialogElement>(null)
  const exportFilenameInputRef = useRef<HTMLInputElement>(null)
  const moveableRef = useRef<Moveable>(null)
  const inlineTextEditorRef = useRef<HTMLTextAreaElement>(null)
  const rectangleScaleStartRef = useRef<{
    id: string
    x: number
    y: number
    width: number
    height: number
    scale: number
    rotation: number
    direction: [number, number]
    stageSize: { width: number; height: number }
  } | null>(null)
  const rectangleGestureRef = useRef<RectangleGesture | null>(null)
  const textGestureRef = useRef<TextGesture | null>(null)
  const selectAllInlineTextRef = useRef(false)
  const suppressStageClickRef = useRef(false)
  const suppressStageClickFrameRef = useRef<number | null>(null)
  const placedObjectsRef = useRef(placedObjects)
  const pasteCountRef = useRef(0)
  placedObjectsRef.current = placedObjects
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<ComposeTool>('select')
  const [rectangleDraft, setRectangleDraft] = useState<RectangleDraft | null>(null)
  const [composeClipboard, setComposeClipboard] = useState<ComposeClipboardSnapshot<ComposePlacedObject> | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [backgroundError, setBackgroundError] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [colorPickerBusy, setColorPickerBusy] = useState(false)
  const [stageSamplingTarget, setStageSamplingTarget] = useState<ComposeColorTarget | null>(null)
  const [stageSamplingMessage, setStageSamplingMessage] = useState<string | null>(null)
  const [documentBusy, setDocumentBusy] = useState(false)
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [openConfirmDialogOpen, setOpenConfirmDialogOpen] = useState(false)
  const [pendingOpenDocument, setPendingOpenDocument] = useState<PendingOpenDocument | null>(null)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [compositionName, setCompositionName] = useState(DEFAULT_COMPOSE_FILENAME)
  const [saveFilenameDraft, setSaveFilenameDraft] = useState(DEFAULT_COMPOSE_FILENAME)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportFilenameDraft, setExportFilenameDraft] = useState(DEFAULT_COMPOSE_FILENAME)
  const samplingCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const samplingSequenceRef = useRef(0)
  const backgroundSelectionSequenceRef = useRef(0)
  const pendingBackgroundRef = useRef<{ sequence: number; url: string } | null>(null)
  const arrowKeysRef = useRef(new Set<string>())
  const arrowTransactionRef = useRef(false)

  useEffect(
    () => () => {
      backgroundSelectionSequenceRef.current += 1
      if (pendingBackgroundRef.current) {
        URL.revokeObjectURL(pendingBackgroundRef.current.url)
        pendingBackgroundRef.current = null
      }
    },
    [],
  )

  useEffect(() => {
    const selectedStillExists = selectedId ? placedObjects.some((object) => object.id === selectedId) : true
    if (arrowTransactionRef.current && !selectedStillExists) {
      arrowKeysRef.current.clear()
      arrowTransactionRef.current = false
      onClearTransaction()
    }
    setSelectedId((current) => reconcileComposeSelection(current, placedObjects))
    setEditingTextId((current) => (current && placedObjects.some((object) => object.id === current) ? current : null))
  }, [onClearTransaction, placedObjects, selectedId])

  useEffect(() => {
    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (
        target.closest('[data-compose-id]') ||
        target.closest('.moveable-control-box') ||
        target.closest('.compose-tool-rail') ||
        target.closest('.compose-controls') ||
        target.closest('.compose-action-bar') ||
        target.closest('.compose-action-bar__name') ||
        target.closest('.compose-save-dialog')
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
    function handleKeyDown(event: KeyboardEvent) {
      if (editingTextId) return
      const target = event.target
      if (target instanceof HTMLElement) {
        const button = target.closest('button')
        const isLayerSelection = button?.matches('.compose-layer-row__select')
        if (
          target.isContentEditable ||
          target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]') ||
          (button && !target.closest('.compose-cat') && !isLayerSelection)
        ) {
          return
        }
      }

      const hasModifier = event.ctrlKey || event.metaKey
      if (hasModifier && !event.altKey) {
        const key = event.key.toLowerCase()
        const wantsUndo = key === 'z' && !event.shiftKey
        const wantsRedo = (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey)
        if (wantsUndo && canUndo) {
          event.preventDefault()
          arrowKeysRef.current.clear()
          arrowTransactionRef.current = false
          cancelActiveComposeTool()
          onUndo()
          return
        }
        if (wantsRedo && canRedo) {
          event.preventDefault()
          arrowKeysRef.current.clear()
          arrowTransactionRef.current = false
          cancelActiveComposeTool()
          onRedo()
          return
        }
      }

      if (hasModifier && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'c') {
        if (!selectedId) return
        event.preventDefault()
        copySelected()
        return
      }

      if (hasModifier && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'v') {
        if (!composeClipboard) return
        event.preventDefault()
        pasteCopied()
        return
      }

      if (!selectedId) return

      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        duplicateSelected()
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        removeSelected()
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
      const selectedObject = placedObjectsRef.current.find((item) => item.id === selectedId)
      if (!selectedObject || !canTransformComposeObject(selectedObject)) return
      if (!arrowTransactionRef.current) {
        arrowTransactionRef.current = true
        onBeginTransaction()
      }
      arrowKeysRef.current.add(event.key)
      setPlacedObjects((current) =>
        current.map((item) =>
          item.id === selectedId
            ? canTransformComposeObject(item)
              ? {
                  ...item,
                  x: clamp(item.x + (direction[0] * step) / rect.width, 0, 1),
                  y: clamp(item.y + (direction[1] * step) / rect.height, 0, 1),
                }
              : item
            : item,
        ),
      )
      window.requestAnimationFrame(() => moveableRef.current?.updateRect())
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [canRedo, canUndo, composeClipboard, editingTextId, onBeginTransaction, onRedo, onUndo, selectedId])

  useEffect(() => {
    function handleArrowKeyUp(event: KeyboardEvent) {
      if (!arrowTransactionRef.current || !arrowKeysRef.current.has(event.key)) return
      arrowKeysRef.current.delete(event.key)
      if (arrowKeysRef.current.size === 0) {
        arrowTransactionRef.current = false
        onCommitTransaction()
      }
    }

    function handleWindowBlur() {
      arrowKeysRef.current.clear()
      arrowTransactionRef.current = false
      onCommitTransaction()
    }

    document.addEventListener('keyup', handleArrowKeyUp)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      document.removeEventListener('keyup', handleArrowKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [onCommitTransaction])

  useEffect(() => {
    if (activeTool !== 'rectangle' && activeTool !== 'text' && activeTool !== 'eyedropper') return

    function handleToolEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')
      ) {
        return
      }
      event.preventDefault()
      cancelActiveComposeTool()
    }

    document.addEventListener('keydown', handleToolEscape)
    return () => document.removeEventListener('keydown', handleToolEscape)
  }, [activeTool])

  useEffect(() => {
    if (!editingTextId) return
    window.requestAnimationFrame(() => {
      const editor = inlineTextEditorRef.current
      const selectAll = selectAllInlineTextRef.current
      selectAllInlineTextRef.current = false
      editor?.focus()
      if (selectAll) editor?.select()
      else editor?.setSelectionRange(editor.value.length, editor.value.length)
    })
  }, [editingTextId])

  useEffect(() => {
    const dialog = openConfirmDialogRef.current
    if (!dialog) return
    if (!openConfirmDialogOpen) {
      if (dialog.open) dialog.close()
      return
    }

    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    window.requestAnimationFrame(() => openConfirmCancelRef.current?.focus({ preventScroll: true }))
  }, [openConfirmDialogOpen])

  useEffect(() => {
    const dialog = saveDialogRef.current
    if (!dialog) return
    if (!saveDialogOpen) {
      if (dialog.open) dialog.close()
      return
    }

    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    window.requestAnimationFrame(() => {
      saveFilenameInputRef.current?.focus({ preventScroll: true })
      saveFilenameInputRef.current?.select()
    })
  }, [saveDialogOpen])

  useEffect(() => {
    const dialog = clearDialogRef.current
    if (!dialog) return
    if (!clearDialogOpen) {
      if (dialog.open) dialog.close()
      return
    }

    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    window.requestAnimationFrame(() => clearDialogCancelRef.current?.focus({ preventScroll: true }))
  }, [clearDialogOpen])

  useEffect(() => {
    const dialog = exportDialogRef.current
    if (!dialog) return
    if (!exportDialogOpen) {
      if (dialog.open) dialog.close()
      return
    }

    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    window.requestAnimationFrame(() => {
      exportFilenameInputRef.current?.focus({ preventScroll: true })
      exportFilenameInputRef.current?.select()
    })
  }, [exportDialogOpen])

  const selected = placedObjects.find((item) => item.id === selectedId) ?? null
  const layerLimitReached = !canAddComposeLayer(placedObjects.length)
  const catalogCatsByOrder = useMemo(() => new Map(catalogCats.map((cat) => [cat.rescueOrder, cat])), [catalogCats])
  const selectedCat = selected?.kind === 'cat' ? (catalogCatsByOrder.get(selected.rescueOrder) ?? null) : null
  const colorPickerSupported = supportsColorPicker()
  const selectedDefaultColorTarget: 'fill' | null =
    selected?.kind === 'rect' || selected?.kind === 'text' ? 'fill' : null
  const stageRatio = background ? background.width / background.height : EMPTY_STAGE_RATIO
  const stageStyle = {
    '--compose-ratio': stageRatio,
  } as CSSProperties

  useEffect(() => {
    if ((activeTool === 'rectangle' || activeTool === 'text') && layerLimitReached) cancelActiveComposeTool()
  }, [activeTool, layerLimitReached])

  useEffect(() => {
    if (!historyNavigationToken) return
    const frame = window.requestAnimationFrame(() => {
      if (selected && canTransformComposeObject(selected) && !editingTextId) {
        moveableRef.current?.updateRect()
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [historyNavigationToken])

  function clearRectanglePlacement() {
    const gesture = rectangleGestureRef.current
    rectangleGestureRef.current = null
    if (gesture) releaseRectanglePointer(gesture.pointerId)
    setRectangleDraft(null)
    const frame = suppressStageClickFrameRef.current
    if (frame !== null) window.cancelAnimationFrame(frame)
    suppressStageClickFrameRef.current = null
    suppressStageClickRef.current = false
  }

  function clearTextPlacement() {
    textGestureRef.current = null
  }

  function cancelActiveComposeTool() {
    clearRectanglePlacement()
    clearTextPlacement()
    cancelStageSampling()
    setActiveTool('select')
  }

  function cancelStageSampling() {
    samplingSequenceRef.current += 1
    samplingCanvasRef.current = null
    setStageSamplingTarget(null)
    setStageSamplingMessage(null)
    setColorPickerBusy(false)
  }

  async function renderStageSamplingCanvas() {
    const stageWidth = stageRef.current?.getBoundingClientRect().width ?? 0
    if (stageWidth <= 0) throw new Error('The composition stage is not ready for sampling.')

    const blob = await renderComposition({
      placedObjects,
      catalogCats,
      manifest,
      background,
      stageWidth,
      cropMoonCatAlpha: false,
    })
    const objectUrl = URL.createObjectURL(blob)
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const loadedImage = new Image()
        loadedImage.onload = () => resolve(loadedImage)
        loadedImage.onerror = () => reject(new Error('The rendered composition could not be sampled.'))
        loadedImage.src = objectUrl
      })
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth || image.width
      canvas.height = image.naturalHeight || image.height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context || canvas.width <= 0 || canvas.height <= 0) {
        throw new Error('The composition sampler could not create a readable canvas.')
      }
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0)
      return canvas
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  async function armStageSampling(target: ComposeColorTarget) {
    if (!selected || (selected.kind !== 'rect' && selected.kind !== 'text')) return
    if (target === 'stroke' && selected.kind !== 'text') return

    finishTextEditingBeforeToolChange()
    clearRectanglePlacement()
    setActiveTool('eyedropper')
    const sequence = samplingSequenceRef.current + 1
    samplingSequenceRef.current = sequence
    setStageSamplingTarget(target)
    setStageSamplingMessage('Preparing the visible stage…')
    setColorPickerBusy(true)
    try {
      const canvas = await renderStageSamplingCanvas()
      if (samplingSequenceRef.current !== sequence) return
      samplingCanvasRef.current = canvas
      setStageSamplingMessage('Click the stage to sample a color. Press Escape to cancel.')
    } catch (error: unknown) {
      if (samplingSequenceRef.current !== sequence) return
      samplingCanvasRef.current = null
      setStageSamplingTarget(null)
      setActiveTool('select')
      setStageSamplingMessage(error instanceof Error ? error.message : 'The composition could not be sampled.')
    } finally {
      if (samplingSequenceRef.current === sequence) setColorPickerBusy(false)
    }
  }

  function sampleStageAtPoint(clientX: number, clientY: number) {
    const canvas = samplingCanvasRef.current
    const stageContent = stageContentRef.current
    const target = stageSamplingTarget
    if (!target || !canvas || !stageContent) return

    const bounds = stageContent.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return

    const x = clamp(Math.floor((clientX - bounds.left) * (canvas.width / bounds.width)), 0, canvas.width - 1)
    const y = clamp(Math.floor((clientY - bounds.top) * (canvas.height / bounds.height)), 0, canvas.height - 1)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return

    const sample = sampleCanvasColor(context, x, y)
    samplingCanvasRef.current = null
    setStageSamplingTarget(null)
    setColorPickerBusy(false)
    if (sample.alpha === 0) {
      setActiveTool('select')
      setStageSamplingMessage('That point is transparent. No color was changed.')
      return
    }

    updateSelected(target === 'fill' ? { fill: sample.hex } : { stroke: sample.hex }, true)
    setActiveTool('select')
    setStageSamplingMessage(null)
  }

  function stagePointForEvent(event: ComposeClientPoint) {
    const bounds = stageContentRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null
    return getComposeStagePoint(event, bounds)
  }

  function releaseRectanglePointer(pointerId: number) {
    const stage = stageRef.current
    if (stage?.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId)
  }

  function scheduleStageClickSuppression() {
    suppressStageClickRef.current = true
    const frame = suppressStageClickFrameRef.current
    if (frame !== null) window.cancelAnimationFrame(frame)
    suppressStageClickFrameRef.current = window.requestAnimationFrame(() => {
      suppressStageClickRef.current = false
      suppressStageClickFrameRef.current = null
    })
  }

  function finishRectanglePlacement(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = rectangleGestureRef.current
    if (!gesture) return
    if (gesture.pointerId !== event.pointerId) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const endPoint = stagePointForEvent(event)
    if (!endPoint) {
      clearRectanglePlacement()
      scheduleStageClickSuppression()
      setActiveTool('select')
      return
    }

    const isDrag = gesture.isDrag || isComposePlacementDrag(gesture.startClient, event)
    const placement = getComposeRectanglePlacement(gesture.startPoint, endPoint, isDrag)
    clearRectanglePlacement()
    scheduleStageClickSuppression()
    setActiveTool('select')

    if (!canAddComposeLayer(placedObjectsRef.current.length)) return

    const id = createComposeObjectId('rect')
    applyPlacedObjects((current) => [
      ...current,
      {
        id,
        kind: 'rect',
        ...placement,
        ...getComposeCreationColors('rect', editorColors),
        scale: 1,
        rotation: 0,
        opacity: 1,
        flipX: false,
        flipY: false,
        z: nextLayer(current),
        ...defaultComposeObjectState(),
      },
    ])
    setSelectedId(id)
  }

  function cancelRectangleGesture() {
    clearRectanglePlacement()
    setActiveTool('select')
  }

  function handleStagePointerDownCapture(event: React.PointerEvent<HTMLDivElement>) {
    if (activeTool === 'rectangle') {
      if (event.button !== 0 || rectangleGestureRef.current) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      const startPoint = stagePointForEvent(event)
      if (!startPoint) return
      event.preventDefault()
      event.stopPropagation()
      const gesture: RectangleGesture = {
        pointerId: event.pointerId,
        startClient: { clientX: event.clientX, clientY: event.clientY },
        startPoint,
        currentPoint: startPoint,
        isDrag: false,
      }
      rectangleGestureRef.current = gesture
      setRectangleDraft(null)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (activeTool === 'text') {
      if (event.button !== 0 || textGestureRef.current) {
        event.stopPropagation()
        return
      }
      const startPoint = stagePointForEvent(event)
      if (!startPoint) return
      event.stopPropagation()
      textGestureRef.current = {
        pointerId: event.pointerId,
        startClient: { clientX: event.clientX, clientY: event.clientY },
        startPoint,
        isDrag: false,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (!stageSamplingTarget) return
    event.preventDefault()
    event.stopPropagation()
  }

  function handleStagePointerMoveCapture(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = rectangleGestureRef.current
    if (!gesture) {
      const textGesture = textGestureRef.current
      if (!textGesture) return
      if (textGesture.pointerId !== event.pointerId) {
        event.stopPropagation()
        return
      }
      textGestureRef.current = {
        ...textGesture,
        isDrag: textGesture.isDrag || isComposePlacementDrag(textGesture.startClient, event),
      }
      return
    }
    if (gesture.pointerId !== event.pointerId) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const currentPoint = stagePointForEvent(event)
    if (!currentPoint) return
    const isDrag = gesture.isDrag || isComposePlacementDrag(gesture.startClient, event)
    const nextGesture = { ...gesture, currentPoint, isDrag }
    rectangleGestureRef.current = nextGesture
    setRectangleDraft(
      isDrag
        ? {
            ...nextGesture,
            placement: getComposeRectanglePlacement(gesture.startPoint, currentPoint, true),
          }
        : null,
    )
  }

  function handleStagePointerUpCapture(event: React.PointerEvent<HTMLDivElement>) {
    if (rectangleGestureRef.current) {
      finishRectanglePlacement(event)
      return
    }
    if (textGestureRef.current) {
      finishTextPlacement(event)
      return
    }
    if (!stageSamplingTarget) return
    event.preventDefault()
    event.stopPropagation()
    if (colorPickerBusy) {
      setStageSamplingMessage('The visible stage is still preparing…')
      return
    }
    sampleStageAtPoint(event.clientX, event.clientY)
  }

  function handleStagePointerCancelCapture(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = rectangleGestureRef.current
    if (!gesture) {
      if (textGestureRef.current?.pointerId === event.pointerId) clearTextPlacement()
      return
    }
    if (gesture.pointerId !== event.pointerId) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    event.preventDefault()
    event.stopPropagation()
    cancelRectangleGesture()
  }

  function handleStageLostPointerCapture(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = rectangleGestureRef.current
    if (gesture) {
      if (gesture.pointerId !== event.pointerId) return
      cancelRectangleGesture()
      return
    }
    if (textGestureRef.current?.pointerId === event.pointerId) clearTextPlacement()
  }

  function finishTextPlacement(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = textGestureRef.current
    if (!gesture) return
    if (gesture.pointerId !== event.pointerId) {
      event.stopPropagation()
      return
    }

    const isDrag = gesture.isDrag || isComposePlacementDrag(gesture.startClient, event)
    clearTextPlacement()

    if (isDrag) {
      event.stopPropagation()
      scheduleStageClickSuppression()
      return
    }

    event.preventDefault()
    event.stopPropagation()
    scheduleStageClickSuppression()
    if (!canAddComposeLayer(placedObjectsRef.current.length)) {
      setActiveTool('select')
      return
    }
    placeTextAt(gesture.startPoint)
  }

  function handleStageClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (suppressStageClickRef.current) {
      event.preventDefault()
      event.stopPropagation()
      suppressStageClickRef.current = false
      const frame = suppressStageClickFrameRef.current
      if (frame !== null) window.cancelAnimationFrame(frame)
      suppressStageClickFrameRef.current = null
    }
  }

  async function pickNativeSelectedColor(target: ComposeColorTarget) {
    if (!selected || (selected.kind !== 'rect' && selected.kind !== 'text')) return
    if (target === 'stroke' && selected.kind !== 'text') return

    cancelActiveComposeTool()
    setColorPickerBusy(true)
    try {
      const result = await requestScreenColor()
      if (result.status !== 'picked') return
      updateSelected(target === 'fill' ? { fill: result.color } : { stroke: result.color }, true)
    } finally {
      setColorPickerBusy(false)
    }
  }

  function handleColorPickClick(target: ComposeColorTarget, event: React.MouseEvent<HTMLButtonElement>) {
    if (stageSamplingTarget) {
      cancelActiveComposeTool()
      return
    }
    if (event.shiftKey && colorPickerSupported) void pickNativeSelectedColor(target)
    else void armStageSampling(target)
  }

  function addCat(cat: CatRecord) {
    if (!canAddComposeLayer(placedObjectsRef.current.length)) return
    cancelActiveComposeTool()
    const id = createComposeObjectId(String(cat.rescueOrder))
    applyPlacedObjects((current) => {
      const newCat: ComposePlacedCat = {
        id,
        kind: 'cat',
        rescueOrder: cat.rescueOrder,
        instanceNumber: getNextMoonCatInstanceNumber(current, cat.rescueOrder),
        artMode: 'bodies',
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
        opacity: 1,
        flipX: false,
        flipY: false,
        z: nextLayer(current),
        ...defaultComposeObjectState(),
      }
      return [...current, newCat]
    })
    setSelectedId(id)
  }

  function placeTextAt(point: ComposeStagePoint) {
    if (!canAddComposeLayer(placedObjectsRef.current.length)) {
      setActiveTool('select')
      return false
    }
    const id = createComposeObjectId('text')
    applyPlacedObjects((current) => [
      ...current,
      {
        id,
        kind: 'text',
        text: 'Text',
        ...getComposeCreationColors('text', editorColors),
        strokeWidth: 2,
        fontSize: 56,
        fontFamily: COMPOSE_TEXT_FONT,
        x: point.x,
        y: point.y,
        scale: 1,
        rotation: 0,
        opacity: 1,
        flipX: false,
        flipY: false,
        z: nextLayer(current),
        ...defaultComposeObjectState(),
      },
    ])
    setSelectedId(id)
    setActiveTool('select')
    selectAllInlineTextRef.current = true
    onBeginTransaction()
    setEditingTextId(id)
    return true
  }

  function activateSelectTool() {
    finishTextEditingBeforeToolChange()
    cancelActiveComposeTool()
  }

  function toggleRectangleTool() {
    if (layerLimitReached) return
    finishTextEditingBeforeToolChange()
    if (activeTool === 'rectangle') {
      cancelActiveComposeTool()
      return
    }
    clearRectanglePlacement()
    cancelStageSampling()
    setActiveTool('rectangle')
  }

  function toggleTextTool() {
    if (layerLimitReached) return
    finishTextEditingBeforeToolChange()
    if (activeTool === 'text') {
      cancelActiveComposeTool()
      return
    }
    clearRectanglePlacement()
    cancelStageSampling()
    clearTextPlacement()
    setActiveTool('text')
  }

  function copySelected() {
    if (!selectedId) return
    const source = placedObjectsRef.current.find((item) => item.id === selectedId)
    if (!source) return
    setComposeClipboard(createComposeClipboardSnapshot(source))
    pasteCountRef.current = 0
  }

  function pasteCopied() {
    if (!composeClipboard || !canAddComposeLayer(placedObjectsRef.current.length)) return
    const id = createComposeObjectId(
      `${composeClipboard.kind}-paste`,
      new Set(placedObjectsRef.current.map((object) => object.id)),
    )
    pasteCountRef.current += 1
    const position = getComposePastePosition(composeClipboard, pasteCountRef.current)
    applyPlacedObjects((current) => {
      const pasted = cloneComposeObjectFromSnapshot<ComposePlacedObject>(
        composeClipboard,
        id,
        nextLayer(current),
        position,
      )
      return [...current, assignNextMoonCatInstanceNumber(pasted, current)]
    })
    setSelectedId(id)
  }

  function duplicateSelected() {
    if (!selectedId || !canAddComposeLayer(placedObjectsRef.current.length)) return
    const id = createComposeObjectId(`${selectedId}-copy`, new Set(placedObjectsRef.current.map((object) => object.id)))

    applyPlacedObjects((current) => {
      const source = current.find((item) => item.id === selectedId)
      if (!source) return current
      const position = offsetComposePosition(source)
      const duplicate = cloneComposeObjectFromSnapshot<ComposePlacedObject>(
        createComposeClipboardSnapshot(source),
        id,
        nextLayer(current),
        position,
      )
      return [...current, assignNextMoonCatInstanceNumber(duplicate, current)]
    })
    setSelectedId(id)
  }

  function updateSelected(update: Partial<ComposePlacedObject>, commit = false) {
    if (!selectedId) return
    updateObject(selectedId, update, commit)
  }

  function removeSelected() {
    if (!selectedId) return
    applyPlacedObjects((current) => current.filter((item) => item.id !== selectedId))
    setSelectedId(null)
  }

  function updateObject(id: string, update: Partial<ComposePlacedObject>, commit = false) {
    const setObjects = commit ? applyPlacedObjects : setPlacedObjects
    setObjects((current) =>
      current.map((item) => (item.id === id ? ({ ...item, ...update } as ComposePlacedObject) : item)),
    )
    window.requestAnimationFrame(() => moveableRef.current?.updateRect())
  }

  function finishTextEditing() {
    if (!editingTextId) return
    setEditingTextId(null)
    onCommitTransaction()
    window.requestAnimationFrame(() => moveableRef.current?.updateRect())
  }

  function finishTextEditingBeforeToolChange() {
    if (editingTextId) finishTextEditing()
  }

  function handleBackground(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    const sequence = backgroundSelectionSequenceRef.current + 1
    backgroundSelectionSequenceRef.current = sequence
    if (pendingBackgroundRef.current) URL.revokeObjectURL(pendingBackgroundRef.current.url)
    const url = URL.createObjectURL(file)
    pendingBackgroundRef.current = { sequence, url }
    const image = new Image()
    image.onload = () => {
      if (pendingBackgroundRef.current?.sequence !== sequence) {
        URL.revokeObjectURL(url)
        return
      }
      pendingBackgroundRef.current = null
      onBackgroundChange({ url, width: image.naturalWidth, height: image.naturalHeight, name: file.name })
      setBackgroundError(null)
      setExportError(null)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      if (pendingBackgroundRef.current?.sequence !== sequence) return
      pendingBackgroundRef.current = null
      setBackgroundError('That image could not be read. Choose another local image.')
    }
    image.src = url
    event.currentTarget.value = ''
  }

  function openSaveDialog() {
    if (documentBusy) return
    setDocumentError(null)
    setSaveFilenameDraft(normalizeComposeFilename(compositionName, 'catlab'))
    setSaveDialogOpen(true)
  }

  function closeSaveDialog() {
    if (!documentBusy) setSaveDialogOpen(false)
  }

  function handleSaveDialogCancel(event: React.SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    closeSaveDialog()
  }

  function closeOpenConfirmDialog() {
    if (documentBusy) return
    setOpenConfirmDialogOpen(false)
    setPendingOpenDocument(null)
  }

  function openClearDialog() {
    if (placedObjects.length === 0) return
    cancelActiveComposeTool()
    setClearDialogOpen(true)
  }

  function closeClearDialog() {
    setClearDialogOpen(false)
  }

  function handleClearDialogCancel(event: React.SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    closeClearDialog()
  }

  function clearLayers() {
    cancelActiveComposeTool()
    applyPlacedObjects([])
    setSelectedId(null)
    setComposeClipboard(null)
    pasteCountRef.current = 0
    closeClearDialog()
  }

  function handleOpenConfirmCancel(event: React.SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    closeOpenConfirmDialog()
  }

  function commitOpenedDocument(candidate: PendingOpenDocument) {
    cancelActiveComposeTool()
    setEditingTextId(null)
    setSelectedId(null)
    replacePlacedObjects(candidate.document.placedObjects)
    setComposeClipboard(null)
    pasteCountRef.current = 0
    onBackgroundChange(candidate.document.background)
    setBackgroundError(null)
    setExportError(null)
    setCompositionName(candidate.compositionName)
    setOpenConfirmDialogOpen(false)
    setPendingOpenDocument(null)
  }

  function confirmOpenDocument() {
    if (documentBusy || !pendingOpenDocument) return
    setDocumentError(null)
    commitOpenedDocument(pendingOpenDocument)
  }

  function openExportDialog() {
    if (exportBusy) return
    setExportError(null)
    setExportFilenameDraft(normalizeComposeFilename(compositionName, 'png'))
    setExportDialogOpen(true)
  }

  function closeExportDialog() {
    if (!exportBusy) setExportDialogOpen(false)
  }

  function handleExportDialogCancel(event: React.SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    closeExportDialog()
  }

  async function handleSaveDocument() {
    if (documentBusy) return
    const filename = normalizeComposeFilename(saveFilenameDraft, 'catlab')
    setDocumentBusy(true)
    setDocumentError(null)
    try {
      const composeDocument = await serializeComposeDocument(placedObjects, background)
      const blob = new Blob([JSON.stringify(composeDocument, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}.catlab`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setCompositionName(filename)
      setSaveDialogOpen(false)
    } catch (error: unknown) {
      setDocumentError(error instanceof Error ? error.message : 'Could not save the composition.')
    } finally {
      setDocumentBusy(false)
    }
  }

  async function handleOpenDocument(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || documentBusy) return

    setDocumentBusy(true)
    setDocumentError(null)
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const loaded = parseComposeDocument(parsed)
      if (loaded.background) await loadComposeBackground(loaded.background.url)
      const candidate = {
        document: loaded,
        compositionName: normalizeComposeFilename(file.name, 'catlab'),
      }
      if (placedObjects.length > 0 || background) {
        setPendingOpenDocument(candidate)
        setOpenConfirmDialogOpen(true)
      } else {
        commitOpenedDocument(candidate)
      }
    } catch (error: unknown) {
      setDocumentError(error instanceof Error ? error.message : 'Could not open the composition.')
    } finally {
      setDocumentBusy(false)
    }
  }

  function moveableTargetId(target: Element) {
    return target.getAttribute('data-compose-id')
  }

  function handleMoveableDragStart(event: OnDragStart) {
    const id = moveableTargetId(event.target)
    const item = id ? placedObjectsRef.current.find((candidate) => candidate.id === id) : null
    if (item && canTransformComposeObject(item)) onBeginTransaction()
  }

  function handleMoveableDrag(event: OnDrag) {
    const rect = stageRef.current?.getBoundingClientRect()
    const id = moveableTargetId(event.target)
    if (!id || !rect) return
    setPlacedObjects((current) =>
      current.map((item) => {
        if (item.id !== id || !canTransformComposeObject(item)) return item
        return {
          ...item,
          x: clamp(item.x + event.delta[0] / rect.width, 0, 1),
          y: clamp(item.y + event.delta[1] / rect.height, 0, 1),
        }
      }),
    )
  }

  function handleMoveableDragEnd(_event: OnDragEnd) {
    onCommitTransaction()
  }

  function handleMoveableScaleStart(event: OnScaleStart) {
    const id = moveableTargetId(event.target)
    const item = id ? placedObjectsRef.current.find((candidate) => candidate.id === id) : null
    const stageBounds = stageRef.current?.getBoundingClientRect()
    if (!id || !item || !canTransformComposeObject(item) || item.kind !== 'rect') {
      if (id && item && canTransformComposeObject(item)) onBeginTransaction()
      rectangleScaleStartRef.current = null
      return
    }
    onBeginTransaction()
    rectangleScaleStartRef.current = {
      id,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      scale: item.scale,
      rotation: item.rotation,
      direction: [event.direction[0], event.direction[1]],
      stageSize: { width: stageBounds?.width ?? 0, height: stageBounds?.height ?? 0 },
    }
  }

  function handleMoveableScale(event: OnScale) {
    const id = moveableTargetId(event.target)
    if (!id) return
    setPlacedObjects((current) =>
      current.map((item) => {
        if (item.id !== id || !canTransformComposeObject(item)) return item
        if (item.kind === 'rect') {
          const start = rectangleScaleStartRef.current
          if (start?.id !== id) return item
          const resized = resizeComposeRectangle(
            start,
            [event.scale[0], event.scale[1]],
            start.direction,
            start.stageSize,
          )
          return {
            ...item,
            ...resized,
          }
        }
        return { ...item, scale: clamp(Math.abs(event.scale[0]), 0.4, 12) }
      }),
    )
  }

  function handleMoveableScaleEnd(event: OnScaleEnd) {
    if (rectangleScaleStartRef.current?.id === moveableTargetId(event.target)) {
      rectangleScaleStartRef.current = null
    }
    onCommitTransaction()
  }

  function handleMoveableRotateStart(event: OnRotateStart) {
    const id = moveableTargetId(event.target)
    const item = id ? placedObjectsRef.current.find((candidate) => candidate.id === id) : null
    if (item && canTransformComposeObject(item)) onBeginTransaction()
  }

  function handleMoveableRotate(event: OnRotate) {
    const id = moveableTargetId(event.target)
    if (!id) return
    setPlacedObjects((current) =>
      current.map((item) =>
        item.id === id && canTransformComposeObject(item) ? { ...item, rotation: event.rotation } : item,
      ),
    )
  }

  function handleMoveableRotateEnd(_event: OnRotateEnd) {
    onCommitTransaction()
  }

  function handleObjectPointerDown(event: React.PointerEvent<HTMLElement>, id: string) {
    const object = placedObjects.find((item) => item.id === id)
    if (selectedId === id || !object) return
    setSelectedId(id)
    if (!canTransformComposeObject(object)) return
    const nativeEvent = event.nativeEvent
    window.requestAnimationFrame(() => moveableRef.current?.dragStart(nativeEvent))
  }

  function reorderSelected(direction: ComposeLayerMove) {
    if (!selectedId) return
    applyPlacedObjects((current) => moveComposeLayer(current, selectedId, direction))
  }

  async function handleExport() {
    const stageWidth = stageRef.current?.getBoundingClientRect().width ?? 0
    if (stageWidth <= 0 || exportBusy) return
    const filename = normalizeComposeFilename(exportFilenameDraft, 'png')
    setExportBusy(true)
    setExportError(null)
    try {
      const blob = await renderComposition({
        placedObjects,
        catalogCats,
        manifest,
        background,
        stageWidth,
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}.png`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setExportDialogOpen(false)
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
          <button className="compose-back" type="button" onClick={onBack}>
            <CatLabIcon name="face" className="compose-back__icon" />
            <span>Collect</span>
          </button>
        </div>

        <ComposeToolbar
          compositionName={compositionName}
          onCompositionNameChange={setCompositionName}
          documentBusy={documentBusy}
          onOpenFile={handleOpenDocument}
          onSave={openSaveDialog}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
          canCopy={Boolean(selected)}
          canPaste={Boolean(composeClipboard) && !layerLimitReached}
          onCopy={copySelected}
          onPaste={pasteCopied}
          canClear={placedObjects.length > 0}
          onClear={openClearDialog}
          exportBusy={exportBusy}
          onExport={openExportDialog}
        />
        {(exportError || documentError || layerLimitReached) && (
          <div className="compose-action-status">
            <p
              className={`compose-message${documentError || exportError ? ' compose-message--error' : ''}`}
              role={documentError || exportError ? 'alert' : 'status'}
            >
              {documentError ?? exportError ?? `Maximum ${MAX_COMPOSE_LAYERS} layers`}
            </p>
          </div>
        )}

        <dialog
          ref={saveDialogRef}
          className="compose-save-dialog"
          aria-labelledby="compose-save-dialog-title"
          onCancel={handleSaveDialogCancel}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeSaveDialog()
          }}
        >
          <form
            className="compose-save-dialog__form"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSaveDocument()
            }}
          >
            <div className="compose-save-dialog__header">
              <div>
                <p className="eyebrow">CatLab document</p>
                <h2 id="compose-save-dialog-title">Save composition</h2>
              </div>
              <button
                className="compose-save-dialog__close"
                type="button"
                onClick={closeSaveDialog}
                disabled={documentBusy}
              >
                <span aria-hidden="true">×</span>
                <span className="sr-only">Cancel save</span>
              </button>
            </div>
            <label className="compose-save-dialog__label" htmlFor="compose-save-filename">
              Filename
            </label>
            <div className="compose-save-dialog__filename">
              <input
                ref={saveFilenameInputRef}
                id="compose-save-filename"
                type="text"
                value={saveFilenameDraft}
                onChange={(event) => setSaveFilenameDraft(event.currentTarget.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={documentBusy}
              />
              <span aria-hidden="true">.catlab</span>
            </div>
            {documentError && (
              <p className="compose-save-dialog__error" role="alert">
                {documentError}
              </p>
            )}
            <div className="compose-save-dialog__actions">
              <button type="button" onClick={closeSaveDialog} disabled={documentBusy}>
                Cancel
              </button>
              <button className="compose-save-dialog__save" type="submit" disabled={documentBusy}>
                {documentBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </dialog>

        <dialog
          ref={openConfirmDialogRef}
          className="compose-save-dialog compose-open-dialog"
          aria-labelledby="compose-open-dialog-title"
          onCancel={handleOpenConfirmCancel}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeOpenConfirmDialog()
          }}
        >
          <form
            className="compose-save-dialog__form"
            onSubmit={(event) => {
              event.preventDefault()
              confirmOpenDocument()
            }}
          >
            <div className="compose-save-dialog__header">
              <div>
                <p className="eyebrow">CatLab document</p>
                <h2 id="compose-open-dialog-title">Open composition?</h2>
              </div>
              <button
                className="compose-save-dialog__close"
                type="button"
                onClick={closeOpenConfirmDialog}
                disabled={documentBusy}
              >
                <span aria-hidden="true">×</span>
                <span className="sr-only">Cancel open</span>
              </button>
            </div>
            <p className="compose-open-dialog__message">Opening this file will replace the current composition.</p>
            <div className="compose-save-dialog__actions">
              <button ref={openConfirmCancelRef} type="button" onClick={closeOpenConfirmDialog} disabled={documentBusy}>
                Cancel
              </button>
              <button
                className="compose-save-dialog__save"
                type="submit"
                disabled={documentBusy || !pendingOpenDocument}
              >
                Open
              </button>
            </div>
          </form>
        </dialog>

        <dialog
          ref={exportDialogRef}
          className="compose-save-dialog compose-export-dialog"
          aria-labelledby="compose-export-dialog-title"
          onCancel={handleExportDialogCancel}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeExportDialog()
          }}
        >
          <form
            className="compose-save-dialog__form"
            onSubmit={(event) => {
              event.preventDefault()
              void handleExport()
            }}
          >
            <div className="compose-save-dialog__header">
              <div>
                <p className="eyebrow">PNG image</p>
                <h2 id="compose-export-dialog-title">Export PNG</h2>
              </div>
              <button
                className="compose-save-dialog__close"
                type="button"
                onClick={closeExportDialog}
                disabled={exportBusy}
              >
                <span aria-hidden="true">×</span>
                <span className="sr-only">Cancel export</span>
              </button>
            </div>
            <label className="compose-save-dialog__label" htmlFor="compose-export-filename">
              Filename
            </label>
            <div className="compose-save-dialog__filename">
              <input
                ref={exportFilenameInputRef}
                id="compose-export-filename"
                type="text"
                value={exportFilenameDraft}
                onChange={(event) => setExportFilenameDraft(event.currentTarget.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={exportBusy}
              />
              <span aria-hidden="true">.png</span>
            </div>
            {exportError && (
              <p className="compose-save-dialog__error" role="alert">
                {exportError}
              </p>
            )}
            <div className="compose-save-dialog__actions">
              <button type="button" onClick={closeExportDialog} disabled={exportBusy}>
                Cancel
              </button>
              <button className="compose-save-dialog__save" type="submit" disabled={exportBusy}>
                {exportBusy ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </form>
        </dialog>

        <dialog
          ref={clearDialogRef}
          className="compose-save-dialog compose-clear-dialog"
          aria-labelledby="compose-clear-dialog-title"
          onCancel={handleClearDialogCancel}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeClearDialog()
          }}
        >
          <form
            className="compose-save-dialog__form"
            onSubmit={(event) => {
              event.preventDefault()
              clearLayers()
            }}
          >
            <div className="compose-save-dialog__header">
              <div>
                <p className="eyebrow">CatLab composition</p>
                <h2 id="compose-clear-dialog-title">Clear all layers?</h2>
              </div>
              <button className="compose-save-dialog__close" type="button" onClick={closeClearDialog}>
                <span aria-hidden="true">×</span>
                <span className="sr-only">Cancel clear layers</span>
              </button>
            </div>
            <p className="compose-open-dialog__message">
              This removes all {placedObjects.length} layers from the composition. You can undo this action.
            </p>
            <div className="compose-save-dialog__actions">
              <button ref={clearDialogCancelRef} type="button" onClick={closeClearDialog}>
                Cancel
              </button>
              <button className="compose-save-dialog__danger" type="submit">
                Clear layers
              </button>
            </div>
          </form>
        </dialog>

        <div className="compose-canvas-area">
          <div className="compose-tool-rail">
            <div className="compose-tool-rail__tools" role="toolbar" aria-label="Canvas tools">
              <button
                className={`compose-tool${activeTool === 'select' ? ' is-active' : ''}`}
                type="button"
                aria-label="Select and move"
                aria-pressed={activeTool === 'select'}
                title="Select and move"
                onClick={activateSelectTool}
              >
                <span className="compose-tool__icon">
                  <CatLabIcon name="pointer-2" />
                </span>
                <span className="sr-only">Select / Move</span>
              </button>
              <button
                className={`compose-tool${activeTool === 'rectangle' ? ' is-active' : ''}`}
                type="button"
                onClick={toggleRectangleTool}
                disabled={layerLimitReached}
                aria-pressed={activeTool === 'rectangle'}
                aria-label="Rectangle tool"
                title={layerLimitReached ? `Maximum ${MAX_COMPOSE_LAYERS} layers` : 'Draw a rectangle'}
              >
                <span className="compose-tool__icon">
                  <CatLabIcon name="rectangle" />
                </span>
                <span className="sr-only">Rectangle</span>
              </button>
              <button
                className={`compose-tool${activeTool === 'text' ? ' is-active' : ''}`}
                type="button"
                onClick={toggleTextTool}
                disabled={layerLimitReached}
                aria-pressed={activeTool === 'text'}
                aria-label="Text tool"
                title={layerLimitReached ? `Maximum ${MAX_COMPOSE_LAYERS} layers` : 'Place text'}
              >
                <span className="compose-tool__icon">
                  <CatLabIcon name="text-size" />
                </span>
                <span className="sr-only">Text</span>
              </button>
              <button
                className={`compose-tool${activeTool === 'eyedropper' ? ' is-active' : ''}`}
                type="button"
                disabled={!selectedDefaultColorTarget || colorPickerBusy}
                aria-pressed={activeTool === 'eyedropper'}
                aria-label={
                  colorPickerSupported
                    ? selectedDefaultColorTarget
                      ? 'Sample color for selected layer fill'
                      : 'Select a rectangle or text layer to sample a color'
                    : selectedDefaultColorTarget
                      ? 'Sample color for selected layer fill'
                      : 'Select a rectangle or text layer to sample a color'
                }
                title={
                  colorPickerSupported
                    ? selectedDefaultColorTarget
                      ? 'Sample selected layer fill (Shift-click for screen picker)'
                      : 'Select a rectangle or text layer first'
                    : selectedDefaultColorTarget
                      ? 'Sample selected layer fill'
                      : 'Select a rectangle or text layer first'
                }
                onClick={(event) => {
                  if (selectedDefaultColorTarget) handleColorPickClick(selectedDefaultColorTarget, event)
                }}
              >
                <span className="compose-tool__icon">
                  {colorPickerBusy ? '…' : stageSamplingTarget ? '×' : <CatLabIcon name="color-picker" />}
                </span>
                <span className="sr-only">
                  {colorPickerBusy ? 'Preparing…' : stageSamplingTarget ? 'Cancel sample' : 'Eyedropper'}
                </span>
              </button>
            </div>
            <ComposeColorSwatches
              foreground={editorColors.foreground}
              background={editorColors.background}
              onForegroundChange={onForegroundColorChange}
              onBackgroundChange={onBackgroundColorChange}
              onSwap={onSwapEditorColors}
              onReset={onResetEditorColors}
            />
          </div>
          <div className="compose-stage-wrap">
            <div
              className={`compose-stage${selected ? ' compose-stage--has-selection' : ''}${stageSamplingTarget ? ' compose-stage--sampling' : ''}${activeTool === 'rectangle' ? ' compose-stage--rectangle-tool' : ''}${activeTool === 'text' ? ' compose-stage--text-tool' : ''}`}
              ref={stageRef}
              style={stageStyle}
              onPointerDownCapture={handleStagePointerDownCapture}
              onPointerMoveCapture={handleStagePointerMoveCapture}
              onPointerUpCapture={handleStagePointerUpCapture}
              onPointerCancelCapture={handleStagePointerCancelCapture}
              onLostPointerCapture={handleStageLostPointerCapture}
              onClickCapture={handleStageClickCapture}
            >
              <div className="compose-stage__content" ref={stageContentRef}>
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
                  .filter((item) => item.visible)
                  .slice()
                  .sort((a, b) => a.z - b.z)
                  .map((item) => {
                    if (item.kind === 'cat') {
                      const cat = catalogCatsByOrder.get(item.rescueOrder)
                      if (!cat) return null
                      const atlasCell = getMoonCatAtlasCell(manifest, cat.rescueOrder, item.artMode)
                      const artScale = ART_SCALE[item.artMode]
                      const spriteStyle = {
                        width: atlasCell.cellWidth * artScale,
                        height: atlasCell.cellHeight * artScale,
                        backgroundImage: `url(${atlasCell.assetUrl})`,
                        backgroundPosition: `-${atlasCell.x * artScale}px -${atlasCell.y * artScale}px`,
                        backgroundSize: `${atlasCell.atlas.width * artScale}px ${atlasCell.atlas.height * artScale}px`,
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
                          onBeginTransaction()
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
              {rectangleDraft && (
                <div
                  className="compose-stage__rectangle-draft"
                  aria-hidden="true"
                  style={{
                    left: `${rectangleDraft.placement.x * 100}%`,
                    top: `${rectangleDraft.placement.y * 100}%`,
                    width: `${rectangleDraft.placement.width * 100}%`,
                    height: `${rectangleDraft.placement.height * 100}%`,
                  }}
                />
              )}
              {activeTool === 'text' && <div className="compose-stage__tool-hint">Tap to place text</div>}
              {stageSamplingMessage && (
                <div className="compose-stage__sampling-status" role="status">
                  {stageSamplingMessage}
                </div>
              )}
              <Moveable
                ref={moveableRef}
                key={`${selectedId ?? 'none'}-${selected?.locked ? 'locked' : 'free'}-${selected?.visible ? 'visible' : 'hidden'}`}
                ables={[ComposeObjectToggleAble]}
                target={
                  activeTool === 'select' &&
                  selectedId &&
                  selected &&
                  canTransformComposeObject(selected) &&
                  !editingTextId
                    ? `[data-compose-id="${selectedId}"]`
                    : null
                }
                container={stageRef.current}
                props={{
                  composeObjectToggle:
                    selected?.kind === 'cat'
                      ? {
                          label: selected.artMode === 'bodies' ? 'Full' : 'Face',
                          nextLabel: selected.artMode === 'bodies' ? 'Face' : 'Full',
                          onToggle: () =>
                            updateSelected({ artMode: selected.artMode === 'bodies' ? 'faces' : 'bodies' }, true),
                        }
                      : undefined,
                }}
                draggable
                scalable
                keepRatio={selected?.kind !== 'rect'}
                rotatable
                origin={false}
                renderDirections={
                  selected?.kind === 'rect' ? ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'] : ['nw', 'ne', 'sw', 'se']
                }
                rotationPosition="top"
                throttleDrag={0}
                throttleScale={0}
                throttleRotate={0}
                onDragStart={handleMoveableDragStart}
                onDrag={handleMoveableDrag}
                onDragEnd={handleMoveableDragEnd}
                onScaleStart={handleMoveableScaleStart}
                onScale={handleMoveableScale}
                onScaleEnd={handleMoveableScaleEnd}
                onRotateStart={handleMoveableRotateStart}
                onRotate={handleMoveableRotate}
                onRotateEnd={handleMoveableRotateEnd}
              />
            </div>
          </div>
        </div>
      </section>

      <aside className="compose-controls" aria-label="Compose controls">
        <section className="compose-card compose-sources" aria-labelledby="compose-sources-title">
          <div className="compose-card__header">
            <div>
              <h2 id="compose-sources-title">
                <CatLabIcon name="palette" className="compose-panel-title__icon" />
                <span>Selected cats</span>
              </h2>
            </div>
            <span className="compose-count">{sourceCats.length}</span>
          </div>
          {sourceCats.length === 0 ? (
            <p className="compose-help">Select cats in the collection first. They will appear here as sources.</p>
          ) : (
            <div className="compose-source-list">
              {sourceCats.map((cat) => {
                const atlasCell = getMoonCatAtlasCell(manifest, cat.rescueOrder, 'bodies')
                const sourceScale = 2
                return (
                  <button
                    className="compose-source"
                    key={cat.rescueOrder}
                    type="button"
                    disabled={layerLimitReached}
                    onClick={() => addCat(cat)}
                    title={
                      layerLimitReached ? `Maximum ${MAX_COMPOSE_LAYERS} layers` : `Add MoonCat ${cat.rescueOrder}`
                    }
                  >
                    <span
                      className="compose-source__sprite"
                      style={{
                        backgroundImage: `url(${atlasCell.assetUrl})`,
                        backgroundPosition: `-${atlasCell.x * sourceScale}px -${atlasCell.y * sourceScale}px`,
                        backgroundSize: `${atlasCell.atlas.width * sourceScale}px ${atlasCell.atlas.height * sourceScale}px`,
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
              <h2 id="compose-background-title">
                <CatLabIcon name="photo" className="compose-panel-title__icon" />
                <span>Background</span>
              </h2>
            </div>
            {background && (
              <span className="compose-file-name" title={background.name}>
                {background.name}
              </span>
            )}
          </div>
          <label className="compose-upload">
            <span>{background ? 'Replace image' : 'Choose image'}</span>
            <input ref={backgroundInputRef} type="file" accept="image/*" onChange={handleBackground} />
          </label>
          {background && (
            <button className="compose-text-button" type="button" onClick={() => onBackgroundChange(null)}>
              Remove background
            </button>
          )}
          {backgroundError && (
            <p className="compose-message compose-message--error" role="alert">
              {backgroundError}
            </p>
          )}
          <p className="compose-export-note">
            PNG uses the background's natural pixel dimensions. Without one, export is a transparent 1200×900 canvas.
          </p>
        </section>

        <ComposeLayersPanel
          objects={placedObjects}
          manifest={manifest}
          selectedId={selectedId}
          selectedObject={selected}
          onSelect={(id) => {
            setEditingTextId(null)
            setSelectedId(id)
          }}
          onUpdate={(id, update) => updateObject(id, update, true)}
          onReorder={(id, targetIndex) =>
            applyPlacedObjects((current) => moveComposeLayerToIndex(current, id, targetIndex))
          }
          onOpacityChange={(opacity) => updateSelected({ opacity })}
          onBeginTransaction={onBeginTransaction}
          onCommitTransaction={onCommitTransaction}
        />

        <ComposePropertiesPanel
          selected={selected}
          selectedCat={selectedCat}
          textFonts={COMPOSE_TEXT_FONTS}
          layerLimitReached={layerLimitReached}
          colorPickerBusy={colorPickerBusy}
          colorPickerSupported={colorPickerSupported}
          onUpdate={updateSelected}
          onDuplicate={duplicateSelected}
          onRemove={removeSelected}
          onReorder={reorderSelected}
          onColorPick={handleColorPickClick}
          onBeginTransaction={onBeginTransaction}
          onCommitTransaction={onCommitTransaction}
        />
      </aside>
    </main>
  )
}
