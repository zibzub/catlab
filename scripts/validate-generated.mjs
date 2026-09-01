import { createRequire } from 'node:module'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import {
  ATLAS_HEIGHT,
  ATLAS_COLUMNS,
  ATLAS_WIDTH,
  CAT_COUNT,
  CATS_PER_ATLAS,
  CELL_HEIGHT,
  CELL_WIDTH,
  FACE_ATLAS_HEIGHT,
  FACE_ATLAS_WIDTH,
  FACE_CELL_HEIGHT,
  FACE_CELL_WIDTH,
  FACE_CROP_ORIGINS,
  FACE_MASK,
  MANIFEST_SCHEMA_VERSION,
  validateEncodedIndex,
} from './lib/catalog.mjs'
import { validateClassificationArtifact } from './lib/mooncat-classifications.mjs'
import { validateMoonCatNamesArtifact } from './lib/mooncat-names.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const DATA_DIR = path.join(ROOT, 'public/data')
const INDEX_PATH = path.join(DATA_DIR, 'mooncats.json')
const MANIFEST_PATH = path.join(DATA_DIR, 'atlas-manifest.json')
const CLASSIFICATIONS_PATH = path.join(DATA_DIR, 'mooncat-classifications.json')
const NAMES_PATH = path.join(DATA_DIR, 'names-timestamp-live.json')
const ATLAS_DIR = path.join(DATA_DIR, 'atlases')
const FACE_ATLAS_DIR = path.join(DATA_DIR, 'face-atlases')
const require = createRequire(import.meta.url)
const mooncatModule = require('mooncatparser')
const mooncatparser =
  typeof mooncatModule === 'function'
    ? mooncatModule
    : mooncatModule.mooncatparser ?? mooncatModule.default

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

function parseColor(color) {
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ]
}

function assertAtlasPixels(atlasBuffers, index) {
  for (const [rescueOrder, row] of index.cats.entries()) {
    const catId = row[0]
    const matrix = mooncatparser(catId)
    const width = matrix.length
    const height = matrix[0].length
    const offsetX = Math.floor((CELL_WIDTH - width) / 2)
    const offsetY = CELL_HEIGHT - height
    const sheet = Math.floor(rescueOrder / CATS_PER_ATLAS)
    const cell = rescueOrder % CATS_PER_ATLAS
    const cellColumn = cell % ATLAS_COLUMNS
    const cellRow = Math.floor(cell / ATLAS_COLUMNS)
    const atlasBuffer = atlasBuffers[sheet]

    for (let y = 0; y < CELL_HEIGHT; y += 1) {
      for (let x = 0; x < CELL_WIDTH; x += 1) {
        const matrixX = x - offsetX
        const matrixY = y - offsetY
        const expectedColor =
          matrixX >= 0 && matrixX < width && matrixY >= 0 && matrixY < height
            ? matrix[matrixX][matrixY]
            : null
        const atlasX = cellColumn * CELL_WIDTH + x
        const atlasY = cellRow * CELL_HEIGHT + y
        const pixelOffset = (atlasY * ATLAS_WIDTH + atlasX) * 4
        const actualAlpha = atlasBuffer[pixelOffset + 3]

        if (expectedColor === null) {
          if (actualAlpha !== 0) {
            throw new Error(`Atlas pixel unexpectedly painted around rescue order ${rescueOrder}`)
          }
          continue
        }

        const [red, green, blue] = parseColor(expectedColor)
        if (
          actualAlpha !== 255 ||
          atlasBuffer[pixelOffset] !== red ||
          atlasBuffer[pixelOffset + 1] !== green ||
          atlasBuffer[pixelOffset + 2] !== blue
        ) {
          throw new Error(`Atlas pixel mismatch for rescue order ${rescueOrder}`)
        }
      }
    }
  }
}

