import { createRequire } from 'node:module'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import {
  ATLAS_COLUMNS,
  ATLAS_HEIGHT,
  ATLAS_ROWS,
  ATLAS_WIDTH,
  CAT_COUNT,
  CELL_HEIGHT,
  CELL_WIDTH,
  CATS_PER_ATLAS,
  INDEX_SCHEMA_VERSION,
  MANIFEST_SCHEMA_VERSION,
  atlasPosition,
  encodeIndex,
  sha256,
  validateTraits,
} from './lib/catalog.mjs'

const require = createRequire(import.meta.url)
const mooncatModule = require('mooncatparser')
const mooncatparser =
  typeof mooncatModule === 'function'
    ? mooncatModule
    : mooncatModule.mooncatparser ?? mooncatModule.default

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const DEFAULT_TRAITS = path.resolve(
  ROOT,
  '../mckb/references/upstream/mooncatrescue/mooncat_traits.json',
)
const DATA_DIR = path.join(ROOT, 'public/data')
const ATLAS_DIR = path.join(DATA_DIR, 'atlases')
const INDEX_PATH = path.join(DATA_DIR, 'mooncats.json')
const MANIFEST_PATH = path.join(DATA_DIR, 'atlas-manifest.json')

function parseArgs(argv) {
  let traits = process.env.CATLAB_TRAITS || DEFAULT_TRAITS
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--traits') {
      traits = argv[index + 1]
      if (!traits) {
        throw new Error('--traits requires a JSON file path')
      }
      index += 1
    } else if (argument.startsWith('--traits=')) {
      traits = argument.slice('--traits='.length)
      if (!traits) {
        throw new Error('--traits requires a JSON file path')
      }
    } else if (argument === '--help' || argument === '-h') {
      console.log('Usage: npm run generate -- [--traits path/to/mooncat_traits.json]')
      process.exit(0)
    } else {
      throw new Error(`Unknown option ${argument}`)
    }
  }
  return path.resolve(process.cwd(), traits)
}

async function writeAtomic(filePath, contents) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`
  await fs.writeFile(temporaryPath, contents)
  await fs.rename(temporaryPath, filePath)
}

function parseColor(color, catId) {
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) {
    throw new Error(`mooncatparser returned an invalid color for ${catId}`)
  }
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ]
}

function paintCat(buffer, matrix, rescueOrder, catId) {
  if (!Array.isArray(matrix) || matrix.length === 0 || matrix.length > CELL_WIDTH) {
    throw new Error(`mooncatparser returned an invalid width for ${catId}`)
  }
  const width = matrix.length
  const height = matrix[0].length
  if (!Number.isInteger(height) || height === 0 || height > CELL_HEIGHT) {
    throw new Error(`mooncatparser returned an invalid height for ${catId}`)
  }
  if (matrix.some((column) => !Array.isArray(column) || column.length !== height)) {
    throw new Error(`mooncatparser returned a non-rectangular matrix for ${catId}`)
  }

  const position = atlasPosition(rescueOrder)
  const originX = position.column * CELL_WIDTH + Math.floor((CELL_WIDTH - width) / 2)
  const originY = position.row * CELL_HEIGHT + Math.floor((CELL_HEIGHT - height) / 2)
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const color = matrix[x][y]
      if (color === null) {
        continue
      }
      const [red, green, blue] = parseColor(color, catId)
      const offset = ((originY + y) * ATLAS_WIDTH + originX + x) * 4
      buffer[offset] = red
      buffer[offset + 1] = green
      buffer[offset + 2] = blue
      buffer[offset + 3] = 255
    }
  }
}

async function removeOldAtlases() {
  const entries = await fs.readdir(ATLAS_DIR, { withFileTypes: true }).catch(() => [])
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /^atlas-\d{3}\.webp$/.test(entry.name))
      .map((entry) => fs.unlink(path.join(ATLAS_DIR, entry.name))),
  )
}

async function generateAtlases(records) {
  const sheetCount = Math.ceil(records.length / CATS_PER_ATLAS)
  const byteSizes = []

  for (let sheet = 0; sheet < sheetCount; sheet += 1) {
    const buffer = Buffer.alloc(ATLAS_WIDTH * ATLAS_HEIGHT * 4)
    const start = sheet * CATS_PER_ATLAS
    const end = Math.min(start + CATS_PER_ATLAS, records.length)
    for (let index = start; index < end; index += 1) {
      const record = records[index]
      paintCat(buffer, mooncatparser(record.catId), record.rescueOrder, record.catId)
    }

    const filename = `atlas-${String(sheet).padStart(3, '0')}.webp`
    const outputPath = path.join(ATLAS_DIR, filename)
    const temporaryPath = `${outputPath}.tmp-${process.pid}`
    await sharp(buffer, {
      raw: { width: ATLAS_WIDTH, height: ATLAS_HEIGHT, channels: 4 },
    })
      .webp({ lossless: true, effort: 6 })
      .toFile(temporaryPath)
    await fs.rename(temporaryPath, outputPath)
    byteSizes.push((await fs.stat(outputPath)).size)
  }

  return { sheetCount, byteSizes }
}

async function main() {
  if (typeof mooncatparser !== 'function') {
    throw new Error('Could not load the official mooncatparser 1.0.0 package')
  }

  const sourcePath = parseArgs(process.argv.slice(2))
  const sourceBuffer = await fs.readFile(sourcePath)
  const sourceJson = JSON.parse(sourceBuffer.toString('utf8'))
  const records = validateTraits(sourceJson)
  const index = encodeIndex(records)

  await fs.mkdir(ATLAS_DIR, { recursive: true })
  await removeOldAtlases()
  const { sheetCount, byteSizes } = await generateAtlases(records)
  await writeAtomic(INDEX_PATH, `${JSON.stringify(index)}\n`)

  const metadataBytes = (await fs.stat(INDEX_PATH)).size
  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    count: CAT_COUNT,
    source: {
      file: path.basename(sourcePath),
      sha256: sha256(sourceBuffer),
    },
    renderer: {
      package: 'mooncatparser',
      version: '1.0.0',
      mode: 'bare-native',
    },
    metadata: {
      path: 'data/mooncats.json',
      schemaVersion: INDEX_SCHEMA_VERSION,
      bytes: metadataBytes,
    },
    atlas: {
      directory: 'data/atlases',
      pattern: 'atlas-{sheet:03}.webp',
      columns: ATLAS_COLUMNS,
      rows: ATLAS_ROWS,
      catsPerAtlas: CATS_PER_ATLAS,
      sheetCount,
      cellWidth: CELL_WIDTH,
      cellHeight: CELL_HEIGHT,
      width: ATLAS_WIDTH,
      height: ATLAS_HEIGHT,
      format: 'webp',
      compression: 'lossless',
      mapping: 'rescueOrder -> floor(rescueOrder / catsPerAtlas), rescueOrder % catsPerAtlas',
      bytes: byteSizes,
    },
  }
  await writeAtomic(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)

  const totalAtlasBytes = byteSizes.reduce((total, size) => total + size, 0)
  console.log(
    `Generated ${records.length.toLocaleString()} cats, ${sheetCount} lossless WebP atlases ` +
      `(${totalAtlasBytes.toLocaleString()} bytes) and ${metadataBytes.toLocaleString()} bytes of metadata.`,
  )
  console.log(`Source: ${sourcePath}`)
  console.log(`Source SHA-256: ${sha256(sourceBuffer)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
