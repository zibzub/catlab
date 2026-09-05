import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { activeFilterCount, getActiveFilterChips, type RemovableFilterKey } from './collectionFilters'
import { DisplayMenu } from './DisplayMenu'
import { FilterDrawer } from './FilterDrawer'
import type { WalletFilter } from '../walletLookup'
import type { FilterIndex } from '../mooncat-index/filters'
import type {
  CollectionInteractionMode,
  FilterState,
  GridArtMode,
  GridSize,
  GridViewMode,
  IdlePattern,
  IdleSpeed,
  RingStyle,
} from '../types'

interface FilterBarProps {
  filters: FilterState
  filterIndex: FilterIndex
  resultCount: number
  totalCount: number
  interactionMode: CollectionInteractionMode
  viewMode: GridViewMode
  artMode: GridArtMode
  gridSize: GridSize
  ringStyle: RingStyle
  showStars: boolean
  showVignette: boolean
  idlePattern: IdlePattern
  idleSpeed: IdleSpeed
  colorLabOpen: boolean
  colorLabActive: boolean
  walletFilter: WalletFilter | null
  walletInput: string
  walletLookupLoading: boolean
  walletLookupError: string | null
  onQueryChange: (query: string) => void
  onApplyFilters: (filters: FilterState) => void
  onClearFilters: () => void
  onWalletLookup: (input: string) => void
  onWalletInputChange: (input: string) => void
  onUseConnectedWallet: () => void
  onClearWallet: () => void
  onDisconnectWallet: () => void
  onRemoveFilter: (key: RemovableFilterKey, value: string | number) => void
  onInteractionModeChange: (mode: CollectionInteractionMode) => void
  onViewModeChange: (mode: GridViewMode) => void
  onArtModeChange: (mode: GridArtMode) => void
  onGridSizeChange: (size: GridSize) => void
  onRingStyleChange: (style: RingStyle) => void
  onStarsChange: (show: boolean) => void
  onVignetteChange: (show: boolean) => void
  onIdlePatternChange: (pattern: IdlePattern) => void
  onIdleSpeedChange: (speed: IdleSpeed) => void
  onColorLabToggle: () => void
  onColorLabClear: () => void
}

const idlePatternLabels: Record<IdlePattern, string> = {
  off: 'Off',
  wave: 'Wave',
  cascade: 'Cascade',
  random: 'Random',
  popcorn: 'Popcorn',
  ripple: 'Ripple',
  worm: 'Worm',
  'snake-game': 'Snake',
}

const idleSpeedLabels: Record<IdleSpeed, string> = {
  slow: 'Slow',
  medium: 'Medium',
  fast: 'Fast',
}

interface ActiveChipItem {
  id: string
  label: string
  onRemove?: () => void
}

