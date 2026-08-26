import type { CSSProperties } from 'react'
import { assetPath } from '../data'
import type { AtlasManifest, CatRecord, GridViewMode } from '../types'

interface MoonCatSpriteProps {
  cat: CatRecord
  manifest: AtlasManifest
  variant?: GridViewMode | 'palette'
  showRings?: boolean
}

export function MoonCatSprite({
  cat,
  manifest,
  variant = 'detailed',
  showRings = true,
}: MoonCatSpriteProps) {
  const { atlas } = manifest
  const cell = cat.rescueOrder % atlas.catsPerAtlas
  const sheet = Math.floor(cat.rescueOrder / atlas.catsPerAtlas)
  const column = cell % atlas.columns
  const row = Math.floor(cell / atlas.columns)
  const scale = variant === 'palette' ? 3 : variant === 'compact' ? 4 : 5
  const style = {
    width: atlas.cellWidth * scale,
    height: atlas.cellHeight * scale,
    backgroundImage: `url(${assetPath(`data/atlases/atlas-${String(sheet).padStart(3, '0')}.webp`)})`,
    backgroundPosition: `-${column * atlas.cellWidth * scale}px -${row * atlas.cellHeight * scale}px`,
    backgroundSize: `${atlas.width * scale}px ${atlas.height * scale}px`,
  } satisfies CSSProperties

  return (
    <div className={`cat-art cat-art--${variant}`} aria-hidden="true">
      {showRings && <div className="cat-art__platform" />}
      <div className="cat-art__sprite" style={style} />
    </div>
  )
}
