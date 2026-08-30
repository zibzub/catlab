import { memo, type CSSProperties } from 'react'
import { assetPath } from '../data'
import type { AtlasManifest, CatRecord, GridArtMode, GridSize, GridViewMode } from '../types'

function atlasSheetPath(atlas: AtlasManifest['atlas'], sheet: number) {
  const filename = atlas.pattern.replace('{sheet:03}', String(sheet).padStart(3, '0'))
  return `${atlas.directory}/${filename}`
}

interface MoonCatSpriteProps {
  cat: CatRecord
  manifest: AtlasManifest
  variant?: GridViewMode | 'palette'
  artMode?: GridArtMode
  gridSize?: GridSize
}

export const MoonCatSprite = memo(function MoonCatSprite({
  cat,
  manifest,
  variant = 'detailed',
  artMode = 'bodies',
  gridSize = 'medium',
}: MoonCatSpriteProps) {
  const atlas = artMode === 'faces' && variant !== 'palette' ? manifest.faceAtlas : manifest.atlas
  const cell = cat.rescueOrder % atlas.catsPerAtlas
  const sheet = Math.floor(cat.rescueOrder / atlas.catsPerAtlas)
  const column = cell % atlas.columns
  const row = Math.floor(cell / atlas.columns)
  const scale = variant === 'palette'
    ? 3
    : variant === 'list'
      ? artMode === 'faces'
        ? gridSize === 'small' ? 4 : 6
        : gridSize === 'small' ? 2 : 3
    : artMode === 'faces'
      ? variant === 'compact'
        ? { small: 4, medium: 5, large: 6 }[gridSize]
        : { small: 5, medium: 6, large: 7 }[gridSize]
      : gridSize === 'small'
        ? variant === 'compact'
          ? 3
          : 4
        : gridSize === 'large'
          ? variant === 'compact'
            ? 5
            : 6
          : variant === 'compact'
            ? 4
            : 4
  const spriteBoxStyle = {
    width: atlas.cellWidth * scale,
    height: atlas.cellHeight * scale,
  } satisfies CSSProperties
  const spriteCellStyle = {
    width: atlas.cellWidth,
    height: atlas.cellHeight,
    backgroundImage: `url(${assetPath(atlasSheetPath(atlas, sheet))})`,
    backgroundPosition: `-${column * atlas.cellWidth}px -${row * atlas.cellHeight}px`,
    backgroundSize: `${atlas.width}px ${atlas.height}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  } satisfies CSSProperties

  return (
    <div className={`cat-art cat-art--${variant} cat-art--${artMode}`} aria-hidden="true">
      <div className="cat-art__platform" />
      <div className="cat-art__sprite" style={spriteBoxStyle}>
        <div className="cat-art__sprite-cell" style={spriteCellStyle} />
      </div>
    </div>
  )
})
