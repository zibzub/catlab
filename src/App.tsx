import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CatDetailsDialog } from './components/CatDetailsDialog'
import { CatGrid } from './components/CatGrid'
import { CatList } from './components/CatList'
import { ComposePage } from './components/ComposePage'
import { FilterBar } from './components/FilterBar'
import {
  buildFilterIndex,
  createEmptyFilterState,
  matchesFilters,
  removeFilterValue,
  type RemovableFilterKey,
} from './components/collectionFilters'
import { Palette } from './components/Palette'
import { loadGeneratedData } from './data'
import {
  loadMoonCatClassifications,
  loadMoonCatNames,
  type MoonCatClassifications,
  type MoonCatNames,
} from './mooncatDetails'
import type { ComposeBackground, ComposePlacedObject } from './composeExport'
import type {
  AtlasManifest,
  CatRecord,
  CollectionInteractionMode,
  FilterState,
  GridArtMode,
  GridSize,
  GridViewMode,
} from './types'

const COLLECTION_DISPLAY_PREFS_KEY = 'catlab.collection-display.v1'

interface CollectionDisplayPreferences {
  viewMode?: GridViewMode
  gridSize?: GridSize
  showRings?: boolean
  showStars?: boolean
  showVignette?: boolean
}

function loadCollectionDisplayPreferences(): CollectionDisplayPreferences {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(COLLECTION_DISPLAY_PREFS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      viewMode: parsed.viewMode === 'compact' || parsed.viewMode === 'detailed' || parsed.viewMode === 'list'
        ? parsed.viewMode
        : undefined,
      gridSize: parsed.gridSize === 'small' || parsed.gridSize === 'medium' || parsed.gridSize === 'large'
        ? parsed.gridSize
        : undefined,
      showRings: typeof parsed.showRings === 'boolean' ? parsed.showRings : undefined,
      showStars: typeof parsed.showStars === 'boolean' ? parsed.showStars : undefined,
      showVignette: typeof parsed.showVignette === 'boolean' ? parsed.showVignette : undefined,
    }
  } catch {
    return {}
  }
}

function AppHeader({
  catalogCount,
  selectedCount,
  view,
  onCollection,
  onCompose,
  onPaletteOpen,
  paletteOpen,
}: {
  catalogCount: number
  selectedCount: number
  view?: 'collection' | 'compose'
  onCollection?: () => void
  onCompose?: () => void
  onPaletteOpen?: () => void
  paletteOpen?: boolean
}) {
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          <img src="/img/logo2.png" alt="" />
        </span>
        <span>
          <strong>CatLab</strong>
        </span>
      </div>
      <div className="header-note">
        <span className="status-dot" />
        <span>Local collection</span>
        <span className="header-divider" />
        <span>{catalogCount.toLocaleString()} native cats</span>
      </div>
      {view === 'compose' ? (
        <button className="header-tool" type="button" onClick={onCollection}>Collection</button>
      ) : (
        <button className="header-tool" type="button" onClick={onCompose}>Compose</button>
      )}
      {view === 'compose' ? (
        <div className="header-selection header-selection--static">
          <span>Palette</span>
          <strong>{selectedCount}</strong>
        </div>
      ) : (
        <button
          className="header-selection"
          type="button"
          aria-expanded={paletteOpen}
          aria-controls="palette-drawer-content"
          onClick={onPaletteOpen}
        >
          <span>Palette</span>
          <strong>{selectedCount}</strong>
        </button>
      )}
    </header>
  )
}

function LoadingState({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <div className={`app-state${error ? ' app-state--error' : ''}`} role={error ? 'alert' : 'status'}>
      <span className="app-state__mark">{error ? '!' : '◌'}</span>
      <strong>{message}</strong>
      {error && <span>Generate the local index and atlases, then refresh this page.</span>}
    </div>
  )
}

