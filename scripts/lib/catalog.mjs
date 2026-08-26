import { createHash } from 'node:crypto'

export const CAT_COUNT = 25_440
export const ATLAS_COLUMNS = 16
export const ATLAS_ROWS = 16
export const CATS_PER_ATLAS = ATLAS_COLUMNS * ATLAS_ROWS
// The canonical MoonCat renderer consumes data[x][y]: up to 21 columns by 22 rows.
export const CELL_WIDTH = 21
export const CELL_HEIGHT = 22
export const ATLAS_WIDTH = ATLAS_COLUMNS * CELL_WIDTH
export const ATLAS_HEIGHT = ATLAS_ROWS * CELL_HEIGHT
export const FACE_CELL_WIDTH = 11
export const FACE_CELL_HEIGHT = 11
export const FACE_ATLAS_WIDTH = ATLAS_COLUMNS * FACE_CELL_WIDTH
export const FACE_ATLAS_HEIGHT = ATLAS_ROWS * FACE_CELL_HEIGHT
export const FACE_MASK = [
  '00111111100',
  '11111111110',
  '11111111111',
  '01111111111',
  '00111111111',
  '00111111111',
  '00111111111',
  '01111111111',
  '11111111111',
  '11111111110',
  '00111111100',
]
export const FACE_CROP_ORIGINS = {
  standing: { left: [0, 0], right: [10, 0] },
  sleeping: { left: [1, 0], right: [8, 0] },
  pouncing: { left: [1, 0], right: [5, 0] },
  stalking: { left: [0, 6], right: [9, 6] },
}
export const INDEX_SCHEMA_VERSION = 1
export const MANIFEST_SCHEMA_VERSION = 1

export const INDEX_FIELDS = [
  'catId',
  'rescueYear',
  'hueInt',
  'hueName',
  'pale',
  'facing',
  'expression',
  'pattern',
  'pose',
  'genesis',
]

export const DICTIONARY_FIELDS = ['hueName', 'facing', 'expression', 'pattern', 'pose']
export const FLAG_FIELDS = ['pale', 'genesis']

const CAT_ID_PATTERN = /^(?:0x)?([0-9a-f]{10})$/i

function fail(message) {
  throw new Error(`Trait validation failed: ${message}`)
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireInteger(value, field, index) {
  if (!Number.isInteger(value)) {
    fail(`record ${index} field ${field} must be an integer`)
  }
}

function requireString(value, field, index) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`record ${index} field ${field} must be a non-empty string`)
  }
}

function normalizeCatId(value, index) {
  if (typeof value !== 'string') {
    fail(`record ${index} field catId must be a 5-byte hexadecimal string`)
  }

  const match = value.match(CAT_ID_PATTERN)
  if (!match) {
    fail(`record ${index} field catId must contain exactly 5 bytes`)
  }

  return `0x${match[1].toLowerCase()}`
}

export function validateTraits(input) {
  if (!Array.isArray(input)) {
    fail('root value must be an array')
  }
  if (input.length !== CAT_COUNT) {
    fail(`expected exactly ${CAT_COUNT} records, received ${input.length}`)
  }

  const orders = new Set()
  const catIds = new Set()
  const records = input.map((raw, index) => {
    if (!isRecord(raw)) {
      fail(`record ${index} must be an object`)
    }

    requireInteger(raw.rescueOrder, 'rescueOrder', index)
    if (raw.rescueOrder < 0 || raw.rescueOrder >= CAT_COUNT) {
      fail(`record ${index} rescueOrder must be within 0..${CAT_COUNT - 1}`)
    }
    if (orders.has(raw.rescueOrder)) {
      fail(`duplicate rescueOrder ${raw.rescueOrder}`)
    }
    orders.add(raw.rescueOrder)

    const catId = normalizeCatId(raw.catId, index)
    if (catIds.has(catId)) {
      fail(`duplicate catId ${catId}`)
    }
    catIds.add(catId)

    requireInteger(raw.rescueYear, 'rescueYear', index)
    requireInteger(raw.hueInt, 'hueInt', index)
    const genesisHue = raw.genesis === true && (raw.hueInt === 1000 || raw.hueInt === 2000)
    if ((raw.hueInt < 0 || raw.hueInt >= 360) && !genesisHue) {
      fail(`record ${index} hueInt must be within 0..359, or the 1000/2000 Genesis sentinel`)
    }
    requireString(raw.hueName, 'hueName', index)
    if (typeof raw.pale !== 'boolean') {
      fail(`record ${index} field pale must be boolean`)
    }
    for (const field of ['facing', 'expression', 'pattern', 'pose']) {
      requireString(raw[field], field, index)
    }
    if (raw.genesis !== undefined && typeof raw.genesis !== 'boolean') {
      fail(`record ${index} field genesis must be boolean when present`)
    }

    return {
      rescueOrder: raw.rescueOrder,
      catId,
      rescueYear: raw.rescueYear,
      hueInt: raw.hueInt,
      hueName: raw.hueName,
      pale: raw.pale,
      facing: raw.facing,
      expression: raw.expression,
      pattern: raw.pattern,
      pose: raw.pose,
      genesis: raw.genesis === true,
    }
  })

  for (let order = 0; order < CAT_COUNT; order += 1) {
    if (!orders.has(order)) {
      fail(`rescueOrder ${order} is missing`)
    }
  }

  return records.sort((a, b) => a.rescueOrder - b.rescueOrder)
}

