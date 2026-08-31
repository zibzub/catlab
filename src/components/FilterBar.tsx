import { useEffect, useRef, useState } from 'react'
import { activeFilterCount, getActiveFilterChips, type FilterIndex, type RemovableFilterKey } from './collectionFilters'
import { DisplayMenu } from './DisplayMenu'
import { FilterDrawer } from './FilterDrawer'
import type { WalletFilter } from '../walletLookup'
import type {
  CollectionInteractionMode,
  FilterState,
  GridArtMode,
  GridSize,
  GridViewMode,
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
  showRings: boolean
  showStars: boolean
  showVignette: boolean
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
  onRingsChange: (show: boolean) => void
  onStarsChange: (show: boolean) => void
  onVignetteChange: (show: boolean) => void
  onColorLabToggle: () => void
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
  showRings,
  showStars,
  showVignette,
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
  onRingsChange,
  onStarsChange,
  onVignetteChange,
  onColorLabToggle,
}: FilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [chipLimit, setChipLimit] = useState(4)
  const filtersTriggerRef = useRef<HTMLButtonElement>(null)
  const selectedFilterCount = activeFilterCount(filters)
  const chips = getActiveFilterChips(filters)
  const hasActiveFilters = chips.length > 0 || colorLabActive || walletFilter !== null
  const visibleChips = chips.slice(0, chipLimit)
  const hiddenChipCount = Math.max(0, chips.length - visibleChips.length)

  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return

    const updateChipLimit = (width: number) => {
      setChipLimit(width <= 620 ? 2 : width <= 900 ? 1 : width <= 1180 ? 2 : 4)
    }

    updateChipLimit(toolbar.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) updateChipLimit(entry.contentRect.width)
    })
    observer.observe(toolbar)
    return () => observer.disconnect()
  }, [])

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
          {hasActiveFilters && (
            <div className="active-filter-row" aria-label="Active filters">
              <div className="active-filter-row__chips">
                {walletFilter && (
                  <button
                    className="active-filter-chip active-filter-chip--wallet"
                    type="button"
                    onClick={onClearWallet}
                    aria-label={`Remove wallet filter ${walletFilter.label}`}
                  >
                    <span>Wallet {walletFilter.label}</span>
                    <span aria-hidden="true">×</span>
                  </button>
                )}
                {visibleChips.map((chip) => (
                  <button
                    key={`${chip.key}-${String(chip.value)}`}
                    className="active-filter-chip"
                    type="button"
                    onClick={() => onRemoveFilter(chip.key, chip.value)}
                    aria-label={`Remove ${chip.label} filter`}
                  >
                    <span>{chip.label}</span>
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
              {colorLabActive && (
                <span className="active-filter-indicator" aria-label="ColorLab color match is active">ColorLab match</span>
              )}
              {hiddenChipCount > 0 && (
                <button
                  className="active-filter-overflow"
                  type="button"
                  aria-label={`Show ${hiddenChipCount} more active filters`}
                  aria-expanded={filtersOpen}
                  aria-controls="filter-drawer"
                  aria-haspopup="dialog"
                  onClick={() => setFiltersOpen(true)}
                >
                  +{hiddenChipCount}
                </button>
              )}
              <button className="active-filter-row__clear" type="button" onClick={onClearFilters}>
                Clear
              </button>
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
            showRings={showRings}
            showStars={showStars}
            showVignette={showVignette}
            onRingsChange={onRingsChange}
            onStarsChange={onStarsChange}
            onVignetteChange={onVignetteChange}
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
