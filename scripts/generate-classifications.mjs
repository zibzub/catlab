import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  CLASSIFICATION_CATEGORY_KEYS,
  validateClassificationArtifact,
} from './lib/mooncat-classifications.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const DEFAULT_SOURCE = path.resolve(ROOT, '../catmoon/public/data/mooncat-filters.json')
const OUTPUT_PATH = path.join(ROOT, 'public/data/mooncat-classifications.json')

function parseArgs(argv) {
  let source = process.env.CATMOON_FILTERS || DEFAULT_SOURCE
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--source') {
      source = argv[index + 1]
      if (!source) throw new Error('--source requires a mooncat-filters.json path')
      index += 1
    } else if (argument.startsWith('--source=')) {
      source = argument.slice('--source='.length)
      if (!source) throw new Error('--source requires a mooncat-filters.json path')
    } else if (argument === '--help' || argument === '-h') {
      console.log('Usage: npm run generate:classifications -- [--source path/to/mooncat-filters.json]')
      process.exit(0)
    } else {
      throw new Error(`Unknown option ${argument}`)
    }
  }
  return path.resolve(process.cwd(), source)
}

async function writeAtomic(filePath, contents) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`
  await fs.writeFile(temporaryPath, contents)
  await fs.rename(temporaryPath, filePath)
}

function compactGroupMetadata(groups) {
  if (!groups || typeof groups !== 'object' || Array.isArray(groups)) return {}
  const selected = {}
  for (const [key, group] of Object.entries(groups)) {
    if (!group || typeof group !== 'object' || Array.isArray(group)) continue
    const categories = Array.isArray(group.categories)
      ? group.categories.filter((category) => CLASSIFICATION_CATEGORY_KEYS.includes(category))
      : []
    if (categories.length === 0) continue
    selected[key] = {
      label: typeof group.label === 'string' ? group.label : key,
      categories,
    }
  }
  return selected
}

async function main() {
  const sourcePath = parseArgs(process.argv.slice(2))
  const sourceBuffer = await fs.readFile(sourcePath)
  const source = JSON.parse(sourceBuffer.toString('utf8'))
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('CatMoon filter source must be an object')
  }
  if (!Number.isInteger(source.catCount) || !Number.isInteger(source.maxId)) {
    throw new Error('CatMoon filter source must include catCount and maxId')
  }

  const categories = {}
  for (const key of CLASSIFICATION_CATEGORY_KEYS) {
    const category = source.categories?.[key]
    if (!category || !Array.isArray(category.ids)) {
      throw new Error(`CatMoon filter source is missing categories.${key}.ids`)
    }
    const ids = [...category.ids].sort((a, b) => a - b)
    if (ids.some((id, index) => !Number.isInteger(id) || (index > 0 && id === ids[index - 1]))) {
      throw new Error(`CatMoon filter source categories.${key}.ids contains invalid or duplicate IDs`)
    }
    categories[key] = {
      label: typeof category.label === 'string' ? category.label : key,
      group: typeof category.group === 'string' ? category.group : 'other',
      ids,
    }
  }

  const artifact = {
    schemaVersion: 1,
    count: source.catCount,
    maxId: source.maxId,
    source: {
      file: path.relative(ROOT, sourcePath),
      sha256: createHash('sha256').update(sourceBuffer).digest('hex'),
    },
    categoryOrder: CLASSIFICATION_CATEGORY_KEYS,
    categories,
    groups: compactGroupMetadata(source.groups),
  }
  validateClassificationArtifact(artifact, { expectedCount: source.catCount })
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await writeAtomic(OUTPUT_PATH, `${JSON.stringify(artifact)}\n`)
  console.log(
    `Generated ${CLASSIFICATION_CATEGORY_KEYS.length} CatMoon classification sets ` +
      `for ${source.catCount.toLocaleString()} rescue orders at ${OUTPUT_PATH}.`,
  )
  console.log(`Source: ${sourcePath}`)
  console.log(`Source SHA-256: ${artifact.source.sha256}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
