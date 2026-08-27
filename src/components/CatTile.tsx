import { memo } from 'react'
import { MoonCatSprite } from './MoonCatSprite'
import type {
  AtlasManifest,
  CatRecord,
  CollectionInteractionMode,
  GridArtMode,
  GridSize,
  GridViewMode,
} from '../types'

interface CatTileProps {
  cat: CatRecord
  manifest: AtlasManifest
  viewMode: GridViewMode
  artMode: GridArtMode
  gridSize: GridSize
  selected: boolean
  interactionMode: CollectionInteractionMode
  onToggle: (rescueOrder: number) => void
  onInspect: (cat: CatRecord, trigger: HTMLButtonElement) => void
}

export const CatTile = memo(function CatTile({
  cat,
  manifest,
  viewMode,
  artMode,
  gridSize,
  selected,
  interactionMode,
  onToggle,
  onInspect,
}: CatTileProps) {
  const label = interactionMode === 'inspect'
    ? `Inspect MoonCat rescue order ${cat.rescueOrder}, ${cat.catId}, ${cat.hueName} ${cat.pattern}`
    : `MoonCat rescue order ${cat.rescueOrder}, ${cat.catId}, ${cat.hueName} ${cat.pattern}`
  return (
    <button
      className={`cat-tile cat-tile--${viewMode} cat-tile--${artMode} cat-tile--size-${gridSize}${selected ? ' cat-tile--selected' : ''}`}
      type="button"
      aria-label={label}
      aria-pressed={interactionMode === 'select' ? selected : undefined}
      aria-haspopup={interactionMode === 'inspect' ? 'dialog' : undefined}
      onClick={(event) => {
        if (interactionMode === 'inspect') onInspect(cat, event.currentTarget)
        else onToggle(cat.rescueOrder)
      }}
    >
      <MoonCatSprite cat={cat} manifest={manifest} variant={viewMode} artMode={artMode} gridSize={gridSize} />
      {viewMode === 'compact' ? (
        <span className="cat-tile__compact-id">{cat.rescueOrder.toLocaleString()}</span>
      ) : (
        <span className="cat-tile__details">
          <span className="cat-tile__identity">
            <strong>{cat.rescueOrder.toLocaleString()}</strong>
            <span className="cat-tile__year">{cat.rescueYear}</span>
          </span>
          <span className="cat-tile__id">{cat.catId}</span>
          <span className="cat-tile__traits">
            <span>{cat.hueName}</span>
            <span>{cat.pattern}</span>
            <span>{cat.pose}</span>
          </span>
          <span className="cat-tile__status">
            {cat.genesis ? 'Genesis' : cat.pale ? 'Pale' : cat.facing}
            <span>{selected ? 'In palette' : 'Add to palette'}</span>
          </span>
        </span>
      )}
    </button>
  )
})
