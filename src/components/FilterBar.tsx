import { useEffect, useRef, useState } from 'react'
import { activeFilterCount, getActiveFilterChips, type FilterIndex, type RemovableFilterKey } from './collectionFilters'
import { DisplayMenu } from './DisplayMenu'
import { FilterDrawer } from './FilterDrawer'
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
  onQueryChange: (query: string) => void
  onApplyFilters: (filters: FilterState) => void
  onClearFilters: () => void
  onRemoveFilter: (key: RemovableFilterKey, value: string | number) => void
  onInteractionModeChange: (mode: CollectionInteractionMode) => void
  onViewModeChange: (mode: GridViewMode) => void
  onArtModeChange: (mode: GridArtMode) => void
  onGridSizeChange: (size: GridSize) => void
  onRingsChange: (show: boolean) => void
  onStarsChange: (show: boolean) => void
  onVignetteChange: (show: boolean) => void
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
  onQueryChange,
  onApplyFilters,
  onClearFilters,
  onRemoveFilter,
  onInteractionModeChange,
  onViewModeChange,
  onArtModeChange,
  onGridSizeChange,
  onRingsChange,
  onStarsChange,
  onVignetteChange,
}: FilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [chipLimit, setChipLimit] = useState(4)
  const filtersTriggerRef = useRef<HTMLButtonElement>(null)
  const selectedFilterCount = activeFilterCount(filters)
  const chips = getActiveFilterChips(filters)
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
          <span className="sr-only">Search rescue ID</span>
          <span className="search-control__icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            value={filters.query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search rescue ID"
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
          {chips.length > 0 && (
            <div className="active-filter-row" aria-label="Active filters">
              <div className="active-filter-row__chips">
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
          <button
            ref={filtersTriggerRef}
            className={`collection-toolbar__button${filtersOpen || selectedFilterCount > 0 ? ' is-active' : ''}`}
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
          <DisplayMenu
            viewMode={viewMode}
            artMode={artMode}
            gridSize={gridSize}
            showRings={showRings}
            showStars={showStars}
            showVignette={showVignette}
            onViewModeChange={onViewModeChange}
            onArtModeChange={onArtModeChange}
            onGridSizeChange={onGridSizeChange}
            onRingsChange={onRingsChange}
            onStarsChange={onStarsChange}
            onVignetteChange={onVignetteChange}
          />
        </div>
      </div>

      <FilterDrawer
        open={filtersOpen}
        activeFilters={filters}
        index={filterIndex}
        onApply={onApplyFilters}
        onClose={closeFilters}
      />
    </div>
  )
}
