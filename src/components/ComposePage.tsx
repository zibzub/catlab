import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import Moveable, { type Able, type MoveableManagerInterface, type OnDrag, type OnRotate, type OnScale, type OnScaleStart, type Renderer } from 'react-moveable'
import { requestScreenColor, supportsColorPicker } from '../colorPicker'
import { sampleCanvasColor } from '../colorLab'
import { loadComposeBackground, renderComposition, type ComposeBackground, type ComposePlacedObject, type ComposePlacedRect } from '../composeExport'
import { parseComposeDocument, serializeComposeDocument, type LoadedComposeDocument } from '../composeDocument'
import { getMoonCatAtlasCell } from '../mooncat-index/atlas'
import type { AtlasManifest, CatRecord, GridArtMode } from '../types'

interface ComposePageProps {
  sourceCats: CatRecord[]
  catalogCats: CatRecord[]
  manifest: AtlasManifest
  placedObjects: ComposePlacedObject[]
  setPlacedObjects: Dispatch<SetStateAction<ComposePlacedObject[]>>
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

  if (!filename || filename === '.' || filename === '..' || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(filename)) {
    return DEFAULT_COMPOSE_FILENAME
  }
  return filename
}

export function ComposePage({ sourceCats, catalogCats, manifest, placedObjects, setPlacedObjects, background, onBackgroundChange, onBack }: ComposePageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const stageContentRef = useRef<HTMLDivElement>(null)
  const backgroundInputRef = useRef<HTMLInputElement>(null)
  const openInputRef = useRef<HTMLInputElement>(null)
  const openConfirmDialogRef = useRef<HTMLDialogElement>(null)
  const openConfirmCancelRef = useRef<HTMLButtonElement>(null)
  const saveDialogRef = useRef<HTMLDialogElement>(null)
  const saveFilenameInputRef = useRef<HTMLInputElement>(null)
  const exportDialogRef = useRef<HTMLDialogElement>(null)
  const exportFilenameInputRef = useRef<HTMLInputElement>(null)
  const moveableRef = useRef<Moveable>(null)
  const inlineTextEditorRef = useRef<HTMLTextAreaElement>(null)
  const rectangleScaleStartRef = useRef<{ id: string; width: number; height: number; scale: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [compositionName, setCompositionName] = useState(DEFAULT_COMPOSE_FILENAME)
  const [saveFilenameDraft, setSaveFilenameDraft] = useState(DEFAULT_COMPOSE_FILENAME)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportFilenameDraft, setExportFilenameDraft] = useState(DEFAULT_COMPOSE_FILENAME)
  const samplingCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const samplingSequenceRef = useRef(0)
  const backgroundSelectionSequenceRef = useRef(0)
  const pendingBackgroundRef = useRef<{ sequence: number; url: string } | null>(null)

  useEffect(() => () => {
    backgroundSelectionSequenceRef.current += 1
    if (pendingBackgroundRef.current) {
      URL.revokeObjectURL(pendingBackgroundRef.current.url)
      pendingBackgroundRef.current = null
    }
  }, [])

  useEffect(() => {
    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (
        target.closest('[data-compose-id]') ||
        target.closest('.moveable-control-box') ||
        target.closest('.compose-tool-rail') ||
        target.closest('.compose-controls') ||
        target.closest('.compose-action-bar__document') ||
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
    if (!stageSamplingTarget) return

    function handleSamplingKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      samplingSequenceRef.current += 1
      samplingCanvasRef.current = null
      setStageSamplingTarget(null)
      setStageSamplingMessage(null)
      setColorPickerBusy(false)
    }

    document.addEventListener('keydown', handleSamplingKeyDown)
    return () => document.removeEventListener('keydown', handleSamplingKeyDown)
  }, [stageSamplingTarget])

  useEffect(() => {
    if (!editingTextId) return
    window.requestAnimationFrame(() => {
      const editor = inlineTextEditorRef.current
      editor?.focus()
      editor?.setSelectionRange(editor.value.length, editor.value.length)
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
  const catalogCatsByOrder = useMemo(
    () => new Map(catalogCats.map((cat) => [cat.rescueOrder, cat])),
    [catalogCats],
  )
  const selectedCat = selected?.kind === 'cat' ? catalogCatsByOrder.get(selected.rescueOrder) ?? null : null
  const colorPickerSupported = supportsColorPicker()
  const selectedDefaultColorTarget: 'fill' | null = selected?.kind === 'rect' || selected?.kind === 'text' ? 'fill' : null
  const stageRatio = background ? background.width / background.height : EMPTY_STAGE_RATIO
  const stageStyle = {
    '--compose-ratio': stageRatio,
  } as CSSProperties

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
      setStageSamplingMessage('That point is transparent. No color was changed.')
      return
    }

    updateSelected(target === 'fill' ? { fill: sample.hex } : { stroke: sample.hex })
    setStageSamplingMessage(null)
  }

  function handleStagePointerDownCapture(event: React.PointerEvent<HTMLDivElement>) {
    if (!stageSamplingTarget) return
    event.preventDefault()
    event.stopPropagation()
  }

  function handleStagePointerUpCapture(event: React.PointerEvent<HTMLDivElement>) {
    if (!stageSamplingTarget) return
    event.preventDefault()
    event.stopPropagation()
    if (colorPickerBusy) {
      setStageSamplingMessage('The visible stage is still preparing…')
      return
    }
    sampleStageAtPoint(event.clientX, event.clientY)
  }

  async function pickNativeSelectedColor(target: ComposeColorTarget) {
    if (!selected || (selected.kind !== 'rect' && selected.kind !== 'text')) return
    if (target === 'stroke' && selected.kind !== 'text') return

    cancelStageSampling()
    setColorPickerBusy(true)
    try {
      const result = await requestScreenColor()
      if (result.status !== 'picked') return
      updateSelected(target === 'fill' ? { fill: result.color } : { stroke: result.color })
    } finally {
      setColorPickerBusy(false)
    }
  }

  function handleColorPickClick(target: ComposeColorTarget, event: React.MouseEvent<HTMLButtonElement>) {
    if (stageSamplingTarget) {
      cancelStageSampling()
      return
    }
    if (event.shiftKey && colorPickerSupported) void pickNativeSelectedColor(target)
    else void armStageSampling(target)
  }

  function addCat(cat: CatRecord) {
    cancelStageSampling()
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
    cancelStageSampling()
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
    cancelStageSampling()
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

  function handleOpenConfirmCancel(event: React.SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    closeOpenConfirmDialog()
  }

  function commitOpenedDocument(candidate: PendingOpenDocument) {
    cancelStageSampling()
    setEditingTextId(null)
    setSelectedId(null)
    setPlacedObjects(candidate.document.placedObjects)
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
          <button className="compose-back" type="button" onClick={onBack}>← Collection</button>
        </div>

        <div className="compose-action-bar" aria-label="Composition actions">
          <label className="compose-action-bar__name">
            <span className="sr-only">Composition name</span>
            <input
              type="text"
              value={compositionName}
              onChange={(event) => setCompositionName(event.currentTarget.value)}
              aria-label="Composition name"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="compose-action-bar__document" aria-label="Document actions">
            <button type="button" disabled={documentBusy} onClick={() => openInputRef.current?.click()}>Open</button>
            <button type="button" disabled={documentBusy} onClick={openSaveDialog}>Save</button>
            <input
              ref={openInputRef}
              className="compose-document-input"
              type="file"
              accept=".catlab"
              onChange={handleOpenDocument}
            />
          </div>
          <div className="compose-action-bar__actions">
            <button
              className="compose-clear"
              type="button"
              disabled={placedObjects.length === 0}
              onClick={() => { cancelStageSampling(); setPlacedObjects([]); setSelectedId(null) }}
            >
              Clear layers
            </button>
            <button className="compose-export" type="button" disabled={exportBusy} onClick={openExportDialog}>
              Export PNG
            </button>
          </div>
        </div>
        {(exportError || documentError) && (
          <div className="compose-action-status">
            <p className="compose-message compose-message--error" role="alert">{documentError ?? exportError}</p>
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
              <button className="compose-save-dialog__close" type="button" onClick={closeSaveDialog} disabled={documentBusy}>
                <span aria-hidden="true">×</span>
                <span className="sr-only">Cancel save</span>
              </button>
            </div>
            <label className="compose-save-dialog__label" htmlFor="compose-save-filename">Filename</label>
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
            {documentError && <p className="compose-save-dialog__error" role="alert">{documentError}</p>}
            <div className="compose-save-dialog__actions">
              <button type="button" onClick={closeSaveDialog} disabled={documentBusy}>Cancel</button>
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
              <button className="compose-save-dialog__close" type="button" onClick={closeOpenConfirmDialog} disabled={documentBusy}>
                <span aria-hidden="true">×</span>
                <span className="sr-only">Cancel open</span>
              </button>
            </div>
            <p className="compose-open-dialog__message">Opening this file will replace the current composition.</p>
            <div className="compose-save-dialog__actions">
              <button ref={openConfirmCancelRef} type="button" onClick={closeOpenConfirmDialog} disabled={documentBusy}>Cancel</button>
              <button className="compose-save-dialog__save" type="submit" disabled={documentBusy || !pendingOpenDocument}>Open</button>
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
              <button className="compose-save-dialog__close" type="button" onClick={closeExportDialog} disabled={exportBusy}>
                <span aria-hidden="true">×</span>
                <span className="sr-only">Cancel export</span>
              </button>
            </div>
            <label className="compose-save-dialog__label" htmlFor="compose-export-filename">Filename</label>
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
            {exportError && <p className="compose-save-dialog__error" role="alert">{exportError}</p>}
            <div className="compose-save-dialog__actions">
              <button type="button" onClick={closeExportDialog} disabled={exportBusy}>Cancel</button>
              <button className="compose-save-dialog__save" type="submit" disabled={exportBusy}>
                {exportBusy ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </form>
        </dialog>

        <div className="compose-canvas-area">
          <nav className="compose-tool-rail" aria-label="Canvas tools">
            <button className="compose-tool is-active" type="button" aria-label="Select and move" aria-pressed="true" title="Select and move" onClick={cancelStageSampling}>
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
            <button
              className={`compose-tool${stageSamplingTarget ? ' is-active' : ''}`}
              type="button"
              disabled={!selectedDefaultColorTarget || colorPickerBusy}
              aria-pressed={Boolean(stageSamplingTarget)}
              aria-label={colorPickerSupported
                ? selectedDefaultColorTarget ? 'Sample color for selected layer fill' : 'Select a rectangle or text layer to sample a color'
                : selectedDefaultColorTarget ? 'Sample color for selected layer fill' : 'Select a rectangle or text layer to sample a color'}
              title={colorPickerSupported
                ? selectedDefaultColorTarget ? 'Sample selected layer fill (Shift-click for screen picker)' : 'Select a rectangle or text layer first'
                : selectedDefaultColorTarget ? 'Sample selected layer fill' : 'Select a rectangle or text layer first'}
              onClick={(event) => { if (selectedDefaultColorTarget) handleColorPickClick(selectedDefaultColorTarget, event) }}
            >
              <span className="compose-tool__icon" aria-hidden="true">{colorPickerBusy ? '…' : stageSamplingTarget ? '×' : '⌖'}</span>
              <span className="compose-tool__label">{colorPickerBusy ? 'Preparing…' : stageSamplingTarget ? 'Cancel sample' : 'Eyedropper'}</span>
            </button>
          </nav>
          <div className="compose-stage-wrap">
            <div
              className={`compose-stage${selected ? ' compose-stage--has-selection' : ''}${stageSamplingTarget ? ' compose-stage--sampling' : ''}`}
              ref={stageRef}
              style={stageStyle}
              onPointerDownCapture={handleStagePointerDownCapture}
              onPointerUpCapture={handleStagePointerUpCapture}
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
              {stageSamplingMessage && (
                <div className="compose-stage__sampling-status" role="status">{stageSamplingMessage}</div>
              )}
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
                const atlasCell = getMoonCatAtlasCell(manifest, cat.rescueOrder, 'bodies')
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
                    <div className="compose-color-control">
                      <label className="compose-color-field">
                        <input type="color" value={selected.fill} onChange={(event) => updateSelected({ fill: event.currentTarget.value })} />
                        <span>Fill</span>
                      </label>
                      <button
                        className="compose-color-pick"
                        type="button"
                        disabled={colorPickerBusy}
                        aria-label="Sample text fill color"
                        title={colorPickerSupported ? 'Sample text fill color (Shift-click for screen picker)' : 'Sample text fill color'}
                        onClick={(event) => handleColorPickClick('fill', event)}
                      >
                        ⌖
                      </button>
                    </div>
                    <div className="compose-color-control">
                      <label className="compose-color-field">
                        <input type="color" value={selected.stroke} onChange={(event) => updateSelected({ stroke: event.currentTarget.value })} />
                        <span>Outline</span>
                      </label>
                      <button
                        className="compose-color-pick"
                        type="button"
                        disabled={colorPickerBusy}
                        aria-label="Sample text outline color"
                        title={colorPickerSupported ? 'Sample text outline color (Shift-click for screen picker)' : 'Sample text outline color'}
                        onClick={(event) => handleColorPickClick('stroke', event)}
                      >
                        ⌖
                      </button>
                    </div>
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
                  <div className="compose-color-control">
                    <label className="compose-color-field">
                      <input type="color" value={selected.fill} onChange={(event) => updateSelected({ fill: event.currentTarget.value })} />
                      <span>Fill</span>
                    </label>
                    <button
                      className="compose-color-pick"
                      type="button"
                      disabled={colorPickerBusy}
                      aria-label="Sample rectangle fill color"
                      title={colorPickerSupported ? 'Sample rectangle fill color (Shift-click for screen picker)' : 'Sample rectangle fill color'}
                      onClick={(event) => handleColorPickClick('fill', event)}
                    >
                      ⌖
                    </button>
                  </div>
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
