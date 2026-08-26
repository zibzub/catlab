import { MoonCatSprite } from './MoonCatSprite'
import type { AtlasManifest, CatRecord, GridViewMode } from '../types'

interface CatTileProps {
  cat: CatRecord
  manifest: AtlasManifest
  viewMode: GridViewMode
  showRings: boolean
  selected: boolean
  onToggle: (rescueOrder: number) => void
}

export function CatTile({ cat, manifest, viewMode, showRings, selected, onToggle }: CatTileProps) {
  const label = `MoonCat rescue order ${cat.rescueOrder}, ${cat.catId}, ${cat.hueName} ${cat.pattern}`
  return (
    <button
      className={`cat-tile cat-tile--${viewMode}${selected ? ' cat-tile--selected' : ''}`}
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={() => onToggle(cat.rescueOrder)}
    >
      <MoonCatSprite cat={cat} manifest={manifest} variant={viewMode} showRings={showRings} />
      {viewMode === 'compact' ? (
        <span className="cat-tile__compact-id">#{cat.rescueOrder.toLocaleString()}</span>
      ) : (
        <span className="cat-tile__details">
          <span className="cat-tile__identity">
            <strong>#{cat.rescueOrder.toLocaleString()}</strong>
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
}