export function FilterBar({
  filters,
  filterIndex,
  resultCount,
  totalCount,
  interactionMode,
  viewMode,
  artMode,
  gridSize,
  ringStyle,
  showStars,
  showVignette,
  idlePattern,
  idleSpeed,
  colorLabOpen,
  colorLabActive,
  walletFilter,
  walletInput,
  walletLookupLoading,
  walletLookupError,
  onQueryChange,
  onApplyFilters,
  onClearFilters,
  onWalletLookup,
  onWalletInputChange,
  onUseConnectedWallet,
  onClearWallet,
  onDisconnectWallet,
  onRemoveFilter,
  onInteractionModeChange,
  onViewModeChange,
  onArtModeChange,
  onGridSizeChange,
  onRingStyleChange,
  onStarsChange,
  onVignetteChange,
  onIdlePatternChange,
  onIdleSpeedChange,
  onColorLabToggle,
  onColorLabClear,
}: FilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const filtersTriggerRef = useRef<HTMLButtonElement>(null)
  const activeRowRef = useRef<HTMLDivElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const clearFiltersRef = useRef<HTMLButtonElement>(null)
  const overflowAnchorRef = useRef<HTMLDivElement>(null)
  const overflowButtonRef = useRef<HTMLButtonElement>(null)
  const overflowMeasureRef = useRef<HTMLButtonElement>(null)
  const chipMeasureRef = useRef<HTMLDivElement>(null)
  const chipMeasureRefs = useRef(new Map<string, HTMLElement>())
  const selectedFilterCount = activeFilterCount(filters)
  const chips = getActiveFilterChips(filters)
  const hasActiveFilters = chips.length > 0 || colorLabActive || walletFilter !== null
  const hasIdleAnimation = idlePattern !== 'off'
  const activeChipItems: ActiveChipItem[] = [
    ...(hasIdleAnimation
      ? [{
          id: 'idle',
          label: `Idle: ${idlePatternLabels[idlePattern]} · ${idleSpeedLabels[idleSpeed]}`,
          onRemove: () => onIdlePatternChange('off'),
        }]
      : []),
    ...(walletFilter
      ? [{ id: 'wallet', label: `Wallet ${walletFilter.label}`, onRemove: onClearWallet }]
      : []),
    ...chips.map((chip) => ({
      id: `${chip.key}-${String(chip.value)}`,
      label: chip.label,
      onRemove: () => onRemoveFilter(chip.key, chip.value),
    })),
    ...(colorLabActive ? [{ id: 'colorlab', label: 'ColorLab match', onRemove: onColorLabClear }] : []),
  ]
  const activeChipKey = activeChipItems.map((item) => `${item.id}:${item.label}`).join('|')
  const [visibleChipCount, setVisibleChipCount] = useState(activeChipItems.length)
  const showActiveTagRow = activeChipItems.length > 0 || overflowOpen
  const hasChipOverflow = visibleChipCount < activeChipItems.length
  const visibleActiveChips = activeChipItems.slice(0, visibleChipCount)

  const toolbarRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const row = activeRowRef.current
    const chipsElement = chipsRef.current
    if (!row || !chipsElement || activeChipItems.length === 0) return

    const measure = () => {
      const widths = activeChipItems.map((item) => chipMeasureRefs.current.get(item.id)?.getBoundingClientRect().width ?? 0)
      const rowGap = Number.parseFloat(getComputedStyle(row).columnGap) || 0
      const chipGap = Number.parseFloat(getComputedStyle(chipsElement).columnGap) || 0
      const clearWidth = clearFiltersRef.current?.getBoundingClientRect().width ?? 0
      const clearGap = clearFiltersRef.current ? rowGap : 0
      const availableBeforeOverflow = row.clientWidth - clearWidth - clearGap
      const allWidth = widths.reduce((total, width) => total + width, 0) + Math.max(0, widths.length - 1) * chipGap
      let nextVisibleCount = activeChipItems.length

      if (allWidth > availableBeforeOverflow) {
        const overflowWidth = overflowMeasureRef.current?.getBoundingClientRect().width ?? 25
        const availableWithOverflow = availableBeforeOverflow - rowGap - overflowWidth
        let usedWidth = 0
        nextVisibleCount = 0
        for (const width of widths) {
          const nextWidth = usedWidth + width + (nextVisibleCount > 0 ? chipGap : 0)
          if (nextWidth > availableWithOverflow) break
          usedWidth = nextWidth
          nextVisibleCount += 1
        }
      }

      setVisibleChipCount((current) => current === nextVisibleCount ? current : nextVisibleCount)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    if (chipMeasureRef.current) observer.observe(chipMeasureRef.current)
    return () => observer.disconnect()
  }, [activeChipKey, activeChipItems.length, visibleChipCount])

  useEffect(() => {
    if (!overflowOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && !overflowAnchorRef.current?.contains(target)) setOverflowOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [overflowOpen])

  const closeFilters = () => {
    setFiltersOpen(false)
    window.requestAnimationFrame(() => filtersTriggerRef.current?.focus())
  }

  return (
    <div className="collection-toolbar" ref={toolbarRef}>
      <div className="collection-toolbar__row">
        <div
          className={`grid-mode-toggle ${interactionMode === 'select' ? 'is-select' : 'is-inspect'}`}
          role="group"
          aria-label="Collection interaction mode"
        >
          <button
            type="button"
            className={`grid-mode-toggle__choice grid-mode-toggle__choice--select${interactionMode === 'select' ? ' is-active' : ''}`}
            aria-pressed={interactionMode === 'select'}
            onClick={() => onInteractionModeChange('select')}
          >
            Select
          </button>
          <button
            type="button"
            className="grid-mode-toggle__rocker"
            aria-label={`Switch to ${interactionMode === 'select' ? 'Inspect' : 'Select'} mode`}
            onClick={() => onInteractionModeChange(interactionMode === 'select' ? 'inspect' : 'select')}
          >
            <span className="grid-mode-toggle__rocker-face" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`grid-mode-toggle__choice grid-mode-toggle__choice--inspect${interactionMode === 'inspect' ? ' is-active' : ''}`}
            aria-pressed={interactionMode === 'inspect'}
            onClick={() => onInteractionModeChange('inspect')}
          >
            Inspect
          </button>
        </div>

        <label className="search-control">
          <span className="sr-only">Search rescue ID or MoonCat name</span>
          <span className="search-control__icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            value={filters.query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="ID or name"
          />
          {filters.query && (
            <button
              className="search-control__clear"
              type="button"
              aria-label="Clear search"
              onClick={() => onQueryChange('')}
            >
              ×
            </button>
          )}
        </label>

        <div className="collection-toolbar__secondary">
          <div className="result-count" aria-live="polite">
            <strong>{resultCount.toLocaleString()}</strong>
            <span>of {totalCount.toLocaleString()} cats</span>
          </div>
          {showActiveTagRow && (
            <div className="active-filter-row" ref={activeRowRef} aria-label="Active filters">
              <div className="active-filter-row__chips" ref={chipsRef}>
                {visibleActiveChips.map((item) => item.onRemove ? (
                  <button key={item.id} className="active-filter-chip" type="button" onClick={item.onRemove} aria-label={`Remove ${item.label}`}>
                    <span>{item.label}</span>
                    <span aria-hidden="true">×</span>
                  </button>
                ) : (
                  <span key={item.id} className="active-filter-indicator" aria-label={item.label}>{item.label}</span>
                ))}
              </div>
              {(hasChipOverflow || overflowOpen) && (
                <div className="active-filter-overflow-anchor" ref={overflowAnchorRef}>
                  {hasChipOverflow && (
                    <button
                      ref={overflowButtonRef}
                      className="active-filter-overflow"
                      type="button"
                      aria-label="Show active filters"
                      aria-expanded={overflowOpen}
                      aria-controls="active-filter-overflow-popover"
                      aria-haspopup="dialog"
                      onClick={() => setOverflowOpen((current) => !current)}
                    >
                      +
                    </button>
                  )}
                  {overflowOpen && (
                    <div className="active-filter-overflow-popover" id="active-filter-overflow-popover" role="dialog" aria-label="All active filters">
                      <div className="active-filter-overflow-popover__header">
                        <span>Active</span>
                        <button className="active-filter-overflow-popover__close" type="button" aria-label="Close active filters" onClick={() => setOverflowOpen(false)}>×</button>
                      </div>
                      <div className="active-filter-overflow-popover__chips">
                        {activeChipItems.length === 0 ? <span className="active-filter-overflow-popover__empty">No active filters</span> : activeChipItems.map((item) => item.onRemove ? (
                          <button key={item.id} className="active-filter-chip" type="button" onClick={item.onRemove} aria-label={`Remove ${item.label}`}>
                            <span>{item.label}</span>
                            <span aria-hidden="true">×</span>
                          </button>
                        ) : (
                          <span key={item.id} className="active-filter-indicator" aria-label={item.label}>{item.label}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {hasActiveFilters && (
                <button ref={clearFiltersRef} className="active-filter-row__clear" type="button" onClick={onClearFilters}>Clear</button>
              )}
              <div ref={chipMeasureRef} className="active-filter-row__measure" aria-hidden="true">
                {activeChipItems.map((item) => item.onRemove ? (
                  <button
                    key={item.id}
                    ref={(element) => {
                      if (element) chipMeasureRefs.current.set(item.id, element)
                      else chipMeasureRefs.current.delete(item.id)
                    }}
                    className="active-filter-chip"
                    type="button"
                    tabIndex={-1}
                  >
                    <span>{item.label}</span>
                    <span aria-hidden="true">×</span>
                  </button>
                ) : (
                  <span
                    key={item.id}
                    ref={(element) => {
                      if (element) chipMeasureRefs.current.set(item.id, element)
                      else chipMeasureRefs.current.delete(item.id)
                    }}
                    className="active-filter-indicator"
                  >
                    {item.label}
                  </span>
                ))}
                <button ref={overflowMeasureRef} className="active-filter-overflow" type="button" tabIndex={-1}>+</button>
              </div>
            </div>
          )}
        </div>

        <div className="collection-toolbar__actions">
          <div className="collection-toolbar__action-row collection-toolbar__action-row--primary">
          <button
            ref={filtersTriggerRef}
            className={`collection-toolbar__button${filtersOpen || selectedFilterCount > 0 || colorLabActive ? ' is-active' : ''}`}
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="filter-drawer"
            aria-haspopup="dialog"
            onClick={() => setFiltersOpen((current) => !current)}
          >
            <span className="collection-toolbar__button-icon" aria-hidden="true">≡</span>
            <span>Filters</span>
            {selectedFilterCount > 0 && (
              <span className="collection-toolbar__count">{selectedFilterCount}</span>
            )}
          </button>
          <button
            className={`collection-toolbar__button${colorLabOpen ? ' is-active' : ''}`}
            type="button"
            aria-expanded={colorLabOpen}
            aria-controls="colorlab-panel"
            onClick={onColorLabToggle}
          >
            <span className="collection-toolbar__button-icon" aria-hidden="true">⌖</span>
            <span>ColorLab</span>
          </button>
          <div className="art-mode-toggle" role="group" aria-label="Art mode">
            <button
              type="button"
              className={artMode === 'bodies' ? 'is-active' : ''}
              aria-label="Full body art"
              title="Full body art"
              aria-pressed={artMode === 'bodies'}
              onClick={() => onArtModeChange('bodies')}
            >
              <span className="art-mode-icon art-mode-icon--full" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={artMode === 'faces' ? 'is-active' : ''}
              aria-label="Face art"
              title="Face art"
              aria-pressed={artMode === 'faces'}
              onClick={() => onArtModeChange('faces')}
            >
              <span className="art-mode-icon art-mode-icon--face" aria-hidden="true" />
            </button>
          </div>
          </div>
          <div className="collection-toolbar__action-row collection-toolbar__action-row--secondary">
          <div className="quick-layout-toggle" role="group" aria-label="Quick collection layout">
            {(['small', 'medium', 'large'] as const).map((size) => {
              const cellCount = size === 'small' ? 9 : size === 'medium' ? 6 : 4
              const label = size[0].toUpperCase() + size.slice(1)
              return (
                <button
                  key={size}
                  type="button"
                  className={viewMode === 'compact' && gridSize === size ? 'is-active' : ''}
                  aria-label={`${label} compact grid`}
                  title={`${label} compact grid`}
                  aria-pressed={viewMode === 'compact' && gridSize === size}
                  onClick={() => onGridSizeChange(size)}
                >
                  <span className={`grid-size-icon grid-size-icon--${size}`} aria-hidden="true">
                    {Array.from({ length: cellCount }, (_, index) => <span key={index} />)}
                  </span>
                </button>
              )
            })}
            <button
              type="button"
              className={`quick-layout-toggle__details${viewMode === 'detailed' ? ' is-active' : ''}`}
              aria-label="Details view"
              title="Details view"
              aria-pressed={viewMode === 'detailed'}
              onClick={() => onViewModeChange('detailed')}
            >
              <span className="details-view-icon" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`quick-layout-toggle__list${viewMode === 'list' ? ' is-active' : ''}`}
              aria-label="List view"
              title="List view"
              aria-pressed={viewMode === 'list'}
              onClick={() => onViewModeChange('list')}
            >
              <span className="list-view-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
          </div>
          <DisplayMenu
            artMode={artMode}
            ringStyle={ringStyle}
            showStars={showStars}
            showVignette={showVignette}
            idlePattern={idlePattern}
            idleSpeed={idleSpeed}
            onRingStyleChange={onRingStyleChange}
            onStarsChange={onStarsChange}
            onVignetteChange={onVignetteChange}
            onIdlePatternChange={onIdlePatternChange}
            onIdleSpeedChange={onIdleSpeedChange}
          />
          </div>
        </div>
      </div>

      <FilterDrawer
        open={filtersOpen}
        activeFilters={filters}
        index={filterIndex}
        walletFilter={walletFilter}
        walletInput={walletInput}
        walletLookupLoading={walletLookupLoading}
        walletLookupError={walletLookupError}
        onApply={onApplyFilters}
        onWalletLookup={onWalletLookup}
        onWalletInputChange={onWalletInputChange}
        onUseConnectedWallet={onUseConnectedWallet}
        onClearWallet={onClearWallet}
        onDisconnectWallet={onDisconnectWallet}
        onClose={closeFilters}
      />
    </div>
  )
}
