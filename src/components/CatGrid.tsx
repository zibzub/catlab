import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CatTile } from './CatTile'
import type { AtlasManifest, CatRecord, GridViewMode } from '../types'

interface CatGridProps {
  cats: CatRecord[]
  manifest: AtlasManifest
  viewMode: GridViewMode
  showRings: boolean
  selectedOrders: Set<number>
  onToggle: (rescueOrder: number) => void
}

function columnsForWidth(width: number, viewMode: GridViewMode) {
  const targetTileWidth = viewMode === 'compact' ? 96 : 142
  const maxColumns = viewMode === 'compact' ? 14 : 9
  return Math.max(1, Math.min(maxColumns, Math.floor((width + 11) / (targetTileWidth + 11))))
}

export function CatGrid({
  cats,
  manifest,
  viewMode,
  showRings,
  selectedOrders,
  onToggle,
}: CatGridProps) {
  const scrollElementRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const columnCount = columnsForWidth(width, viewMode)
  const rowCount = Math.ceil(cats.length / columnCount)
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => (viewMode === 'compact' ? 142 : 225),
    getItemKey: (index) => `row-${index}`,
    overscan: 5,
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
        <div className="cat-grid-scroll" ref={scrollElementRef}>
          <div className="cat-grid-canvas" style={{ height: rowVirtualizer.getTotalSize() }}>
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
                      showRings={showRings}
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
    </div>
  )
}
