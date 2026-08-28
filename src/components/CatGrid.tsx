import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CatTile } from './CatTile'
import type { MoonCatNames } from '../mooncatDetails'
import type {
  AtlasManifest,
  CatRecord,
  CollectionInteractionMode,
  GridArtMode,
  GridSize,
  GridViewMode,
} from '../types'

interface CatGridProps {
  cats: CatRecord[]
  manifest: AtlasManifest
  names: MoonCatNames
  viewMode: GridViewMode
  artMode: GridArtMode
  gridSize: GridSize
  showRings: boolean
  showStars: boolean
  showVignette: boolean
  selectedOrders: Set<number>
  interactionMode: CollectionInteractionMode
  onToggle: (rescueOrder: number) => void
  onInspect: (cat: CatRecord, trigger: HTMLButtonElement) => void
}

function columnsForWidth(width: number, viewMode: GridViewMode, artMode: GridArtMode, gridSize: GridSize) {
  const isPhone = width <= 620
  if (artMode === 'faces') {
    const targetTileWidth = viewMode === 'compact'
      ? isPhone
        ? { small: 56, medium: 68, large: 82 }[gridSize]
        : { small: 70, medium: 84, large: 102 }[gridSize]
      : isPhone
        ? { small: 112, medium: 128, large: 148 }[gridSize]
        : { small: 118, medium: 136, large: 158 }[gridSize]
    const maxColumns = viewMode === 'compact' ? 16 : 9
    const gap = isPhone ? 7 : 11
    const calculatedColumns = Math.floor((width + gap) / (targetTileWidth + gap))
    return Math.max(1, Math.min(maxColumns, calculatedColumns))
  }
  const targetTileWidth =
    viewMode === 'compact'
      ? isPhone
        ? { small: 60, medium: 78, large: 108 }[gridSize]
        : { small: 78, medium: 96, large: 118 }[gridSize]
      : isPhone
        ? { small: 120, medium: 142, large: 166 }[gridSize]
        : { small: 122, medium: 142, large: 166 }[gridSize]
  const maxColumns = viewMode === 'compact' ? 14 : 9
  const gap = isPhone ? 7 : 11
  const calculatedColumns = Math.floor((width + gap) / (targetTileWidth + gap))
  const minimumColumns = viewMode === 'compact' && gridSize === 'medium' && isPhone && width > 0 ? 4 : 1
  return Math.max(minimumColumns, Math.min(maxColumns, calculatedColumns))
}

function rowEstimateFor(viewMode: GridViewMode, artMode: GridArtMode, gridSize: GridSize) {
  if (artMode === 'faces') {
    return viewMode === 'compact'
      ? { small: 114, medium: 126, large: 148 }[gridSize]
      : { small: 178, medium: 194, large: 224 }[gridSize]
  }
  return viewMode === 'compact'
    ? { small: 126, medium: 152, large: 178 }[gridSize]
    : { small: 205, medium: 225, large: 250 }[gridSize]
}