export default function App() {
  const [cats, setCats] = useState<CatRecord[] | null>(null)
  const [manifest, setManifest] = useState<AtlasManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>(createEmptyFilterState)
  const [names, setNames] = useState<MoonCatNames>({})
  const [classifications, setClassifications] = useState<MoonCatClassifications | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(() => new Set())
  const [displayPreferences] = useState(loadCollectionDisplayPreferences)
  const [viewMode, setViewMode] = useState<GridViewMode>(displayPreferences.viewMode ?? 'compact')
  const [artMode, setArtMode] = useState<GridArtMode>('bodies')
  const [gridSize, setGridSize] = useState<GridSize>(displayPreferences.gridSize ?? 'medium')
  const [showRings, setShowRings] = useState(displayPreferences.showRings ?? true)
  const [showStars, setShowStars] = useState(displayPreferences.showStars ?? true)
  const [showVignette, setShowVignette] = useState(displayPreferences.showVignette ?? true)
  const [interactionMode, setInteractionMode] = useState<CollectionInteractionMode>('select')
  const [inspectedCat, setInspectedCat] = useState<CatRecord | null>(null)
  const inspectTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false)
  const [appView, setAppView] = useState<'collection' | 'compose'>('collection')
  const [composePlacedObjects, setComposePlacedObjects] = useState<ComposePlacedObject[]>([])
  const [composeBackground, setComposeBackground] = useState<ComposeBackground | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLECTION_DISPLAY_PREFS_KEY, JSON.stringify({
        viewMode,
        gridSize,
        showRings,
        showStars,
        showVignette,
      }))
    } catch {
      // Persistence is optional; keep the app usable when storage is unavailable.
    }
  }, [gridSize, showRings, showStars, showVignette, viewMode])

  useEffect(() => {
    let active = true
    loadGeneratedData()
      .then(({ cats: loadedCats, manifest: loadedManifest }) => {
        if (!active) return
        setCats(loadedCats)
        setManifest(loadedManifest)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Could not load generated data.')
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    loadMoonCatNames().then((loadedNames) => {
      if (active) setNames(loadedNames)
    })
    loadMoonCatClassifications()
      .then((loadedClassifications) => {
        if (active) setClassifications(loadedClassifications)
      })
      .catch(() => {
        if (active) setClassifications(null)
      })
    return () => {
      active = false
    }
  }, [])

  const filterIndex = useMemo(
    () => buildFilterIndex(cats ?? [], names, classifications),
    [cats, classifications, names],
  )
  const filteredCats = useMemo(
    () => (cats ?? []).filter((cat) => matchesFilters(cat, filters, filterIndex)),
    [cats, filterIndex, filters],
  )
  const selectedCats = useMemo(
    () => (cats ?? []).filter((cat) => selectedOrders.has(cat.rescueOrder)),
    [cats, selectedOrders],
  )

  const updateQuery = useCallback((query: string) => {
    setFilters((current) => ({ ...current, query }))
  }, [])

  const applyFilters = useCallback((nextFilters: FilterState) => {
    setFilters((current) => ({ ...nextFilters, query: current.query }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters((current) => ({ ...createEmptyFilterState(), query: current.query }))
  }, [])

  const removeFilter = useCallback((key: RemovableFilterKey, value: string | number) => {
    setFilters((current) => removeFilterValue(current, key, value))
  }, [])

  const toggleSelection = useCallback((rescueOrder: number) => {
    setSelectedOrders((current) => {
      const next = new Set(current)
      if (next.has(rescueOrder)) next.delete(rescueOrder)
      else next.add(rescueOrder)
      return next
    })
  }, [])

  const removeSelection = useCallback((rescueOrder: number) => {
    setSelectedOrders((current) => {
      if (!current.has(rescueOrder)) return current
      const next = new Set(current)
      next.delete(rescueOrder)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedOrders(new Set()), [])

  const chooseGridSize = useCallback((size: GridSize) => {
    setGridSize(size)
    setViewMode('compact')
  }, [])

  const inspectCat = useCallback((cat: CatRecord, trigger: HTMLButtonElement) => {
    inspectTriggerRef.current = trigger
    setInspectedCat(cat)
  }, [])

  const closeInspectedCat = useCallback(() => {
    const trigger = inspectTriggerRef.current
    inspectTriggerRef.current = null
    setInspectedCat(null)
    if (trigger?.isConnected) {
      window.requestAnimationFrame(() => trigger.focus())
    }
  }, [])

  const updateComposeBackground = useCallback((next: ComposeBackground | null) => {
    setComposeBackground((current) => {
      if (current && current.url !== next?.url) URL.revokeObjectURL(current.url)
      return next
    })
  }, [])

  if (!cats || !manifest) {
    return (
      <div className="app-shell app-shell--state">
        <AppHeader catalogCount={0} selectedCount={0} view="collection" />
        <LoadingState
          message={error ?? 'Loading the local MoonCat index…'}
          error={Boolean(error)}
        />
      </div>
    )
  }

  if (appView === 'compose') {
    return (
      <div className="app-shell">
        <AppHeader
          catalogCount={cats.length}
          selectedCount={selectedCats.length}
          view="compose"
          onCollection={() => setAppView('collection')}
        />
        <ComposePage
          cats={selectedCats}
          manifest={manifest}
          placedObjects={composePlacedObjects}
          setPlacedObjects={setComposePlacedObjects}
          background={composeBackground}
          onBackgroundChange={updateComposeBackground}
          onBack={() => setAppView('collection')}
        />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <AppHeader
        catalogCount={cats.length}
        selectedCount={selectedCats.length}
        view="collection"
        onCompose={() => {
          setMobilePaletteOpen(false)
          setAppView('compose')
        }}
        onPaletteOpen={() => setMobilePaletteOpen(true)}
        paletteOpen={mobilePaletteOpen}
      />
      <main className="workspace">
        <section className="collection-panel" aria-label="MoonCat collection">
          <div className="collection-panel__heading">
            <FilterBar
              filters={filters}
              filterIndex={filterIndex}
              resultCount={filteredCats.length}
              totalCount={cats.length}
              interactionMode={interactionMode}
              viewMode={viewMode}
              artMode={artMode}
              gridSize={gridSize}
              showRings={showRings}
              showStars={showStars}
              showVignette={showVignette}
              onQueryChange={updateQuery}
              onApplyFilters={applyFilters}
              onClearFilters={clearFilters}
              onRemoveFilter={removeFilter}
              onInteractionModeChange={setInteractionMode}
              onViewModeChange={setViewMode}
              onArtModeChange={setArtMode}
              onGridSizeChange={chooseGridSize}
              onRingsChange={setShowRings}
              onStarsChange={setShowStars}
              onVignetteChange={setShowVignette}
            />
          </div>
          {viewMode === 'list' ? (
            <CatList
              cats={filteredCats}
              manifest={manifest}
              names={names}
              artMode={artMode}
              showRings={showRings && artMode === 'bodies'}
              selectedOrders={selectedOrders}
              interactionMode={interactionMode}
              onToggle={toggleSelection}
              onInspect={inspectCat}
            />
          ) : (
            <CatGrid
              key={viewMode}
              cats={filteredCats}
              manifest={manifest}
              names={names}
              viewMode={viewMode}
              artMode={artMode}
              gridSize={viewMode === 'detailed' ? 'medium' : gridSize}
              showRings={showRings && artMode === 'bodies'}
              showStars={showStars}
              showVignette={showVignette}
              selectedOrders={selectedOrders}
              interactionMode={interactionMode}
              onToggle={toggleSelection}
              onInspect={inspectCat}
            />
          )}
        </section>
        <Palette
          cats={selectedCats}
          manifest={manifest}
          showRings={showRings}
          mobileOpen={mobilePaletteOpen}
          onMobileClose={() => setMobilePaletteOpen(false)}
          onRemove={removeSelection}
          onClear={clearSelection}
          onCompose={() => {
            setMobilePaletteOpen(false)
            setAppView('compose')
          }}
        />
      </main>
      <CatDetailsDialog
        cat={inspectedCat}
        manifest={manifest}
        onClose={closeInspectedCat}
      />
    </div>
  )
}
