import { memo, type CSSProperties } from 'react'
import { getMoonCatAtlasCell } from '../mooncat-index/atlas'
import type { AtlasManifest, CatRecord, GridArtMode, GridSize, GridViewMode } from '../types'

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
  const atlasCell = getMoonCatAtlasCell(manifest, cat.rescueOrder, artMode === 'faces' && variant !== 'palette' ? 'faces' : 'bodies')
  const { atlas } = atlasCell
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
    width: atlasCell.cellWidth * scale,
    height: atlasCell.cellHeight * scale,
  } satisfies CSSProperties
  const spriteCellStyle = {
    width: atlasCell.cellWidth,
    height: atlasCell.cellHeight,
    backgroundImage: `url(${atlasCell.assetUrl})`,
    backgroundPosition: `-${atlasCell.x}px -${atlasCell.y}px`,
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
