import { assetPath } from './data'
import {
  classifyGenesisDetail,
  formatMoonCatHue,
  getDetailAtlasCell,
} from './mooncatDetails'
import type { DetailAtlasCell } from './mooncatDetails'
import type { AtlasManifest, CatRecord } from './types'

export const DETAIL_CARD_EXPORT_SIZE = Object.freeze({ width: 600, height: 840 })

export const DETAIL_CARD_EXPORT_LAYOUT = Object.freeze({
  coatRail: Object.freeze({ x: 0.052, y: 0.038, width: 0.896, height: 0.926 }),
  title: Object.freeze({ x: 0.081, y: 0.055, width: 0.838, height: 0.05 }),
  image: Object.freeze({ x: 0.085, y: 0.12, width: 0.83, height: 0.435 }),
  summary: Object.freeze({ x: 0.081, y: 0.561, width: 0.838, height: 0.051 }),
  details: Object.freeze({ x: 0.085, y: 0.626, width: 0.83, height: 0.272 }),
  classificationFooter: Object.freeze({ x: 0.081, y: 0.912, width: 0.838, height: 0.042 }),
  detailsPadding: 12,
  preview: Object.freeze({ width: 252, height: 264 }),
  titleFontSize: 29,
  summaryFontSize: 25,
  summaryLetterSpacing: 1.5,
  classificationFooterFontSize: 25,
  traitFontSize: 24,
  traitLineHeight: 1.2,
  traitGap: 3,
  traitColumnGap: 7,
})

export function detailCardExportFilename(rescueOrder: number) {
  return `mooncat-${Number.isInteger(rescueOrder) ? rescueOrder : 'card'}-card.png`
}

export function detailCardExportSummary(cat: CatRecord) {
  return `${cat.rescueYear} RESCUE · ${cat.hueName} · ${cat.pattern}`.toUpperCase()
}

