import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CatTile } from './CatTile'
import type { AtlasManifest, CatRecord } from '../types'

interface CatGridProps {
  cats: CatRecord[]
  manifest: AtlasManifest
  selectedOrders: Set<number>
  onToggle: (rescueOrder: number) => void
}

function columnsForWidth(width: number) {
  if (width < 430) return 2
  if (width < 680) return 3
  if (width < 930) return 4
  if (width < 1_180) return 5
  return 6
}

export function CatGrid({ cats, manifest, selectedOrders, onToggle }: CatGridProps) {
  const scrollElementRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const columnCount = columnsForWidth(width)
  const rowCount = Math.ceil(cats.length / columnCount)
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 225,
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
  }, [cats, columnCount])

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
    <div className="cat-grid-scroll" ref={scrollElementRef}>
      <div className="cat-grid-canvas" style={{ height: rowVirtualizer.getTotalSize() }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowStart = virtualRow.index * columnCount
          const rowCats = cats.slice(rowStart, rowStart + columnCount)
          return (
            <div
              className="cat-grid-row"
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
                  selected={selectedOrders.has(cat.rescueOrder)}
                  onToggle={onToggle}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