function assertFaceAtlasPixels(faceAtlasBuffers, index) {
  const facingField = index.fields.indexOf('facing')
  const poseField = index.fields.indexOf('pose')
  for (const [rescueOrder, row] of index.cats.entries()) {
    const catId = row[0]
    const facing = index.dictionaries.facing[row[facingField]]
    const pose = index.dictionaries.pose[row[poseField]]
    const crop = FACE_CROP_ORIGINS[pose]?.[facing]
    if (!crop) throw new Error(`Missing face crop for rescue order ${rescueOrder}`)
    const matrix = mooncatparser(catId)
    const [cropX, cropY] = crop
    const sheet = Math.floor(rescueOrder / CATS_PER_ATLAS)
    const cell = rescueOrder % CATS_PER_ATLAS
    const cellColumn = cell % ATLAS_COLUMNS
    const cellRow = Math.floor(cell / ATLAS_COLUMNS)
    const faceAtlasBuffer = faceAtlasBuffers[sheet]

    for (let y = 0; y < FACE_CELL_HEIGHT; y += 1) {
      for (let x = 0; x < FACE_CELL_WIDTH; x += 1) {
        const sourceColor = matrix[cropX + x]?.[cropY + y] ?? null
        const expectedColor = FACE_MASK[x][y] === '1' ? sourceColor : null
        const atlasX = cellColumn * FACE_CELL_WIDTH + x
        const atlasY = cellRow * FACE_CELL_HEIGHT + y
        const pixelOffset = (atlasY * FACE_ATLAS_WIDTH + atlasX) * 4
        const actualAlpha = faceAtlasBuffer[pixelOffset + 3]

        if (expectedColor === null) {
          if (actualAlpha !== 0) {
            throw new Error(`Face atlas pixel unexpectedly painted around rescue order ${rescueOrder}`)
          }
          continue
        }

        const [red, green, blue] = parseColor(expectedColor)
        if (
          actualAlpha !== 255 ||
          faceAtlasBuffer[pixelOffset] !== red ||
          faceAtlasBuffer[pixelOffset + 1] !== green ||
          faceAtlasBuffer[pixelOffset + 2] !== blue
        ) {
          throw new Error(`Face atlas pixel mismatch for rescue order ${rescueOrder}`)
        }
      }
    }
  }
}

