import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { MoonCatSprite } from './MoonCatSprite'
import { getMoonCatName, type MoonCatNames } from '../mooncatDetails'
import type {
  AtlasManifest,
  CatRecord,
  CollectionScrollAnchor,
  CollectionInteractionMode,
  GridArtMode,
  RingStyle,
} from '../types'

type CatListSortKey =
  | 'rescueOrder'
  | 'name'
  | 'rescueYear'
  | 'hue'
  | 'hueValue'
  | 'pattern'
  | 'pose'
  | 'expression'
  | 'facing'

type SortDirection = 'asc' | 'desc'

interface CatListProps {
  cats: CatRecord[]
  manifest: AtlasManifest
  names: MoonCatNames
  namedOrder: 'recent' | 'first' | null
  scrollAnchor: CollectionScrollAnchor | null
  artMode: GridArtMode
  ringStyle: RingStyle
  selectedOrders: Set<number>
  interactionMode: CollectionInteractionMode
  onToggle: (rescueOrder: number) => void
  onInspect: (cat: CatRecord, trigger: HTMLButtonElement) => void
  emptyStateMessage?: string
}

interface SortHeaderProps {
  label: string
  sortKey: CatListSortKey
  sort: { key: CatListSortKey; direction: SortDirection }
  onSort: (key: CatListSortKey) => void
  className?: string
}

const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function sortValue(cat: CatRecord, key: CatListSortKey, names: MoonCatNames) {
  switch (key) {
    case 'rescueOrder':
      return cat.rescueOrder
    case 'name':
      return getMoonCatName(names, cat.rescueOrder).trim()
    case 'rescueYear':
      return cat.rescueYear
    case 'hue':
      return cat.hueName
    case 'hueValue':
      return cat.hueInt
    case 'pattern':
      return cat.pattern
    case 'pose':
      return cat.pose
    case 'expression':
      return cat.expression
    case 'facing':
      return cat.facing
  }
}

function compareCats(
  first: CatRecord,
  second: CatRecord,
  key: CatListSortKey,
  direction: SortDirection,
  names: MoonCatNames,
) {
  const firstValue = sortValue(first, key, names)
  const secondValue = sortValue(second, key, names)
  let comparison = 0

  if (key === 'name') {
    const firstUnnamed = firstValue === ''
    const secondUnnamed = secondValue === ''
    if (firstUnnamed !== secondUnnamed) return firstUnnamed ? 1 : -1
    comparison = nameCollator.compare(firstValue as string, secondValue as string)
  } else if (typeof firstValue === 'number' && typeof secondValue === 'number') {
    comparison = firstValue - secondValue
  } else {
    comparison = nameCollator.compare(String(firstValue), String(secondValue))
  }

  if (comparison !== 0) return comparison * (direction === 'asc' ? 1 : -1)
  return first.rescueOrder - second.rescueOrder
}