export function CatGrid({
  cats,
  manifest,
  names,
  viewMode,
  artMode,
  gridSize,
  showRings,
  showStars,
  showVignette,
  selectedOrders,
  interactionMode,
  onToggle,
  onInspect,
}: CatGridProps) {
  const scrollElementRef = useRef<HTMLDivElement>(null)
  const smallStarsRef = useRef<HTMLDivElement>(null)
  const largeStarsRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const faderRef = useRef<HTMLInputElement>(null)
  const [width, setWidth] = useState(0)
  const columnCount = columnsForWidth(width, viewMode, artMode, gridSize)
  const rowCount = Math.ceil(cats.length / columnCount)
  const overscan = width <= 900 ? 2 : 5
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => rowEstimateFor(viewMode, artMode, gridSize),
    getItemKey: (index) => `row-${index}`,
    overscan,
  })

  useEffect(() => {
    const element = scrollElementRef.current
    if (!element) return
    const updateWidth = () => setWidth(element.clientWidth)
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    scrollElementRef.current?.scrollTo({ top: 0 })
    rowVirtualizer.measure()
  }, [artMode, cats, columnCount, gridSize, rowVirtualizer, viewMode])

  useEffect(() => {
    const scrollElement = scrollElementRef.current
    const smallStars = smallStarsRef.current
    const largeStars = largeStarsRef.current
    if (!showStars || !scrollElement || !smallStars || !largeStars) return

    let frameId = 0
    const updateParallax = () => {
      frameId = 0
      const scrollTop = scrollElement.scrollTop
      smallStars.style.setProperty('--star-parallax-y', `${scrollTop * -0.12}px`)
      largeStars.style.setProperty('--star-parallax-y', `${scrollTop * -0.055}px`)
    }
    const handleScroll = () => {
      if (frameId !== 0) return
      frameId = requestAnimationFrame(updateParallax)
    }

    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    updateParallax()

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
      if (frameId !== 0) cancelAnimationFrame(frameId)
    }
  }, [artMode, cats, columnCount, gridSize, showStars, viewMode])

  useEffect(() => {
    const scrollElement = scrollElementRef.current
    const fader = faderRef.current
    if (!scrollElement || !fader) return

    const syncFader = () => {
      const maxScroll = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight)
      fader.max = String(maxScroll)
      fader.value = String(Math.min(maxScroll, scrollElement.scrollTop))
      fader.disabled = maxScroll === 0
    }

    const resizeObserver = new ResizeObserver(syncFader)
    resizeObserver.observe(scrollElement)
    if (canvasRef.current) resizeObserver.observe(canvasRef.current)
    scrollElement.addEventListener('scroll', syncFader, { passive: true })
    syncFader()

    return () => {
      resizeObserver.disconnect()
      scrollElement.removeEventListener('scroll', syncFader)
    }
  }, [artMode, cats, columnCount, gridSize, viewMode])

  if (cats.length === 0) {
    return (
      <div className="grid-empty" role="status">
        <span className="grid-empty__mark">∅</span>
        <strong>No cats match these filters.</strong>
        <span>Try clearing a trait or searching for another rescue order.</span>
      </div>
    )
  }

  return (
    <div className="cat-grid-shell">
      <div className="cat-grid-frame">
        <div
          className={`cat-grid-viewport${showRings ? '' : ' cat-grid-viewport--rings-hidden'}${
            showStars ? ' cat-grid-viewport--stars' : ''
          }${showVignette ? '' : ' cat-grid-viewport--vignette-hidden'} cat-grid-viewport--${artMode}`}
        >
          {showStars && (
            <div className="cat-grid-stars" aria-hidden="true">
              <div className="cat-grid-stars__layer cat-grid-stars__layer--small" ref={smallStarsRef} />
              <div className="cat-grid-stars__layer cat-grid-stars__layer--large" ref={largeStarsRef} />
            </div>
          )}
          <div className="cat-grid-scroll" ref={scrollElementRef}>
            <div
              className="cat-grid-canvas"
              ref={canvasRef}
              style={{ height: rowVirtualizer.getTotalSize() }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const rowStart = virtualRow.index * columnCount
                const rowCats = cats.slice(rowStart, rowStart + columnCount)
                return (
                  <div
                    className={`cat-grid-row cat-grid-row--${viewMode} cat-grid-row--${artMode} cat-grid-row--size-${gridSize}`}
                    data-index={virtualRow.index}
                    key={virtualRow.key}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                      top: virtualRow.start,
                    }}
                  >
                    {rowCats.map((cat) => (
                      <CatTile
                        key={cat.rescueOrder}
                        cat={cat}
                        manifest={manifest}
                        names={names}
                        viewMode={viewMode}
                        artMode={artMode}
                        gridSize={gridSize}
                        selected={selectedOrders.has(cat.rescueOrder)}
                        interactionMode={interactionMode}
                        onToggle={onToggle}
                        onInspect={onInspect}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <input
          ref={faderRef}
          className="cat-grid-fader"
          type="range"
          min="0"
          max="0"
          defaultValue="0"
          aria-label="Scroll MoonCat grid"
          onChange={(event) => {
            const scrollElement = scrollElementRef.current
            if (scrollElement) scrollElement.scrollTop = Number(event.currentTarget.value)
          }}
        />
      </div>
    </div>
  )
}
