import { normalizeCssHex } from './colorPicker'
import type { ComposeBackground, ComposePlacedObject } from './composeExport'

export const COMPOSE_DOCUMENT_FORMAT = 'catlab-composition'
export const COMPOSE_DOCUMENT_VERSION = 1
export const MAX_EMBEDDED_BACKGROUND_DATA_URL_LENGTH = 25_000_000
const MAX_RESCUE_ORDER = 25_439

interface ComposeDocumentDimensions {
  width: number
  height: number
}

interface ComposeDocumentTransform {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  flipX: boolean
  flipY: boolean
  z: number
}

interface ComposeDocumentCat extends ComposeDocumentTransform {
  kind: 'cat'
  rescueOrder: number
  artMode: 'bodies' | 'faces'
}

interface ComposeDocumentText extends ComposeDocumentTransform {
  kind: 'text'
  text: string
  fill: string
  stroke: string
  strokeWidth: number
  fontSize: number
  fontFamily: string
}

interface ComposeDocumentRect extends ComposeDocumentTransform {
  kind: 'rect'
  width: number
  height: number
  fill: string
}

export type ComposeDocumentObject = ComposeDocumentCat | ComposeDocumentText | ComposeDocumentRect

interface EmbeddedBackground {
  kind: 'embedded'
  dataUrl: string
  width: number
  height: number
  name: string
}

interface ReferencedBackground {
  kind: 'reference'
  url: string
  width: number
  height: number
  name: string
}

type ComposeDocumentBackground = EmbeddedBackground | ReferencedBackground

export interface ComposeDocumentV1 {
  format: typeof COMPOSE_DOCUMENT_FORMAT
  version: typeof COMPOSE_DOCUMENT_VERSION
  background: ComposeDocumentBackground | null
  objects: ComposeDocumentObject[]
}

export interface LoadedComposeDocument {
  background: ComposeBackground | null
  placedObjects: ComposePlacedObject[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberField(value: unknown, label: string, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`Invalid ${label}.`)
  }
  return value
}

function stringField(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(`Invalid ${label}.`)
  return value
}

function requiredStringField(value: unknown, label: string, maxLength: number): string {
  const result = stringField(value, label, maxLength)
  if (!result) throw new Error(`Invalid ${label}.`)
  return result
}

function embeddedBackgroundDataUrl(value: unknown, action: 'open' | 'save'): string {
  if (typeof value !== 'string' || !value) throw new Error('Invalid embedded background image.')
  if (value.length > MAX_EMBEDDED_BACKGROUND_DATA_URL_LENGTH) {
    throw new Error(`Embedded background is too large to ${action}.`)
  }
  if (!/^data:image\//i.test(value)) throw new Error('Embedded background must be an image data URL.')
  return value
}

function colorField(value: unknown, label: string): string {
  const color = requiredStringField(value, label, 16)
  const normalized = normalizeCssHex(color)
  if (!normalized) throw new Error(`Invalid ${label}.`)
  return normalized
}

function transformFields(value: Record<string, unknown>): ComposeDocumentTransform {
  if (typeof value.flipX !== 'boolean' || typeof value.flipY !== 'boolean') throw new Error('Invalid object flip state.')
  return {
    x: numberField(value.x, 'object x position', 0, 1),
    y: numberField(value.y, 'object y position', 0, 1),
    scale: numberField(value.scale, 'object scale', 0.4, 12),
    rotation: numberField(value.rotation, 'object rotation', -3600, 3600),
    opacity: numberField(value.opacity, 'object opacity', 0, 1),
    flipX: value.flipX === true,
    flipY: value.flipY === true,
    z: numberField(value.z, 'object layer order', -1, 1_000_000, true),
  }
}

function parseObject(value: unknown, index: number): ComposeDocumentObject {
  if (!isRecord(value)) throw new Error(`Invalid object ${index + 1}.`)
  const transform = transformFields(value)
  const kind = value.kind

  if (kind === 'cat') {
    const artMode = value.artMode
    if (artMode !== 'bodies' && artMode !== 'faces') throw new Error(`Invalid cat art mode in object ${index + 1}.`)
    return {
      ...transform,
      kind,
      rescueOrder: numberField(value.rescueOrder, 'MoonCat rescue order', 0, MAX_RESCUE_ORDER, true),
      artMode,
    }
  }

  if (kind === 'rect') {
    return {
      ...transform,
      kind,
      width: numberField(value.width, 'rectangle width', 0.04, 1.5),
      height: numberField(value.height, 'rectangle height', 0.04, 1.5),
      fill: colorField(value.fill, 'rectangle fill'),
    }
  }

  if (kind === 'text') {
    return {
      ...transform,
      kind,
      text: stringField(value.text, 'text content', 10_000),
      fill: colorField(value.fill, 'text fill'),
      stroke: colorField(value.stroke, 'text outline'),
      strokeWidth: numberField(value.strokeWidth, 'text outline width', 0, 100),
      fontSize: numberField(value.fontSize, 'text font size', 1, 1_000),
      fontFamily: requiredStringField(value.fontFamily, 'text font family', 240),
    }
  }

  throw new Error(`Unknown object type in object ${index + 1}.`)
}

function dimensions(value: unknown, label: string): ComposeDocumentDimensions {
  if (!isRecord(value)) throw new Error(`Invalid ${label}.`)
  return {
    width: numberField(value.width, `${label} width`, 1, 20_000),
    height: numberField(value.height, `${label} height`, 1, 20_000),
  }
}

function parseBackground(value: unknown): ComposeDocumentBackground | null {
  if (value === null) return null
  if (!isRecord(value)) throw new Error('Invalid background.')
  const size = dimensions(value, 'background')
  const kind = value.kind
  const name = stringField(value.name, 'background name', 512)

  if (kind === 'embedded') {
    const dataUrl = embeddedBackgroundDataUrl(value.dataUrl, 'open')
    return { kind, dataUrl, ...size, name }
  }

  if (kind === 'reference') {
    const url = requiredStringField(value.url, 'background reference', 2_000)
    if (!(url.startsWith('/') || url.startsWith('./') || url.startsWith('../'))) {
      throw new Error('Background reference must be a local path.')
    }
    return { kind, url, ...size, name }
  }

  throw new Error('Unknown background type.')
}

function runtimeId(kind: ComposePlacedObject['kind'], index: number): string {
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
  return `compose-${kind}-${index}-${randomId}`
}

function restoreObject(value: ComposeDocumentObject, index: number): ComposePlacedObject {
  const transform = {
    id: runtimeId(value.kind, index),
    x: value.x,
    y: value.y,
    scale: value.scale,
    rotation: value.rotation,
    opacity: value.opacity,
    flipX: value.flipX,
    flipY: value.flipY,
    z: value.z,
  }

  if (value.kind === 'cat') return { ...transform, kind: value.kind, rescueOrder: value.rescueOrder, artMode: value.artMode }
  if (value.kind === 'rect') return { ...transform, kind: value.kind, width: value.width, height: value.height, fill: value.fill }
  return {
    ...transform,
    kind: value.kind,
    text: value.text,
    fill: value.fill,
    stroke: value.stroke,
    strokeWidth: value.strokeWidth,
    fontSize: value.fontSize,
    fontFamily: value.fontFamily,
  }
}

export function parseComposeDocument(value: unknown): LoadedComposeDocument {
  if (!isRecord(value)) throw new Error('The composition file must contain a JSON object.')
  if (value.format !== COMPOSE_DOCUMENT_FORMAT) throw new Error('This is not a CatLab composition file.')
  if (value.version !== COMPOSE_DOCUMENT_VERSION) {
    throw new Error(`Unsupported CatLab composition version: ${String(value.version)}.`)
  }

  const background = parseBackground(value.background)
  if (!Array.isArray(value.objects) || value.objects.length > 500) throw new Error('Invalid composition object list.')

  const documentObjects = value.objects.map((object, index) => parseObject(object, index))
  return {
    background: background?.kind === 'embedded'
      ? { url: background.dataUrl, width: background.width, height: background.height, name: background.name }
      : background
        ? { url: background.url, width: background.width, height: background.height, name: background.name }
        : null,
    placedObjects: documentObjects.map(restoreObject),
  }
}

function blobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('The background image could not be embedded.'))
    reader.readAsDataURL(blob)
  })
}

