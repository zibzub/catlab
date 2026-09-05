import { describe, expect, it } from 'vitest'
import { getMoonCatAtlasCell } from '../atlas'
import type { AtlasManifest } from '../../types'

function atlas(overrides: Partial<AtlasManifest['atlas']> = {}): AtlasManifest['atlas'] {
  return {
    directory: 'images/full',
    pattern: 'mooncat-{sheet:03}.webp',
    columns: 16,
    rows: 16,
    catsPerAtlas: 256,
    sheetCount: 100,
    cellWidth: 21,
    cellHeight: 22,
    width: 336,
    height: 352,
    format: 'webp',
    compression: 'lossless',
    mapping: 'rescue-order-row-major',
    bytes: [],
    ...overrides,
  }
}

const manifest: AtlasManifest = {
  schemaVersion: 1,
  count: 25_440,
  source: { file: 'catalog.json', sha256: 'test' },
  renderer: { package: 'mooncatparser', version: '1.0.0', mode: 'test' },
  metadata: { path: 'data/catalog.json', schemaVersion: 1, bytes: 0 },
  atlas: atlas(),
  faceAtlas: atlas({
    directory: 'images/faces',
    pattern: 'face-{sheet:03}.webp',
    columns: 16,
    rows: 16,
    catsPerAtlas: 256,
    cellWidth: 11,
    cellHeight: 11,
    width: 176,
    height: 176,
  }),
}

describe('MoonCat atlas cell mapping', () => {
  it.each([
    [0, 0, 0, 0],
    [255, 0, 15, 15],
    [256, 1, 0, 0],
    [25_439, 99, 15, 5],
  ])('maps rescue order %i to sheet %i, column %i, row %i', (order, sheet, column, row) => {
    const cell = getMoonCatAtlasCell(manifest, order, 'bodies')
    expect(cell.sheetIndex).toBe(sheet)
    expect(cell.column).toBe(column)
    expect(cell.row).toBe(row)
    expect(cell.cellIndex).toBe(row * 16 + column)
    expect(cell.x).toBe(column * 21)
    expect(cell.y).toBe(row * 22)
  })

  it('uses full and face manifest metadata and asset paths', () => {
    const full = getMoonCatAtlasCell(manifest, 256, 'bodies')
    const face = getMoonCatAtlasCell(manifest, 256, 'faces')
    expect(full.cellWidth).toBe(21)
    expect(full.cellHeight).toBe(22)
    expect(full.assetUrl).toMatch(/images\/full\/mooncat-001\.webp$/)
    expect(face.cellWidth).toBe(11)
    expect(face.cellHeight).toBe(11)
    expect(face.assetUrl).toMatch(/images\/faces\/face-001\.webp$/)
  })
})
