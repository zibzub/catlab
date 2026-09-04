import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CatTile } from './CatTile'
import { useIdleAnimation, type IdleGridCat } from '../idleAnimation'
import type { MoonCatNames } from '../mooncatDetails'
import type {
  AtlasManifest,
  CatRecord,
  CollectionScrollAnchor,
  CollectionInteractionMode,
  GridArtMode,
  GridSize,
  GridViewMode,
  IdlePattern,
  IdleSpeed,
  RingStyle,
} from '../types'

interface CatGridProps {
  cats: CatRecord[]
  manifest: AtlasManifest
  names: MoonCatNames
  viewMode: GridViewMode
  scrollAnchor: CollectionScrollAnchor | null
  artMode: GridArtMode
  gridSize: GridSize
  ringStyle: RingStyle
  idlePattern: IdlePattern
  idleSpeed: IdleSpeed
  showStars: boolean
  showVignette: boolean
  selectedOrders: Set<number>
  interactionMode: CollectionInteractionMode
  onToggle: (rescueOrder: number) => void
  onInspect: (cat: CatRecord, trigger: HTMLButtonElement) => void
  emptyStateMessage?: string
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
  const maxColumns = viewMode === 'compact'
    ? isPhone || gridSize === 'large' ? 14 : 16
    : 9
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

const ARROW_HOLD_DELAY_MS = 325
const CONTINUOUS_SCROLL_VIEWPORTS_PER_SECOND = 1.2
const PAGE_SCROLL_RATIO = 0.92

export function CatGrid({
  cats,
  manifest,
  names,
  viewMode,
  scrollAnchor,
  artMode,
  gridSize,
  ringStyle,
  idlePattern,
  idleSpeed,
  showStars,
  showVignette,
  selectedOrders,
  interactionMode,
  onToggle,
  onInspect,
  emptyStateMessage,
}: CatGridProps) {
  const scrollElementRef = useRef<HTMLDivElement>(null)
  const smallStarsRef = useRef<HTMLDivElement>(null)
  const largeStarsRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const faderRef = useRef<HTMLInputElement>(null)
  const appliedScrollAnchorRef = useRef<number | null>(null)
  const [width, setWidth] = useState(0)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const canScrollUpRef = useRef(false)
  const canScrollDownRef = useRef(false)
  const holdTimerRef = useRef<number | null>(null)
  const holdFrameRef = useRef<number | null>(null)
  const holdDirectionRef = useRef<-1 | 1 | null>(null)
  const holdTriggeredRef = useRef(false)
  const holdLastTimestampRef = useRef<number | null>(null)
  const holdPointerIdRef = useRef<number | null>(null)
  const windowPointerUpHandlerRef = useRef<((event: PointerEvent) => void) | null>(null)
  const windowPointerCancelHandlerRef = useRef<((event: PointerEvent) => void) | null>(null)
  const columnCount = columnsForWidth(width, viewMode, artMode, gridSize)
  const rowCount = Math.ceil(cats.length / columnCount)
  const scrollByStep = (direction: -1 | 1) => {
    const scrollElement = scrollElementRef.current
    if (!scrollElement) return
    const maxScroll = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight)
    const scrollStep = scrollElement.clientHeight * PAGE_SCROLL_RATIO
    const target = Math.min(maxScroll, Math.max(0, scrollElement.scrollTop + direction * scrollStep))
    scrollElement.scrollTo({ top: target })
  }
  const stopArrowHold = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (holdFrameRef.current !== null) {
      window.cancelAnimationFrame(holdFrameRef.current)
      holdFrameRef.current = null
    }
    if (windowPointerUpHandlerRef.current !== null) {
      window.removeEventListener('pointerup', windowPointerUpHandlerRef.current)
      windowPointerUpHandlerRef.current = null
    }
    if (windowPointerCancelHandlerRef.current !== null) {
      window.removeEventListener('pointercancel', windowPointerCancelHandlerRef.current)
      windowPointerCancelHandlerRef.current = null
    }
    holdDirectionRef.current = null
    holdLastTimestampRef.current = null
    holdPointerIdRef.current = null
    holdTriggeredRef.current = false
  }
  const finishArrowPress = (direction: -1 | 1) => {
    const wasHeld = holdTriggeredRef.current
    const wasPressed = holdDirectionRef.current === direction
    stopArrowHold()
    if (wasPressed && !wasHeld) scrollByStep(direction)
  }
  const continueArrowScroll = (timestamp: number) => {
    const scrollElement = scrollElementRef.current
    const direction = holdDirectionRef.current
    if (!scrollElement || direction === null) {
      holdFrameRef.current = null
      return
    }

    const previousTimestamp = holdLastTimestampRef.current ?? timestamp
    const elapsed = Math.min(64, Math.max(0, timestamp - previousTimestamp))
    holdLastTimestampRef.current = timestamp
    const maxScroll = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight)
    const distance = scrollElement.clientHeight
      * CONTINUOUS_SCROLL_VIEWPORTS_PER_SECOND
      * (elapsed / 1000)
    const target = Math.min(maxScroll, Math.max(0, scrollElement.scrollTop + direction * distance))
    scrollElement.scrollTop = target

    const reachedEndpoint = (direction < 0 && target <= 0) || (direction > 0 && target >= maxScroll)
    if (reachedEndpoint) {
      stopArrowHold()
      return
    }
    holdFrameRef.current = window.requestAnimationFrame(continueArrowScroll)
  }
  const beginArrowHold = (direction: -1 | 1, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    stopArrowHold()
    holdDirectionRef.current = direction
    holdTriggeredRef.current = false
    holdPointerIdRef.current = event.pointerId
    const handleWindowPointerUp = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId === holdPointerIdRef.current) finishArrowPress(direction)
    }
    const handleWindowPointerCancel = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId === holdPointerIdRef.current) stopArrowHold()
    }
    windowPointerUpHandlerRef.current = handleWindowPointerUp
    windowPointerCancelHandlerRef.current = handleWindowPointerCancel
    window.addEventListener('pointerup', handleWindowPointerUp)
    window.addEventListener('pointercancel', handleWindowPointerCancel)
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null
      if (holdDirectionRef.current !== direction) return
      holdTriggeredRef.current = true
      holdLastTimestampRef.current = null
      holdFrameRef.current = window.requestAnimationFrame(continueArrowScroll)
    }, ARROW_HOLD_DELAY_MS)
  }
  const overscan = width <= 900 ? 2 : 5
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => rowEstimateFor(viewMode, artMode, gridSize),
    getItemKey: (index) => `row-${index}`,
    overscan,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const scrollOffset = rowVirtualizer.scrollOffset ?? 0
  const viewportHeight = scrollElementRef.current?.clientHeight ?? 0
  const visibleRowIndexes = virtualRows
    .filter((row) => row.start < scrollOffset + viewportHeight && row.start + row.size > scrollOffset)
    .map((row) => row.index)
  const visibleRowsKey = visibleRowIndexes.join(',')
  const visibleCats = useMemo<IdleGridCat[]>(() => visibleRowIndexes.flatMap((rowIndex) => {
    const rowStart = rowIndex * columnCount
    return cats.slice(rowStart, rowStart + columnCount).map((cat, column) => ({
      rescueOrder: cat.rescueOrder,
      row: rowIndex,
      column,
    }))
  }), [cats, columnCount, visibleRowsKey])
  const idleState = useIdleAnimation({
    cats: visibleCats,
    pattern: idlePattern,
    speed: idleSpeed,
    isScrolling: rowVirtualizer.isScrolling,
  })

  useLayoutEffect(() => {
    const element = scrollElementRef.current
    if (!element) return
    const updateWidth = () => setWidth(element.clientWidth)
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)
    return () => observer.disconnect()
  }, [cats.length])

  useLayoutEffect(() => {
    const scrollElement = scrollElementRef.current
    const anchorIndex = scrollAnchor
      ? cats.findIndex((cat) => cat.rescueOrder === scrollAnchor.rescueOrder)
      : -1
    const hasPendingAnchor = scrollAnchor !== null
      && anchorIndex >= 0
      && appliedScrollAnchorRef.current !== scrollAnchor.token
    if (hasPendingAnchor) return
    scrollElement?.scrollTo({ top: 0 })
    rowVirtualizer.measure()
  }, [artMode, cats, rowVirtualizer, scrollAnchor, viewMode])

  useLayoutEffect(() => {
    const scrollElement = scrollElementRef.current
    if (!scrollElement || width <= 0 || !scrollAnchor || appliedScrollAnchorRef.current === scrollAnchor.token) return
    const anchorIndex = cats.findIndex((cat) => cat.rescueOrder === scrollAnchor.rescueOrder)
    if (anchorIndex < 0) return
    rowVirtualizer.measure()
    appliedScrollAnchorRef.current = scrollAnchor.token
    rowVirtualizer.scrollToIndex(Math.floor(anchorIndex / columnCount), { align: 'start' })
  }, [cats, columnCount, rowVirtualizer, scrollAnchor, viewMode, width])

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

  useLayoutEffect(() => {
    const scrollElement = scrollElementRef.current
    const fader = faderRef.current
    if (!scrollElement || !fader) return

    const syncFader = () => {
      const maxScroll = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight)
      const scrollTop = Math.min(maxScroll, Math.max(0, scrollElement.scrollTop))
      fader.max = String(maxScroll)
      fader.value = String(scrollTop)
      fader.disabled = maxScroll === 0
      const nextCanScrollUp = scrollTop > 0
      const nextCanScrollDown = maxScroll > 0 && scrollTop < maxScroll
      if (canScrollUpRef.current !== nextCanScrollUp) {
        canScrollUpRef.current = nextCanScrollUp
        setCanScrollUp(nextCanScrollUp)
      }
      if (canScrollDownRef.current !== nextCanScrollDown) {
        canScrollDownRef.current = nextCanScrollDown
        setCanScrollDown(nextCanScrollDown)
      }
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

  useEffect(() => () => {
    stopArrowHold()
  }, [])

  if (cats.length === 0) {
    return (
      <div className="grid-empty" role="status">
        <span className="grid-empty__mark">∅</span>
        <strong>{emptyStateMessage ?? 'No cats match these filters.'}</strong>
        <span>{emptyStateMessage ? 'Try another wallet or clear the wallet filter.' : 'Try clearing a trait or searching for another rescue order.'}</span>
      </div>
    )
  }

  return (
    <div className="cat-grid-shell">
      <div className="cat-grid-frame">
        <div className="cat-grid-viewport-bezel">
          <div
            className={`cat-grid-viewport cat-grid-viewport--rings-${ringStyle}${
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
                {virtualRows.map((virtualRow) => {
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
                          idlePulse={idleState.pulseByOrder.get(cat.rescueOrder)}
                          idleHeld={idleState.heldOrders.has(cat.rescueOrder)}
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
        </div>
        <div className="cat-grid-scroll-controls">
          <button
            className="cat-grid-scroll-button"
            type="button"
            disabled={!canScrollUp}
            aria-label="Scroll up"
            onPointerDown={(event) => beginArrowHold(-1, event)}
            onPointerUp={() => finishArrowPress(-1)}
            onPointerCancel={stopArrowHold}
            onClick={(event) => {
              if (event.detail === 0) scrollByStep(-1)
            }}
          >
            <span aria-hidden="true">▲</span>
          </button>
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
          <button
            className="cat-grid-scroll-button"
            type="button"
            disabled={!canScrollDown}
            aria-label="Scroll down"
            onPointerDown={(event) => beginArrowHold(1, event)}
            onPointerUp={() => finishArrowPress(1)}
            onPointerCancel={stopArrowHold}
            onClick={(event) => {
              if (event.detail === 0) scrollByStep(1)
            }}
          >
            <span aria-hidden="true">▼</span>
          </button>
        </div>
      </div>
    </div>
  )
}