async function serializeBackground(background: ComposeBackground): Promise<ComposeDocumentBackground> {
  const base = { width: background.width, height: background.height, name: background.name }
  if (/^data:image\//i.test(background.url)) {
    return { kind: 'embedded', dataUrl: embeddedBackgroundDataUrl(background.url, 'save'), ...base }
  }

  if (background.url.startsWith('blob:')) {
    const response = await fetch(background.url)
    if (!response.ok) throw new Error('The background image could not be read for saving.')
    const dataUrl = await blobAsDataUrl(await response.blob())
    try {
      return { kind: 'embedded', dataUrl: embeddedBackgroundDataUrl(dataUrl, 'save'), ...base }
    } catch (error) {
      if (error instanceof Error && error.message === 'Embedded background must be an image data URL.') {
        throw new Error('The background image could not be embedded.')
      }
      throw error
    }
  }

  if (background.url.startsWith('/') || background.url.startsWith('./') || background.url.startsWith('../')) {
    return { kind: 'reference', url: background.url, ...base }
  }

  throw new Error('The background image has an unsupported source.')
}

function serializeObject(value: ComposePlacedObject): ComposeDocumentObject {
  const transform = {
    x: value.x,
    y: value.y,
    scale: value.scale,
    rotation: value.rotation,
    opacity: value.opacity,
    flipX: value.flipX,
    flipY: value.flipY,
    z: value.z,
  }

  if (value.kind === 'cat') return { ...transform, kind: value.kind, rescueOrder: value.rescueOrder, artMode: value.artMode }
  if (value.kind === 'rect') return { ...transform, kind: value.kind, width: value.width, height: value.height, fill: value.fill }
  return {
    ...transform,
    kind: value.kind,
    text: value.text,
    fill: value.fill,
    stroke: value.stroke,
    strokeWidth: value.strokeWidth,
    fontSize: value.fontSize,
    fontFamily: value.fontFamily,
  }
}

export async function serializeComposeDocument(
  placedObjects: ComposePlacedObject[],
  background: ComposeBackground | null,
): Promise<ComposeDocumentV1> {
  return {
    format: COMPOSE_DOCUMENT_FORMAT,
    version: COMPOSE_DOCUMENT_VERSION,
    background: background ? await serializeBackground(background) : null,
    objects: placedObjects.map(serializeObject),
  }
}
