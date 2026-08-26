import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CatTile } from './CatTile'
import type { AtlasManifest, CatRecord, GridViewMode } from '../types'

interface CatGridProps {
  cats: CatRecord[]
  manifest: AtlasManifest
  viewMode: GridViewMode
  showRings: boolean
  showStars: boolean
  selectedOrders: Set<number>
  onToggle: (rescueOrder: number) => void
}

function columnsForWidth(width: number, viewMode: GridViewMode) {
  const isPhone = width <= 620
  const targetTileWidth = viewMode === 'compact' ? (isPhone ? 78 : 96) : 142
  const maxColumns = viewMode === 'compact' ? 14 : 9
  const gap = isPhone ? 7 : 11
  const calculatedColumns = Math.floor((width + gap) / (targetTileWidth + gap))
  const minimumColumns = viewMode === 'compact' && isPhone && width > 0 ? 4 : 1
  return Math.max(minimumColumns, Math.min(maxColumns, calculatedColumns))
}

export function CatGrid({
  cats,
  manifest,
  viewMode,
  showRings,
  showStars,
  selectedOrders,
  onToggle,
}: CatGridProps) {
  const scrollElementRef = useRef<HTMLDivElement>(null)
  const smallStarsRef = useRef<HTMLDivElement>(null)
  const largeStarsRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const faderRef = useRef<HTMLInputElement>(null)
  const [width, setWidth] = useState(0)
  const columnCount = columnsForWidth(width, viewMode)
  const rowCount = Math.ceil(cats.length / columnCount)
  const overscan = width <= 900 ? 2 : 5
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => (viewMode === 'compact' ? 142 : 225),
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
  }, [cats, columnCount, rowVirtualizer, viewMode])

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
  }, [cats, columnCount, showStars, viewMode])

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
  }, [cats, columnCount, viewMode])

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
          }`}
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
                    className={`cat-grid-row cat-grid-row--${viewMode}`}
                    data-index={virtualRow.index}
                    key={virtualRow.key}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {rowCats.map((cat) => (
                      <CatTile
                        key={cat.rescueOrder}
                        cat={cat}
                        manifest={manifest}
                        viewMode={viewMode}
                        selected={selectedOrders.has(cat.rescueOrder)}
                        onToggle={onToggle}
                      />
                    ))}
                  </div>
                )
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
