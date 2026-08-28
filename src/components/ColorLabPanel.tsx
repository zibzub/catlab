import { useCallback, useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import { assetPath } from '../data'
import {
  createColorLabSample,
  drawColorLabImage,
  findValidNearbySample,
  getClosestMoonCatCoatHueLabel,
  getMoonCatColorMatch,
  isUsableColorLabSample,
  loadColorLabImage,
  MAX_COLORLAB_CANVAS_SIZE,
  MIN_SAMPLE_ALPHA,
  samplePixel,
  type ColorLabSample,
} from '../colorLab'

type ColorLabImageSlot = 'sample-1' | 'sample-2' | 'custom'

const COLORLAB_DEFAULTS: ReadonlyArray<{
  src: string
  slot: Exclude<ColorLabImageSlot, 'custom'>
  label: string
}> = [
  { src: assetPath('img/colorlab_preload1.png'), slot: 'sample-1', label: 'Hue wheel' },
  { src: assetPath('img/colorlab_preload2.png'), slot: 'sample-2', label: 'Coat chart' },
]

const TAP_SAMPLE_MOVE_THRESHOLD = 8

interface ColorLabPanelProps {
  open: boolean
  sample: ColorLabSample | null
  matchingCount: number
  onSampleChange: (sample: ColorLabSample | null) => void
}

function detectionLabel(sample: ColorLabSample): string {
  switch (sample.detection.kind) {
    case 'normal':
      return 'Normal coat'
    case 'pale':
      return 'Pale coat'
    case 'black':
      return 'Genesis Black'
    case 'white':
      return 'Genesis White'
    default:
      return 'Uncertain coat'
  }
}

function formatHue(sample: ColorLabSample): string {
  if (sample.detection.kind === 'black') return 'Genesis · 1000'
  if (sample.detection.kind === 'white') return 'Genesis · 2000'

  const matchHue = sample.detection.hueInt
  if (matchHue === null || matchHue === sample.hue) return `${sample.hue}°`
  return `${matchHue}° (sampled ${sample.hue}°)`
}

export function ColorLabPanel({ open, sample, matchingCount, onSampleChange }: ColorLabPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pointerStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const customImageUrlRef = useRef<string | null>(null)
  const loadSequenceRef = useRef(0)
  const [activeImageSlot, setActiveImageSlot] = useState<ColorLabImageSlot>('sample-1')
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null)
  const [imageReady, setImageReady] = useState(false)
  const [status, setStatus] = useState('Loading a sample image…')

  const loadImageSource = useCallback(async (src: string, slot: ColorLabImageSlot) => {
    const sequence = loadSequenceRef.current + 1
    loadSequenceRef.current = sequence
    setActiveImageSlot(slot)
    setImageReady(false)
    onSampleChange(null)
    setStatus('Loading image…')

    try {
      const image = await loadColorLabImage(src)
      if (sequence !== loadSequenceRef.current) return
      const canvas = canvasRef.current
      if (!canvas) throw new Error('The ColorLab canvas is unavailable.')
      drawColorLabImage(canvas, image, MAX_COLORLAB_CANVAS_SIZE)
      setImageReady(true)
      setStatus('Click or tap the image to sample a coat color.')
    } catch {
      if (sequence !== loadSequenceRef.current) return
      setStatus('That image could not be loaded. Choose another image.')
    }
  }, [onSampleChange])

  useEffect(() => {
    void loadImageSource(COLORLAB_DEFAULTS[0].src, COLORLAB_DEFAULTS[0].slot)
    return () => {
      loadSequenceRef.current += 1
    }
  }, [loadImageSource])

  useEffect(() => () => {
    if (customImageUrlRef.current) URL.revokeObjectURL(customImageUrlRef.current)
  }, [])

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''

    if (!file) {
      setStatus('Choose an image to add it to ColorLab.')
      return
    }
    if (!file.type.startsWith('image/')) {
      setStatus('Please choose an image file.')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    if (customImageUrlRef.current) URL.revokeObjectURL(customImageUrlRef.current)
    customImageUrlRef.current = objectUrl
    setCustomImageUrl(objectUrl)
    void loadImageSource(objectUrl, 'custom')
  }

  function handleCustomImageClick() {
    if (customImageUrl) {
      void loadImageSource(customImageUrl, 'custom')
      return
    }
    fileInputRef.current?.click()
  }

  function sampleCanvasAtPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !ctx || !imageReady) {
      setStatus('Load an image before sampling a color.')
      return
    }

    const bounds = canvas.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) {
      setStatus('The image is not ready for sampling.')
      return
    }

    const x = Math.floor((event.clientX - bounds.left) * (canvas.width / bounds.width))
    const y = Math.floor((event.clientY - bounds.top) * (canvas.height / bounds.height))
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
      setStatus('Choose a point inside the image.')
      return
    }

    const clickedSample = createColorLabSample(samplePixel(ctx, x, y))
    let selectedSample: ColorLabSample | null = isUsableColorLabSample(clickedSample)
      ? clickedSample
      : null

    if (!selectedSample) {
      selectedSample = findValidNearbySample(ctx, canvas.width, canvas.height, x, y)
    }
    if (!selectedSample) {
      setStatus('That point is not a readable MoonCat coat color. Try the main body, away from outlines and shadows.')
      return
    }

    onSampleChange(selectedSample)
    setStatus('Showing Collection cats for the sampled hue.')
  }

  function handleCanvasPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    pointerStartRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
  }

  function handleCanvasPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const pointerStart = pointerStartRef.current
    pointerStartRef.current = null
    if (!pointerStart || pointerStart.pointerId !== event.pointerId) return

    const moveDistance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y)
    if (moveDistance <= TAP_SAMPLE_MOVE_THRESHOLD) sampleCanvasAtPoint(event)
  }

  function clearSample() {
    onSampleChange(null)
    setStatus(imageReady ? 'Click or tap the image to sample a coat color.' : 'Load an image before sampling a color.')
  }

  const match = sample ? getMoonCatColorMatch(sample) : null
  const hueLabel = sample ? getClosestMoonCatCoatHueLabel(sample.detection, sample.hue) : null

  return (
    <section
      className="colorlab-panel"
      id="colorlab-panel"
      aria-labelledby="colorlab-panel-title"
      hidden={!open}
    >
      <div className="colorlab-panel__header">
        <div>
          <p className="eyebrow">Collection tool / ColorLab</p>
          <h2 id="colorlab-panel-title">Sample a MoonCat coat</h2>
          <p>Choose a reference image, then click or tap the body color to narrow the Collection.</p>
        </div>
        <div className="colorlab-panel__signal" aria-live="polite">
          <span className="colorlab-panel__signal-dot" aria-hidden="true" />
          <span>{match ? `Hue ${match.hueInt}` : 'Sampler ready'}</span>
        </div>
      </div>

      <div className="colorlab-panel__body">
        <div className="colorlab-sampler">
          <div className="colorlab-sampler__controls">
            <div className="colorlab-source-options" aria-label="ColorLab example images">
              {COLORLAB_DEFAULTS.map((source) => (
                <button
                  key={source.src}
                  className={`colorlab-source${activeImageSlot === source.slot ? ' is-active' : ''}`}
                  type="button"
                  aria-label={`Load ${source.label}`}
                  aria-pressed={activeImageSlot === source.slot}
                  onClick={() => void loadImageSource(source.src, source.slot)}
                >
                  <img src={source.src} alt="" />
                  <span>{source.label}</span>
                </button>
              ))}
              <button
                className={`colorlab-source colorlab-source--custom${activeImageSlot === 'custom' ? ' is-active' : ''}`}
                type="button"
                aria-label={customImageUrl ? 'Load uploaded image' : 'Choose uploaded image'}
                aria-pressed={activeImageSlot === 'custom'}
                onClick={handleCustomImageClick}
              >
                {customImageUrl ? <img src={customImageUrl} alt="" /> : <span className="colorlab-source__plus" aria-hidden="true">+</span>}
                <span>{customImageUrl ? 'Uploaded' : 'Your image'}</span>
              </button>
            </div>
            <label className="colorlab-upload">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} />
              <span>Upload image</span>
            </label>
          </div>

          <div className="colorlab-canvas-wrap">
            <canvas
              ref={canvasRef}
              className={`colorlab-canvas${imageReady ? ' is-ready' : ''}`}
              onPointerDown={handleCanvasPointerDown}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={() => { pointerStartRef.current = null }}
              aria-label="ColorLab image sampler"
            />
            {!imageReady && <div className="colorlab-canvas-placeholder">{status}</div>}
          </div>
          <p className="colorlab-sampler__status" role="status">{status}</p>
        </div>

        <aside className="colorlab-result" aria-live="polite">
          <div className="colorlab-result__header">
            <p className="eyebrow">Sample readout</p>
            <h3>{hueLabel ?? 'No color selected'}</h3>
          </div>
          {sample ? (
            <>
              <div className="colorlab-result__swatch-row">
                <div className="colorlab-result__swatch" style={{ backgroundColor: sample.hex }} aria-label={`Sampled color ${sample.hex}`} />
                <div>
                  <strong>{detectionLabel(sample)}</strong>
                  <span>{match ? `${matchingCount.toLocaleString()} cats in current view` : 'No confident hue match'}</span>
                </div>
              </div>
              <dl className="colorlab-result__details">
                <div><dt>RGB</dt><dd>{sample.rgb.r}, {sample.rgb.g}, {sample.rgb.b}</dd></div>
                <div><dt>Hex</dt><dd>{sample.hex}</dd></div>
                <div><dt>Hue</dt><dd>{formatHue(sample)}</dd></div>
                <div><dt>Filter</dt><dd>{match ? `${match.pale === true ? 'Pale' : match.pale === false ? 'Normal' : 'All'} · exact hue` : 'Not applied'}</dd></div>
              </dl>
              <button className="colorlab-result__clear" type="button" onClick={clearSample}>Clear color match</button>
            </>
          ) : (
            <div className="colorlab-result__empty">
              <span className="colorlab-result__empty-mark" aria-hidden="true">⌖</span>
              <p>Sample a visible coat color to filter the cats below.</p>
            </div>
          )}
          <p className="colorlab-result__hint">For best results, avoid eyes, accessories, outlines, shadows, and highlights.</p>
        </aside>
      </div>
      <span className="sr-only">Minimum sample alpha is {MIN_SAMPLE_ALPHA}.</span>
    </section>
  )
}
