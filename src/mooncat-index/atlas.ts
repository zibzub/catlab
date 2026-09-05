import { assetPath } from '../data'
import type { AtlasManifest, GridArtMode } from '../types'

type AtlasSource = AtlasManifest['atlas'] | AtlasManifest['faceAtlas']

export interface MoonCatAtlasCell {
  atlas: AtlasSource
  sheetIndex: number
  cellIndex: number
  column: number
  row: number
  x: number
  y: number
  cellWidth: number
  cellHeight: number
  assetUrl: string
}

function atlasSheetFilename(atlas: AtlasSource, sheetIndex: number) {
  return atlas.pattern.replace('{sheet:03}', String(sheetIndex).padStart(3, '0'))
}

export function getMoonCatAtlasCell(
  manifest: AtlasManifest,
  rescueOrder: number,
  artMode: GridArtMode,
): MoonCatAtlasCell {
  const atlas = artMode === 'faces' ? manifest.faceAtlas : manifest.atlas
  const cellIndex = rescueOrder % atlas.catsPerAtlas
  const sheetIndex = Math.floor(rescueOrder / atlas.catsPerAtlas)
  const column = cellIndex % atlas.columns
  const row = Math.floor(cellIndex / atlas.columns)
  return {
    atlas,
    sheetIndex,
    cellIndex,
    column,
    row,
    x: column * atlas.cellWidth,
    y: row * atlas.cellHeight,
    cellWidth: atlas.cellWidth,
    cellHeight: atlas.cellHeight,
    assetUrl: assetPath(`${atlas.directory}/${atlasSheetFilename(atlas, sheetIndex)}`),
  }
}