function SortButton({ label, sortKey, sort, onSort, className = '' }: SortHeaderProps) {
  const active = sort.key === sortKey
  const directionLabel = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'not sorted'
  const ariaSort: 'none' | 'ascending' | 'descending' = active
    ? sort.direction === 'asc' ? 'ascending' : 'descending'
    : 'none'
  return (
    <button
      type="button"
      className={`cat-list-sort${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      aria-label={`Sort ${label}, currently ${directionLabel}`}
      aria-sort={ariaSort}
      onClick={() => onSort(sortKey)}
    >
      <span>{label}</span>
      <span className="cat-list-sort__indicator" aria-hidden="true">{active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
    </button>
  )
}

function SortHeader(props: SortHeaderProps) {
  return (
    <div className={`cat-list-header__cell${props.className ? ` ${props.className}` : ''}`} role="columnheader">
      <SortButton {...props} className="" />
    </div>
  )
}

function traitLabel(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase())
}

export function CatList({
  cats,
  manifest,
  names,
  namedOrder,
  scrollAnchor,
  artMode,
  ringStyle,
  selectedOrders,
  interactionMode,
  onToggle,
  onInspect,
  emptyStateMessage,
}: CatListProps) {
  const [sort, setSort] = useState<{ key: CatListSortKey; direction: SortDirection }>({
    key: 'rescueOrder',
    direction: 'asc',
  })
  const [sortOverridden, setSortOverridden] = useState(false)
  const namedOrderRef = useRef(namedOrder)
  const appliedScrollAnchorRef = useRef<number | null>(null)
  const scrollElementRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const faderRef = useRef<HTMLInputElement>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const isNarrow = viewportWidth > 0 && viewportWidth <= 620
  const sortedCats = useMemo(() => (
    namedOrder !== null && !sortOverridden
      ? cats
      : [...cats].sort((first, second) => compareCats(first, second, sort.key, sort.direction, names))
  ), [cats, names, namedOrder, sort, sortOverridden])
  const rowVirtualizer = useVirtualizer({
    count: sortedCats.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => isNarrow ? 49 : 78,
    getItemKey: (index) => sortedCats[index]?.rescueOrder ?? index,
    overscan: 8,
  })

  useLayoutEffect(() => {
    if (namedOrder !== null && namedOrderRef.current !== namedOrder) {
      setSort({ key: 'rescueOrder', direction: 'asc' })
      setSortOverridden(false)
    }
    namedOrderRef.current = namedOrder
  }, [namedOrder])

  useLayoutEffect(() => {
    const scrollElement = scrollElementRef.current
    if (!scrollElement) return
    const updateWidth = () => setViewportWidth(scrollElement.clientWidth)
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(scrollElement)
    return () => observer.disconnect()
  }, [cats.length])

  useLayoutEffect(() => {
    const scrollElement = scrollElementRef.current
    const anchor = scrollAnchor
    const anchorIndex = anchor ? sortedCats.findIndex((cat) => cat.rescueOrder === anchor.rescueOrder) : -1
    const hasPendingAnchor = anchor !== null
      && anchorIndex >= 0
      && appliedScrollAnchorRef.current !== anchor.token
    if (hasPendingAnchor) return
    scrollElement?.scrollTo({ top: 0, left: 0 })
    rowVirtualizer.measure()
  }, [cats, namedOrder, rowVirtualizer, scrollAnchor, sort, sortedCats])

  useLayoutEffect(() => {
    const scrollElement = scrollElementRef.current
    if (!scrollElement || viewportWidth <= 0 || !scrollAnchor || appliedScrollAnchorRef.current === scrollAnchor.token) return
    const anchorIndex = sortedCats.findIndex((cat) => cat.rescueOrder === scrollAnchor.rescueOrder)
    if (anchorIndex < 0) return
    rowVirtualizer.measure()
    appliedScrollAnchorRef.current = scrollAnchor.token
    rowVirtualizer.scrollToIndex(anchorIndex, { align: 'start' })
  }, [rowVirtualizer, scrollAnchor, sortedCats, viewportWidth])

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
  }, [cats, isNarrow, rowVirtualizer, sort])

  const handleSort = (key: CatListSortKey) => {
    setSortOverridden(true)
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

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
    <div className={`cat-list-shell cat-list-shell--rings-${ringStyle}`}>
      <div className="cat-list-frame">
        <div className="cat-list-viewport">
          <div className="cat-list-scroll" ref={scrollElementRef} role="table" aria-label="MoonCat list">
            <div className="cat-list-header" role="row">
              <div className="cat-list-header__identity" role="columnheader" aria-label="Rescue ID and Name">
                <div className="cat-list-header__identity-sort">
                  <SortButton label="Rescue ID" sortKey="rescueOrder" sort={sort} onSort={handleSort} />
                  <SortButton label="Name" sortKey="name" sort={sort} onSort={handleSort} />
                </div>
              </div>
              <SortHeader label="Rescue Year" sortKey="rescueYear" sort={sort} onSort={handleSort} />
              <SortHeader label="Hue" sortKey="hue" sort={sort} onSort={handleSort} />
              <SortHeader label="Hue Value" sortKey="hueValue" sort={sort} onSort={handleSort} />
              <SortHeader label="Pattern" sortKey="pattern" sort={sort} onSort={handleSort} />
              <SortHeader label="Pose" sortKey="pose" sort={sort} onSort={handleSort} />
              <SortHeader label="Expression" sortKey="expression" sort={sort} onSort={handleSort} />
              <SortHeader label="Facing" sortKey="facing" sort={sort} onSort={handleSort} />
            </div>
            <div className="cat-list-canvas" ref={canvasRef} style={{ height: rowVirtualizer.getTotalSize() }} role="rowgroup">
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const cat = sortedCats[virtualRow.index]
                if (!cat) return null
                const name = getMoonCatName(names, cat.rescueOrder)
                const selected = selectedOrders.has(cat.rescueOrder)
                const nameSuffix = name ? `, ${name}` : ''
                const label = interactionMode === 'inspect'
                  ? `Inspect MoonCat rescue order ${cat.rescueOrder}${nameSuffix}, ${cat.hueName} ${cat.pattern}`
                  : `MoonCat rescue order ${cat.rescueOrder}${nameSuffix}, ${cat.hueName} ${cat.pattern}`
                return (
                  <button
                    key={virtualRow.key}
                    ref={rowVirtualizer.measureElement}
                    className={`cat-list-row${selected ? ' cat-list-row--selected' : ''}`}
                    type="button"
                    role="row"
                    aria-label={label}
                    aria-pressed={interactionMode === 'select' ? selected : undefined}
                    aria-haspopup={interactionMode === 'inspect' ? 'dialog' : undefined}
                    data-rescue-order={cat.rescueOrder}
                    data-index={virtualRow.index}
                    style={{ top: virtualRow.start }}
                    onClick={(event) => {
                      if (interactionMode === 'inspect') onInspect(cat, event.currentTarget)
                      else onToggle(cat.rescueOrder)
                    }}
                  >
                    <span className="cat-list-row__identity" role="cell">
                      <span className="cat-list-row__thumbnail">
                        <MoonCatSprite
                          cat={cat}
                          manifest={manifest}
                          variant="list"
                          artMode={artMode}
                          gridSize={isNarrow ? 'small' : 'medium'}
                        />
                      </span>
                      <span className="cat-list-row__identity-copy">
                        <strong>{cat.rescueOrder}</strong>
                        {name && <span>{name}</span>}
                      </span>
                    </span>
                    <span className="cat-list-row__cell" role="cell">{cat.rescueYear}</span>
                    <span className="cat-list-row__cell" role="cell">{traitLabel(cat.hueName)}</span>
                    <span className="cat-list-row__cell" role="cell">{cat.hueInt}</span>
                    <span className="cat-list-row__cell" role="cell">{traitLabel(cat.pattern)}</span>
                    <span className="cat-list-row__cell" role="cell">{traitLabel(cat.pose)}</span>
                    <span className="cat-list-row__cell" role="cell">{traitLabel(cat.expression)}</span>
                    <span className="cat-list-row__cell" role="cell">{traitLabel(cat.facing)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <input
          ref={faderRef}
          className="cat-grid-fader cat-list-fader"
          type="range"
          min="0"
          max="0"
          defaultValue="0"
          aria-label="Scroll MoonCat list"
          onChange={(event) => {
            const scrollElement = scrollElementRef.current
            if (scrollElement) scrollElement.scrollTop = Number(event.currentTarget.value)
          }}
        />
      </div>
    </div>
  )
}