async function main() {
  const index = await readJson(INDEX_PATH)
  validateEncodedIndex(index)
  validateClassificationArtifact(await readJson(CLASSIFICATIONS_PATH))
  validateMoonCatNamesArtifact(await readJson(NAMES_PATH), { expectedCount: CAT_COUNT })

  const manifest = await readJson(MANIFEST_PATH)
  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Manifest schemaVersion must be ${MANIFEST_SCHEMA_VERSION}`)
  }
  if (manifest.count !== CAT_COUNT) {
    throw new Error(`Manifest count must be ${CAT_COUNT}`)
  }
  const atlas = manifest.atlas
  const expectedSheetCount = Math.ceil(CAT_COUNT / CATS_PER_ATLAS)
  for (const [field, expected] of [
    ['catsPerAtlas', CATS_PER_ATLAS],
    ['sheetCount', expectedSheetCount],
    ['cellWidth', CELL_WIDTH],
    ['cellHeight', CELL_HEIGHT],
    ['width', ATLAS_WIDTH],
    ['height', ATLAS_HEIGHT],
  ]) {
    if (atlas[field] !== expected) {
      throw new Error(`Manifest atlas.${field} must be ${expected}`)
    }
  }
  if (atlas.format !== 'webp' || atlas.compression !== 'lossless') {
    throw new Error('Manifest must describe lossless WebP atlases')
  }

  const entries = await fs.readdir(ATLAS_DIR, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && /^atlas-\d{3}\.webp$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
  if (files.length !== expectedSheetCount) {
    throw new Error(`Expected ${expectedSheetCount} atlas files, found ${files.length}`)
  }

  const sizes = []
  const atlasBuffers = []
  for (const filename of files) {
    const filePath = path.join(ATLAS_DIR, filename)
    const metadata = await sharp(filePath).metadata()
    if (metadata.format !== 'webp' || metadata.width !== ATLAS_WIDTH || metadata.height !== ATLAS_HEIGHT) {
      throw new Error(`${filename} is not a ${ATLAS_WIDTH}x${ATLAS_HEIGHT} WebP atlas`)
    }
    if (metadata.hasAlpha !== true) {
      throw new Error(`${filename} does not preserve an alpha channel`)
    }
    const { data } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true })
    atlasBuffers.push(data)
    sizes.push((await fs.stat(filePath)).size)
  }

  if (typeof mooncatparser !== 'function') {
    throw new Error('Could not load the official mooncatparser 1.0.0 package for pixel validation')
  }
  assertAtlasPixels(atlasBuffers, index)

  if (Array.isArray(atlas.bytes) && JSON.stringify(atlas.bytes) !== JSON.stringify(sizes)) {
    throw new Error('Manifest atlas byte sizes do not match the generated files')
  }

  const totalBytes = sizes.reduce((total, size) => total + size, 0)
  const faceAtlas = manifest.faceAtlas
  if (!faceAtlas) {
    throw new Error('Manifest is missing faceAtlas metadata')
  }
  const expectedFaceSheetCount = Math.ceil(CAT_COUNT / CATS_PER_ATLAS)
  for (const [field, expected] of [
    ['catsPerAtlas', CATS_PER_ATLAS],
    ['sheetCount', expectedFaceSheetCount],
    ['cellWidth', FACE_CELL_WIDTH],
    ['cellHeight', FACE_CELL_HEIGHT],
    ['width', FACE_ATLAS_WIDTH],
    ['height', FACE_ATLAS_HEIGHT],
  ]) {
    if (faceAtlas[field] !== expected) {
      throw new Error(`Manifest faceAtlas.${field} must be ${expected}`)
    }
  }
  if (faceAtlas.format !== 'webp' || faceAtlas.compression !== 'lossless') {
    throw new Error('Manifest must describe lossless WebP face atlases')
  }

  const faceEntries = await fs.readdir(FACE_ATLAS_DIR, { withFileTypes: true })
  const faceFiles = faceEntries
    .filter((entry) => entry.isFile() && /^face-atlas-\d{3}\.webp$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
  if (faceFiles.length !== expectedFaceSheetCount) {
    throw new Error(`Expected ${expectedFaceSheetCount} face atlas files, found ${faceFiles.length}`)
  }

  const faceSizes = []
  const faceAtlasBuffers = []
  for (const filename of faceFiles) {
    const filePath = path.join(FACE_ATLAS_DIR, filename)
    const metadata = await sharp(filePath).metadata()
    if (metadata.format !== 'webp' || metadata.width !== FACE_ATLAS_WIDTH || metadata.height !== FACE_ATLAS_HEIGHT) {
      throw new Error(`${filename} is not a ${FACE_ATLAS_WIDTH}x${FACE_ATLAS_HEIGHT} WebP face atlas`)
    }
    if (metadata.hasAlpha !== true) {
      throw new Error(`${filename} does not preserve an alpha channel`)
    }
    const { data } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true })
    faceAtlasBuffers.push(data)
    faceSizes.push((await fs.stat(filePath)).size)
  }
  assertFaceAtlasPixels(faceAtlasBuffers, index)
  if (Array.isArray(faceAtlas.bytes) && JSON.stringify(faceAtlas.bytes) !== JSON.stringify(faceSizes)) {
    throw new Error('Manifest faceAtlas byte sizes do not match the generated files')
  }

  const totalFaceBytes = faceSizes.reduce((total, size) => total + size, 0)
  console.log(
    `Generated data is valid: ${CAT_COUNT.toLocaleString()} unique indexed cats, ` +
      `${files.length} ${ATLAS_WIDTH}x${ATLAS_HEIGHT} lossless WebP atlases, ` +
      `${totalBytes.toLocaleString()} atlas bytes, and ${faceFiles.length} ` +
      `${FACE_ATLAS_WIDTH}x${FACE_ATLAS_HEIGHT} face atlases (${totalFaceBytes.toLocaleString()} bytes).`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