function sortedDictionary(records, field) {
  return [...new Set(records.map((record) => record[field]))].sort((a, b) =>
    a.localeCompare(b),
  )
}

export function encodeIndex(records) {
  const dictionaries = Object.fromEntries(
    DICTIONARY_FIELDS.map((field) => [field, sortedDictionary(records, field)]),
  )
  const dictionaryIndexes = Object.fromEntries(
    DICTIONARY_FIELDS.map((field) => [
      field,
      new Map(dictionaries[field].map((value, index) => [value, index])),
    ]),
  )

  const cats = records.map((record, index) => {
    if (record.rescueOrder !== index) {
      fail(`sorted record index ${index} does not match rescueOrder ${record.rescueOrder}`)
    }
    return [
      record.catId,
      record.rescueYear,
      record.hueInt,
      dictionaryIndexes.hueName.get(record.hueName),
      record.pale ? 1 : 0,
      dictionaryIndexes.facing.get(record.facing),
      dictionaryIndexes.expression.get(record.expression),
      dictionaryIndexes.pattern.get(record.pattern),
      dictionaryIndexes.pose.get(record.pose),
      record.genesis ? 1 : 0,
    ]
  })

  return {
    schemaVersion: INDEX_SCHEMA_VERSION,
    count: records.length,
    rescueOrder: 'cats array index',
    fields: INDEX_FIELDS,
    dictionaries,
    flags: FLAG_FIELDS,
    cats,
  }
}

export function validateEncodedIndex(index) {
  if (!isRecord(index)) {
    throw new Error('Generated index must be an object')
  }
  if (index.schemaVersion !== INDEX_SCHEMA_VERSION) {
    throw new Error(`Generated index schemaVersion must be ${INDEX_SCHEMA_VERSION}`)
  }
  if (index.count !== CAT_COUNT) {
    throw new Error(`Generated index count must be ${CAT_COUNT}`)
  }
  if (JSON.stringify(index.fields) !== JSON.stringify(INDEX_FIELDS)) {
    throw new Error('Generated index fields do not match the documented schema')
  }
  if (JSON.stringify(index.flags) !== JSON.stringify(FLAG_FIELDS)) {
    throw new Error('Generated index flags do not match the documented schema')
  }
  if (!isRecord(index.dictionaries)) {
    throw new Error('Generated index dictionaries must be an object')
  }
  for (const field of DICTIONARY_FIELDS) {
    if (
      !Array.isArray(index.dictionaries[field]) ||
      index.dictionaries[field].some((value) => typeof value !== 'string' || value.length === 0)
    ) {
      throw new Error(`Generated index dictionary ${field} is invalid`)
    }
  }
  if (!Array.isArray(index.cats) || index.cats.length !== CAT_COUNT) {
    throw new Error(`Generated index cats must contain ${CAT_COUNT} rows`)
  }

  const catIds = new Set()
  for (const [rescueOrder, row] of index.cats.entries()) {
    if (!Array.isArray(row) || row.length !== INDEX_FIELDS.length) {
      throw new Error(`Generated index row ${rescueOrder} has the wrong field count`)
    }
    const [catId, rescueYear, hueInt, hueName, pale, facing, expression, pattern, pose, genesis] = row
    if (typeof catId !== 'string' || !CAT_ID_PATTERN.test(catId)) {
      throw new Error(`Generated index row ${rescueOrder} has an invalid catId`)
    }
    if (catIds.has(catId)) {
      throw new Error(`Generated index has duplicate catId ${catId}`)
    }
    catIds.add(catId)
    if (!Number.isInteger(rescueYear) || !Number.isInteger(hueInt)) {
      throw new Error(`Generated index row ${rescueOrder} has invalid numeric traits`)
    }
    if (![pale, genesis].every((value) => value === 0 || value === 1)) {
      throw new Error(`Generated index row ${rescueOrder} has invalid boolean flags`)
    }
    const genesisHue = genesis === 1 && (hueInt === 1000 || hueInt === 2000)
    if ((hueInt < 0 || hueInt >= 360) && !genesisHue) {
      throw new Error(`Generated index row ${rescueOrder} has an invalid hueInt`)
    }
    for (const [field, value] of [
      ['hueName', hueName],
      ['facing', facing],
      ['expression', expression],
      ['pattern', pattern],
      ['pose', pose],
    ]) {
      if (!Number.isInteger(value) || value < 0 || value >= index.dictionaries[field].length) {
        throw new Error(`Generated index row ${rescueOrder} has invalid ${field} dictionary index`)
      }
    }
  }

  return true
}

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

export function atlasPosition(rescueOrder) {
  const sheet = Math.floor(rescueOrder / CATS_PER_ATLAS)
  const cell = rescueOrder % CATS_PER_ATLAS
  return {
    sheet,
    cell,
    column: cell % ATLAS_COLUMNS,
    row: Math.floor(cell / ATLAS_COLUMNS),
  }
}
