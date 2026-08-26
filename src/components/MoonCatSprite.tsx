import { memo, type CSSProperties } from 'react'
import { assetPath } from '../data'
import type { AtlasManifest, CatRecord, GridSize, GridViewMode } from '../types'

interface MoonCatSpriteProps {
  cat: CatRecord
  manifest: AtlasManifest
  variant?: GridViewMode | 'palette'
  gridSize?: GridSize
}

export const MoonCatSprite = memo(function MoonCatSprite({
  cat,
  manifest,
  variant = 'detailed',
  gridSize = 'medium',
}: MoonCatSpriteProps) {
  const { atlas } = manifest
  const cell = cat.rescueOrder % atlas.catsPerAtlas
  const sheet = Math.floor(cat.rescueOrder / atlas.catsPerAtlas)
  const column = cell % atlas.columns
  const row = Math.floor(cell / atlas.columns)
  const scale =
    variant === 'palette'
      ? 3
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
            : 5
  const spriteBoxStyle = {
    width: atlas.cellWidth * scale,
    height: atlas.cellHeight * scale,
  } satisfies CSSProperties
  const spriteCellStyle = {
    width: atlas.cellWidth,
    height: atlas.cellHeight,
    backgroundImage: `url(${assetPath(`data/atlases/atlas-${String(sheet).padStart(3, '0')}.webp`)})`,
    backgroundPosition: `-${column * atlas.cellWidth}px -${row * atlas.cellHeight}px`,
    backgroundSize: `${atlas.width}px ${atlas.height}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  } satisfies CSSProperties

  return (
    <div className={`cat-art cat-art--${variant}`} aria-hidden="true">
      <div className="cat-art__platform" />
      <div className="cat-art__sprite" style={spriteBoxStyle}>
        <div className="cat-art__sprite-cell" style={spriteCellStyle} />
      </div>
    </div>
  )
})
