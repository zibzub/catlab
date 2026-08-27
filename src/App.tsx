import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CatDetailsDialog } from './components/CatDetailsDialog'
import { CatGrid } from './components/CatGrid'
import { ComposePage } from './components/ComposePage'
import { FilterBar } from './components/FilterBar'
import { Palette } from './components/Palette'
import { loadGeneratedData } from './data'
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

const initialFilters: FilterState = {
  query: '',
  hueName: 'all',
  pattern: 'all',
  pose: 'all',
  expression: 'all',
  facing: 'all',
  rescueYear: 'all',
  pale: 'all',
  genesis: 'all',
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
          ◒
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

function filterOptions(cats: CatRecord[]) {
  const values = (field: keyof CatRecord) =>
    [...new Set(cats.map((cat) => String(cat[field])))].sort((a, b) => a.localeCompare(b))
  return {
    hueNames: values('hueName'),
    patterns: values('pattern'),
    poses: values('pose'),
    expressions: values('expression'),
    facings: values('facing'),
    rescueYears: [...new Set(cats.map((cat) => cat.rescueYear))].sort((a, b) => a - b),
    hasGenesis: cats.some((cat) => cat.genesis),
  }
}

function matchesFilters(cat: CatRecord, filters: FilterState) {
  const query = filters.query.trim().toLowerCase()
  if (
    query &&
    !String(cat.rescueOrder).includes(query) &&
    !cat.catId.toLowerCase().includes(query)
  ) {
    return false
  }
  if (filters.hueName !== 'all' && cat.hueName !== filters.hueName) return false
  if (filters.pattern !== 'all' && cat.pattern !== filters.pattern) return false
  if (filters.pose !== 'all' && cat.pose !== filters.pose) return false
  if (filters.expression !== 'all' && cat.expression !== filters.expression) return false
  if (filters.facing !== 'all' && cat.facing !== filters.facing) return false
  if (filters.rescueYear !== 'all' && cat.rescueYear !== Number(filters.rescueYear)) return false
  if (filters.pale === 'pale' && !cat.pale) return false
  if (filters.pale === 'not-pale' && cat.pale) return false
  if (filters.genesis === 'genesis' && !cat.genesis) return false
  if (filters.genesis === 'not-genesis' && cat.genesis) return false
  return true
}

export default function App() {
  const [cats, setCats] = useState<CatRecord[] | null>(null)
  const [manifest, setManifest] = useState<AtlasManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(() => new Set())
  const [viewMode, setViewMode] = useState<GridViewMode>('compact')
  const [artMode, setArtMode] = useState<GridArtMode>('bodies')
  const [gridSize, setGridSize] = useState<GridSize>('medium')
  const [showRings, setShowRings] = useState(true)
  const [showStars, setShowStars] = useState(false)
  const [showVignette, setShowVignette] = useState(true)
  const [interactionMode, setInteractionMode] = useState<CollectionInteractionMode>('select')
  const [inspectedCat, setInspectedCat] = useState<CatRecord | null>(null)
  const inspectTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false)
  const [appView, setAppView] = useState<'collection' | 'compose'>('collection')
  const [composePlacedObjects, setComposePlacedObjects] = useState<ComposePlacedObject[]>([])
  const [composeBackground, setComposeBackground] = useState<ComposeBackground | null>(null)

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

  const options = useMemo(() => filterOptions(cats ?? []), [cats])
  const filteredCats = useMemo(
    () => (cats ?? []).filter((cat) => matchesFilters(cat, filters)),
    [cats, filters],
  )
  const selectedCats = useMemo(
    () => (cats ?? []).filter((cat) => selectedOrders.has(cat.rescueOrder)),
    [cats, selectedOrders],
  )

  const updateFilter = useCallback((key: keyof FilterState, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }, [])

  const clearFilters = useCallback(() => setFilters(initialFilters), [])

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
            <div className="collection-heading-tools">
              <div className="collection-view-controls">
                <div className="collection-control-group collection-control-group--mode">
                  <div className="grid-mode-toggle" role="group" aria-label="Mode">
                    <span className="grid-mode-toggle__label">Mode</span>
                    <button
                      type="button"
                      className={interactionMode === 'select' ? 'is-active' : ''}
                      aria-pressed={interactionMode === 'select'}
                      onClick={() => setInteractionMode('select')}
                    >
                      Select
                    </button>
                    <button
                      type="button"
                      className={interactionMode === 'inspect' ? 'is-active' : ''}
                      aria-pressed={interactionMode === 'inspect'}
                      onClick={() => setInteractionMode('inspect')}
                    >
                      Inspect
                    </button>
                  </div>
                </div>
                <div className="collection-control-group collection-control-group--layout">
                  <div className="grid-view-toggle" role="group" aria-label="Grid view">
                    <span className="grid-view-toggle__label">View</span>
                    <button
                      type="button"
                      className={viewMode === 'compact' ? 'is-active' : ''}
                      aria-pressed={viewMode === 'compact'}
                      onClick={() => setViewMode('compact')}
                    >
                      Compact
                    </button>
                    <button
                      type="button"
                      className={viewMode === 'detailed' ? 'is-active' : ''}
                      aria-pressed={viewMode === 'detailed'}
                      onClick={() => setViewMode('detailed')}
                    >
                      Details
                    </button>
                  </div>
                  <div className="grid-art-toggle" role="group" aria-label="Art">
                    <span className="grid-art-toggle__label">Art</span>
                    <button
                      type="button"
                      className={artMode === 'bodies' ? 'is-active' : ''}
                      aria-pressed={artMode === 'bodies'}
                      onClick={() => setArtMode('bodies')}
                    >
                      Full
                    </button>
                    <button
                      type="button"
                      className={artMode === 'faces' ? 'is-active' : ''}
                      aria-pressed={artMode === 'faces'}
                      onClick={() => setArtMode('faces')}
                    >
                      Face
                    </button>
                  </div>
                  <div className="grid-size-toggle" role="group" aria-label="Grid size">
                    {(['small', 'medium', 'large'] as const).map((size) => {
                      const cellCount = size === 'small' ? 9 : size === 'medium' ? 6 : 4
                      const label = size[0].toUpperCase() + size.slice(1)
                      return (
                        <button
                          key={size}
                          type="button"
                          className={gridSize === size ? 'is-active' : ''}
                          aria-label={`${label} cats`}
                          title={`${label} cats`}
                          aria-pressed={gridSize === size}
                          onClick={() => setGridSize(size)}
                        >
                          <span className={`grid-size-icon grid-size-icon--${size}`} aria-hidden="true">
                            {Array.from({ length: cellCount }, (_, index) => (
                              <span key={index} />
                            ))}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="collection-control-group collection-control-group--effects">
                  <button
                    type="button"
                    className={`rings-toggle${showRings && artMode === 'bodies' ? ' is-active' : ''}`}
                    aria-pressed={showRings && artMode === 'bodies'}
                    aria-disabled={artMode === 'faces'}
                    disabled={artMode === 'faces'}
                    title={artMode === 'faces' ? 'AC rings are available for Full only' : undefined}
                    onClick={() => setShowRings((current) => !current)}
                  >
                    <span className="rings-toggle__icon" aria-hidden="true">
                      ◉
                    </span>
                    AC rings
                  </button>
                  <button
                    type="button"
                    className={`rings-toggle${showStars ? ' is-active' : ''}`}
                    aria-pressed={showStars}
                    onClick={() => setShowStars((current) => !current)}
                  >
                    <span className="rings-toggle__icon" aria-hidden="true">
                      ✦
                    </span>
                    Stars
                  </button>
                  <button
                    type="button"
                    className={`rings-toggle${showVignette ? ' is-active' : ''}`}
                    aria-pressed={showVignette}
                    onClick={() => setShowVignette((current) => !current)}
                  >
                    <span className="rings-toggle__icon" aria-hidden="true">
                      ◌
                    </span>
                    Vignette
                  </button>
                </div>
              </div>
            </div>
          </div>
          <FilterBar
            filters={filters}
            options={options}
            resultCount={filteredCats.length}
            totalCount={cats.length}
            onChange={updateFilter}
            onClear={clearFilters}
          />
          <CatGrid
            cats={filteredCats}
            manifest={manifest}
            viewMode={viewMode}
            artMode={artMode}
            gridSize={gridSize}
            showRings={showRings && artMode === 'bodies'}
            showStars={showStars}
            showVignette={showVignette}
            selectedOrders={selectedOrders}
            interactionMode={interactionMode}
            onToggle={toggleSelection}
            onInspect={inspectCat}
          />
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
