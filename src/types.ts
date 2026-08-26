export interface CatRecord {
  rescueOrder: number
  catId: string
  rescueYear: number
  hueInt: number
  hueName: string
  pale: boolean
  facing: string
  expression: string
  pattern: string
  pose: string
  genesis: boolean
}

export type GridViewMode = 'compact' | 'detailed'

export interface EncodedIndex {
  schemaVersion: number
  count: number
  rescueOrder: string
  fields: string[]
  dictionaries: Record<string, string[]>
  flags: string[]
  cats: Array<Array<string | number>>
}

export interface AtlasManifest {
  schemaVersion: number
  count: number
  source: {
    file: string
    sha256: string
  }
  renderer: {
    package: string
    version: string
    mode: string
  }
  metadata: {
    path: string
    schemaVersion: number
    bytes: number
  }
  atlas: {
    directory: string
    pattern: string
    columns: number
    rows: number
    catsPerAtlas: number
    sheetCount: number
    cellWidth: number
    cellHeight: number
    width: number
    height: number
    format: string
    compression: string
    mapping: string
    bytes: number[]
  }
}

export type SelectFilter = 'all' | string

export interface FilterState {
  query: string
  hueName: SelectFilter
  pattern: SelectFilter
  pose: SelectFilter
  expression: SelectFilter
  facing: SelectFilter
  rescueYear: SelectFilter
  pale: 'all' | 'pale' | 'not-pale'
  genesis: 'all' | 'genesis' | 'not-genesis'
}
