import type { AtlasManifest, CatRecord, EncodedIndex } from './types'

const EXPECTED_FIELDS = [
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

function dictionaryValue(index: EncodedIndex, field: string, value: string | number) {
  const dictionaryIndex = Number(value)
  const dictionary = index.dictionaries[field]
  if (!dictionary || !Number.isInteger(dictionaryIndex) || !dictionary[dictionaryIndex]) {
    throw new Error(`Invalid ${field} dictionary value in generated index`)
  }
  return dictionary[dictionaryIndex]
}

export function decodeCatalog(index: EncodedIndex): CatRecord[] {
  if (index.schemaVersion !== 1 || index.count !== index.cats.length) {
    throw new Error('Generated catalog metadata has an unsupported shape')
  }
  if (JSON.stringify(index.fields) !== JSON.stringify(EXPECTED_FIELDS)) {
    throw new Error('Generated catalog fields do not match the app schema')
  }

  return index.cats.map((row, rescueOrder) => {
    if (row.length !== EXPECTED_FIELDS.length) {
      throw new Error(`Generated catalog row ${rescueOrder} has the wrong field count`)
    }
    const [catId, rescueYear, hueInt, hueName, pale, facing, expression, pattern, pose, genesis] = row
    if (typeof catId !== 'string') {
      throw new Error(`Generated catalog row ${rescueOrder} has an invalid catId`)
    }
    return {
      rescueOrder,
      catId,
      rescueYear: Number(rescueYear),
      hueInt: Number(hueInt),
      hueName: dictionaryValue(index, 'hueName', hueName),
      pale: pale === 1,
      facing: dictionaryValue(index, 'facing', facing),
      expression: dictionaryValue(index, 'expression', expression),
      pattern: dictionaryValue(index, 'pattern', pattern),
      pose: dictionaryValue(index, 'pose', pose),
      genesis: genesis === 1,
      nameTimestamp: null,
    }
  })
}

export function assetPath(relativePath: string) {
  const base = import.meta.env.BASE_URL
  return `${base.endsWith('/') ? base : `${base}/`}${relativePath}`
}

export async function loadGeneratedData() {
  const [indexResponse, manifestResponse] = await Promise.all([
    fetch(assetPath('data/mooncats.json')),
    fetch(assetPath('data/atlas-manifest.json')),
  ])
  if (!indexResponse.ok || !manifestResponse.ok) {
    throw new Error(
      'Generated CatLab data is missing. Run npm run generate before starting the app.',
    )
  }
  const [index, manifest] = (await Promise.all([
    indexResponse.json(),
    manifestResponse.json(),
  ])) as [EncodedIndex, AtlasManifest]
  return { cats: decodeCatalog(index), manifest }
}