function loadImage(url: string, ImageCtor: typeof Image = globalThis.Image) {
  if (typeof ImageCtor !== 'function') throw new Error('Image loading is unavailable.')
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new ImageCtor()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load ${url}.`))
    image.src = url
  })
}

function rectFromLayout(
  layout: { x: number; y: number; width: number; height: number },
  canvasSize: typeof DETAIL_CARD_EXPORT_SIZE,
) {
  return {
    x: layout.x * canvasSize.width,
    y: layout.y * canvasSize.height,
    width: layout.width * canvasSize.width,
    height: layout.height * canvasSize.height,
  }
}

function fitTextToWidth(context: CanvasRenderingContext2D, text: string, width: number) {
  let rendered = String(text)
  while (rendered.length > 1 && context.measureText(rendered).width > width) {
    rendered = `${rendered.slice(0, -2)}…`
  }
  return rendered
}

function measureSpacedText(context: CanvasRenderingContext2D, text: string, letterSpacing: number) {
  const glyphWidth = [...text].reduce(
    (total, character) => total + context.measureText(character).width,
    0,
  )
  return glyphWidth + (Math.max(0, [...text].length - 1) * letterSpacing)
}

function drawCenteredText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  font: string,
  color: string,
) {
  context.save()
  context.font = font
  context.fillStyle = color
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  const rendered = fitTextToWidth(context, text, width)
  context.fillText(rendered, x + (width / 2), y + (height / 2))
  context.restore()
}

function drawCenteredSpacedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  font: string,
  color: string,
  letterSpacing: number,
) {
  context.save()
  context.font = font
  context.fillStyle = color
  context.textAlign = 'left'
  context.textBaseline = 'middle'

  let rendered = String(text)
  while (rendered.length > 1 && measureSpacedText(context, rendered, letterSpacing) > width) {
    rendered = `${rendered.slice(0, -2)}…`
  }

  let cursorX = x + ((width - measureSpacedText(context, rendered, letterSpacing)) / 2)
  const centerY = y + (height / 2)
  for (const character of rendered) {
    context.fillText(character, cursorX, centerY)
    cursorX += context.measureText(character).width + letterSpacing
  }
  context.restore()
}

function mixHexColors(foreground: string, background: string, foregroundWeight: number) {
  const parseHex = (value: string) => {
    const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value || '').trim())
    if (!match) return null
    const hex = match[1].length === 3
      ? [...match[1]].map((digit) => `${digit}${digit}`).join('')
      : match[1]
    return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
  }

  const foregroundRgb = parseHex(foreground)
  const backgroundRgb = parseHex(background)
  if (!foregroundRgb || !backgroundRgb) return background

  const weight = Math.min(1, Math.max(0, Number(foregroundWeight) || 0))
  const mixed = foregroundRgb.map((channel, index) => (
    Math.round((channel * weight) + (backgroundRgb[index] * (1 - weight)))
  ))
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function drawTraitGrid(context: CanvasRenderingContext2D, cat: CatRecord, detailsRect: {
  x: number
  y: number
  width: number
  height: number
}) {
  const layout = DETAIL_CARD_EXPORT_LAYOUT
  const traits = [
    ['Cat ID', cat.catId],
    ['Hue', formatMoonCatHue(cat)],
    ['Coat', cat.pale ? 'pale' : 'normal'],
    ['Facing', cat.facing],
    ['Expression', cat.expression],
    ['Pose', cat.pose],
  ]
  const contentX = detailsRect.x + layout.detailsPadding
  const contentWidth = detailsRect.width - (layout.detailsPadding * 2)
  const labelWidth = ((contentWidth - layout.traitColumnGap) * 0.4)
  const valueX = contentX + labelWidth + layout.traitColumnGap
  const lineHeight = layout.traitFontSize * layout.traitLineHeight
  const statusHeight = 13 * 1.35
  const firstRowY = detailsRect.y + statusHeight + 9

  context.save()
  context.beginPath()
  context.rect(detailsRect.x, detailsRect.y, detailsRect.width, detailsRect.height)
  context.clip()
  context.textBaseline = 'top'
  traits.forEach(([label, value], row) => {
    const y = firstRowY + (row * (lineHeight + layout.traitGap))
    context.fillStyle = 'rgba(16, 33, 38, 0.66)'
    context.font = `700 ${layout.traitFontSize}px "Pixel Operator", monospace`
    context.fillText(fitTextToWidth(context, label, labelWidth), contentX, y)
    context.fillStyle = '#102126'
    context.font = `700 ${layout.traitFontSize}px "Pixel Operator Bold", monospace`
    context.fillText(fitTextToWidth(context, value, contentWidth - labelWidth - layout.traitColumnGap), valueX, y)
  })
  context.restore()
}

function createGenesisFoilGradient(
  context: CanvasRenderingContext2D,
  coatRail: { x: number; y: number; width: number; height: number },
  genesis: 'black' | 'white',
) {
  const gradient = context.createLinearGradient(
    coatRail.x,
    coatRail.y + coatRail.height,
    coatRail.x + coatRail.width,
    coatRail.y,
  )
  const stops: Array<[number, string]> = genesis === 'black'
    ? [
      [0, '#101218'], [0.28, '#252a35'], [0.44, '#11131a'], [0.49, '#737a8b'],
      [0.53, '#645675'], [0.58, '#222632'], [0.8, '#0b0d12'], [1, '#171921'],
    ]
    : [
      [0, '#ddd6ca'], [0.26, '#fffdf7'], [0.44, '#bfefff'], [0.5, '#ffd0e8'],
      [0.56, '#fff0a8'], [0.66, '#fffdf7'], [1, '#e8e1d6'],
    ]
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color))
  return gradient
}

export function renderDetailCardCanvas({
  canvas,
  templateImage,
  atlasImage,
  atlasSource,
  cat,
  title,
  coatColor,
  classificationFooter = '',
}: {
  canvas: HTMLCanvasElement
  templateImage: HTMLImageElement
  atlasImage: HTMLImageElement
  atlasSource: DetailAtlasCell
  cat: CatRecord
  title: string
  coatColor: string
  classificationFooter?: string
}) {
  const context = canvas.getContext('2d')
  if (!context || !templateImage || !atlasImage || !cat || !atlasSource) {
    throw new Error('Card export data is incomplete.')
  }

  const { width, height } = DETAIL_CARD_EXPORT_SIZE
  const layout = DETAIL_CARD_EXPORT_LAYOUT
  const size = DETAIL_CARD_EXPORT_SIZE
  const coatRail = rectFromLayout(layout.coatRail, size)
  const image = rectFromLayout(layout.image, size)
  const titleRect = rectFromLayout(layout.title, size)
  const summaryRect = rectFromLayout(layout.summary, size)
  const details = rectFromLayout(layout.details, size)
  const classificationRect = rectFromLayout(layout.classificationFooter, size)
  canvas.width = width
  canvas.height = height
  context.clearRect(0, 0, width, height)
  context.imageSmoothingEnabled = false

  const genesis = classifyGenesisDetail(cat)
  context.fillStyle = genesis
    ? createGenesisFoilGradient(context, coatRail, genesis)
    : (coatColor || '#ff69b4')
  context.fillRect(coatRail.x, coatRail.y, coatRail.width, coatRail.height)
  context.fillStyle = '#000'
  context.fillRect(image.x, image.y, image.width, image.height)
  context.drawImage(
    atlasImage,
    atlasSource.x,
    atlasSource.y,
    atlasSource.width,
    atlasSource.height,
    image.x + ((image.width - layout.preview.width) / 2),
    image.y + ((image.height - layout.preview.height) / 2),
    layout.preview.width,
    layout.preview.height,
  )
  context.fillStyle = mixHexColors(coatColor, '#ccecf2', 0.16)
  context.fillRect(details.x, details.y, details.width, details.height)
  context.drawImage(templateImage, 0, 0, width, height)

  drawCenteredText(
    context,
    title,
    titleRect.x,
    titleRect.y,
    titleRect.width,
    titleRect.height,
    `700 ${layout.titleFontSize}px "Pixel Operator Bold", monospace`,
    '#0b0b09',
  )
  drawCenteredSpacedText(
    context,
    detailCardExportSummary(cat),
    summaryRect.x,
    summaryRect.y,
    summaryRect.width,
    summaryRect.height,
    `600 ${layout.summaryFontSize}px "Pixel Operator Bold", monospace`,
    '#0b0b09',
    layout.summaryLetterSpacing,
  )
  drawTraitGrid(context, cat, details)
  if (classificationFooter) {
    drawCenteredText(
      context,
      classificationFooter,
      classificationRect.x,
      classificationRect.y,
      classificationRect.width,
      classificationRect.height,
      `700 ${layout.classificationFooterFontSize}px "Pixel Operator Bold", monospace`,
      genesis === 'black' ? '#fff' : '#0b0b09',
    )
  }
  return canvas
}

async function ensureExportFonts(documentRef: Document) {
  if (!documentRef.fonts?.load) return
  await Promise.all([
    documentRef.fonts.load(`${DETAIL_CARD_EXPORT_LAYOUT.titleFontSize}px "Pixel Operator Bold"`),
    documentRef.fonts.load(`${DETAIL_CARD_EXPORT_LAYOUT.traitFontSize}px "Pixel Operator"`),
    documentRef.fonts.load(`${DETAIL_CARD_EXPORT_LAYOUT.classificationFooterFontSize}px "Pixel Operator Bold"`),
  ])
}

export async function downloadDetailCardPng({
  cat,
  manifest,
  title,
  coatColor,
  classificationFooter = '',
  documentRef = globalThis.document,
  urlRef = globalThis.URL,
  ImageCtor = globalThis.Image,
  templateUrl = assetPath('img/template_full.png'),
}: {
  cat: CatRecord
  manifest: AtlasManifest
  title: string
  coatColor: string
  classificationFooter?: string
  documentRef?: Document
  urlRef?: typeof URL
  ImageCtor?: typeof Image
  templateUrl?: string
}) {
  const source = getDetailAtlasCell(cat, manifest)
  if (!documentRef?.createElement || !documentRef.body || !urlRef?.createObjectURL || !urlRef?.revokeObjectURL || !source) {
    throw new Error('PNG export is unavailable.')
  }
  const [templateImage, atlasImage] = await Promise.all([
    loadImage(templateUrl, ImageCtor),
    loadImage(source.url, ImageCtor),
    ensureExportFonts(documentRef),
  ])
  const canvas = renderDetailCardCanvas({
    canvas: documentRef.createElement('canvas'),
    templateImage,
    atlasImage,
    atlasSource: source,
    cat,
    title,
    coatColor,
    classificationFooter,
  })
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not encode the card PNG.')), 'image/png')
  })
  const objectUrl = urlRef.createObjectURL(blob)
  const anchor = documentRef.createElement('a')
  anchor.href = objectUrl
  anchor.download = detailCardExportFilename(cat.rescueOrder)
  anchor.hidden = true
  documentRef.body.append(anchor)
  anchor.click()
  anchor.remove()
  globalThis.setTimeout(() => urlRef.revokeObjectURL(objectUrl), 0)
  return anchor.download
}
