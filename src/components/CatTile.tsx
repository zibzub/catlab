import { memo } from 'react'
import { MoonCatSprite } from './MoonCatSprite'
import { getMoonCatName, type MoonCatNames } from '../mooncatDetails'
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
  names: MoonCatNames
  viewMode: GridViewMode
  artMode: GridArtMode
  gridSize: GridSize
  idlePulse?: number
  idleHeld: boolean
  selected: boolean
  interactionMode: CollectionInteractionMode
  onToggle: (rescueOrder: number) => void
  onInspect: (cat: CatRecord, trigger: HTMLButtonElement) => void
}

export const CatTile = memo(function CatTile({
  cat,
  manifest,
  names,
  viewMode,
  artMode,
  gridSize,
  idlePulse,
  idleHeld,
  selected,
  interactionMode,
  onToggle,
  onInspect,
}: CatTileProps) {
  const name = getMoonCatName(names, cat.rescueOrder)
  const nameSuffix = name ? `, ${name}` : ''
  const label = interactionMode === 'inspect'
    ? `Inspect MoonCat rescue order ${cat.rescueOrder}${nameSuffix}, ${cat.hueName} ${cat.pattern}`
    : `MoonCat rescue order ${cat.rescueOrder}${nameSuffix}, ${cat.hueName} ${cat.pattern}`
  return (
    <button
      className={`cat-tile cat-tile--${viewMode} cat-tile--${artMode} cat-tile--size-${gridSize}${idlePulse !== undefined ? ' cat-tile--idle-hop' : ''}${idleHeld ? ' cat-tile--idle-held' : ''}${selected ? ' cat-tile--selected' : ''}`}
      type="button"
      aria-label={label}
      aria-pressed={interactionMode === 'select' ? selected : undefined}
      aria-haspopup={interactionMode === 'inspect' ? 'dialog' : undefined}
      onClick={(event) => {
        if (interactionMode === 'inspect') onInspect(cat, event.currentTarget)
        else onToggle(cat.rescueOrder)
      }}
    >
      <MoonCatSprite key={idlePulse} cat={cat} manifest={manifest} variant={viewMode} artMode={artMode} gridSize={gridSize} />
      {viewMode === 'compact' ? (
        <span className="cat-tile__compact-id">
          <span className="cat-tile__compact-number">{cat.rescueOrder}</span>
          {name && <span className="cat-tile__compact-name" title={name}>{name}</span>}
        </span>
      ) : (
        <span className="cat-tile__details">
          <span className="cat-tile__identity">
            <strong>{cat.rescueOrder}</strong>
            <span className="cat-tile__year">{cat.rescueYear}</span>
          </span>
          <span className="cat-tile__name" title={name || undefined}>{name ?? ''}</span>
          <span className="cat-tile__id">{cat.catId}</span>
          <span className="cat-tile__traits">
            <span>{cat.hueName}</span>
            <span>{cat.pattern}</span>
            <span>{cat.pose}</span>
          </span>
        </span>
      )}
    </button>
  )
})
