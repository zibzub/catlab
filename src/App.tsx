import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CatDetailsDialog } from './components/CatDetailsDialog'
import { CatGrid } from './components/CatGrid'
import { CatList } from './components/CatList'
import { ColorLabPanel } from './components/ColorLabPanel'
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
import { findMoonCatsByExactHue, getMoonCatColorMatch, type ColorLabSample } from './colorLab'
import { loadGeneratedData } from './data'
import { isIdlePattern, isIdleSpeed } from './idleAnimation'
import {
  getWalletParamFromUrl,
  lookupWalletCats,
  rememberWalletLookup,
  requestConnectedWalletAddress,
  setWalletUrl,
  walletLookupUrlValue,
  type WalletFilter,
} from './walletLookup'
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
  IdlePattern,
  IdleSpeed,
  RingStyle,
} from './types'

const COLLECTION_DISPLAY_PREFS_KEY = 'catlab.collection-display.v1'

function sortRecentlyNamed(cats: CatRecord[]) {
  return [...cats].sort((first, second) => {
    if (first.nameTimestamp === null && second.nameTimestamp !== null) return 1
    if (first.nameTimestamp !== null && second.nameTimestamp === null) return -1
    if (first.nameTimestamp !== null && second.nameTimestamp !== null && first.nameTimestamp !== second.nameTimestamp) {
      return second.nameTimestamp - first.nameTimestamp
    }
    return first.rescueOrder - second.rescueOrder
  })
}

interface CollectionDisplayPreferences {
  viewMode?: GridViewMode
  gridSize?: GridSize
  ringStyle?: RingStyle
  showRings?: boolean
  showStars?: boolean
  showVignette?: boolean
  idlePattern?: IdlePattern
  idleSpeed?: IdleSpeed
}

function loadCollectionDisplayPreferences(): CollectionDisplayPreferences {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(COLLECTION_DISPLAY_PREFS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const migratedIdlePattern = parsed.idlePattern === 'snake' ? 'worm' : parsed.idlePattern
    const ringStyle = parsed.ringStyle === 'off' || parsed.ringStyle === 'ac' || parsed.ringStyle === 'outline'
      ? parsed.ringStyle
      : typeof parsed.showRings === 'boolean'
        ? parsed.showRings ? 'outline' : 'off'
        : undefined
    return {
      viewMode: parsed.viewMode === 'compact' || parsed.viewMode === 'detailed' || parsed.viewMode === 'list'
        ? parsed.viewMode
        : undefined,
      gridSize: parsed.gridSize === 'small' || parsed.gridSize === 'medium' || parsed.gridSize === 'large'
        ? parsed.gridSize
        : undefined,
      ringStyle,
      showStars: typeof parsed.showStars === 'boolean' ? parsed.showStars : undefined,
      showVignette: typeof parsed.showVignette === 'boolean' ? parsed.showVignette : undefined,
      idlePattern: isIdlePattern(migratedIdlePattern) ? migratedIdlePattern : undefined,
      idleSpeed: isIdleSpeed(parsed.idleSpeed) ? parsed.idleSpeed : undefined,
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
      <div className="app-header__global-actions">
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
      </div>
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
  const [ringStyle, setRingStyle] = useState<RingStyle>(displayPreferences.ringStyle ?? 'outline')
  const [showStars, setShowStars] = useState(displayPreferences.showStars ?? true)
  const [showVignette, setShowVignette] = useState(displayPreferences.showVignette ?? true)
  const [idlePattern, setIdlePattern] = useState<IdlePattern>(displayPreferences.idlePattern ?? 'off')
  const [idleSpeed, setIdleSpeed] = useState<IdleSpeed>(displayPreferences.idleSpeed ?? 'medium')
  const [interactionMode, setInteractionMode] = useState<CollectionInteractionMode>('select')
  const [inspectedCat, setInspectedCat] = useState<CatRecord | null>(null)
  const inspectTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false)
  const [appView, setAppView] = useState<'collection' | 'compose'>('collection')
  const [composePlacedObjects, setComposePlacedObjects] = useState<ComposePlacedObject[]>([])
  const [composeBackground, setComposeBackground] = useState<ComposeBackground | null>(null)
  const [colorLabOpen, setColorLabOpen] = useState(false)
  const [colorLabSample, setColorLabSample] = useState<ColorLabSample | null>(null)
  const [walletFilter, setWalletFilter] = useState<WalletFilter | null>(null)
  const [walletInput, setWalletInput] = useState('')
  const [walletLookupLoading, setWalletLookupLoading] = useState(false)
  const [walletLookupError, setWalletLookupError] = useState<string | null>(null)
  const walletLookupSequenceRef = useRef(0)
  const initialWalletUrlHandledRef = useRef(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLECTION_DISPLAY_PREFS_KEY, JSON.stringify({
        viewMode,
        gridSize,
        ringStyle,
        showStars,
        showVignette,
        idlePattern,
        idleSpeed,
      }))
    } catch {
      // Persistence is optional; keep the app usable when storage is unavailable.
    }
  }, [gridSize, idlePattern, idleSpeed, ringStyle, showStars, showVignette, viewMode])

  useEffect(() => {
    let active = true
    Promise.all([loadGeneratedData(), loadMoonCatNames()])
      .then(([{ cats: loadedCats, manifest: loadedManifest }, loadedNames]) => {
        if (!active) return
        setNames(loadedNames)
        setCats(loadedCats.map((cat) => ({
          ...cat,
          nameTimestamp: loadedNames[String(cat.rescueOrder)]?.timestamp ?? null,
        })))
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
  const colorLabMatch = useMemo(
    () => colorLabSample ? getMoonCatColorMatch(colorLabSample) : null,
    [colorLabSample],
  )
  const colorLabMatchingOrders = useMemo(() => {
    if (!colorLabMatch) return null
    return new Set(
      findMoonCatsByExactHue(cats ?? [], colorLabMatch.hueInt, colorLabMatch.pale)
        .map((cat) => cat.rescueOrder),
    )
  }, [cats, colorLabMatch])
  const filteredCats = useMemo(
    () => {
      const matchingCats = (cats ?? []).filter((cat) => (
        matchesFilters(cat, filters, filterIndex)
        && (colorLabMatchingOrders === null || colorLabMatchingOrders.has(cat.rescueOrder))
        && (walletFilter === null || walletFilter.ids.has(cat.rescueOrder))
      ))
      return filters.naming === 'recentlyNamed' ? sortRecentlyNamed(matchingCats) : matchingCats
    },
    [cats, colorLabMatchingOrders, filterIndex, filters, walletFilter],
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

  const clearWalletFilter = useCallback((syncUrl = true) => {
    walletLookupSequenceRef.current += 1
    setWalletFilter(null)
    setWalletInput('')
    setWalletLookupLoading(false)
    setWalletLookupError(null)
    if (syncUrl) setWalletUrl('')
  }, [])

  const beginWalletLookup = useCallback(() => {
    const sequence = walletLookupSequenceRef.current + 1
    walletLookupSequenceRef.current = sequence
    setWalletLookupLoading(true)
    setWalletLookupError(null)
    return sequence
  }, [])

  const performWalletLookup = useCallback(async (
    input: string,
    sequence: number,
    source: WalletFilter['source'],
  ) => {
    try {
      const result = await lookupWalletCats(input)
      if (walletLookupSequenceRef.current !== sequence) return
      rememberWalletLookup(result)
      setWalletFilter({ ...result, source })
      setWalletInput(source === 'connected'
        ? result.resolvedName || result.address.toLowerCase() || result.input
        : result.input)
      setWalletUrl(walletLookupUrlValue(result, source))
      return result
    } catch (lookupError: unknown) {
      if (walletLookupSequenceRef.current !== sequence) return
      setWalletLookupError(lookupError instanceof Error ? lookupError.message : 'Wallet lookup failed.')
    } finally {
      if (walletLookupSequenceRef.current === sequence) setWalletLookupLoading(false)
    }
  }, [])

  const lookupWallet = useCallback((input: string) => {
    const sequence = beginWalletLookup()
    return performWalletLookup(input, sequence, 'manual')
  }, [beginWalletLookup, performWalletLookup])

  const lookupConnectedWallet = useCallback(async () => {
    const sequence = beginWalletLookup()

    try {
      const address = await requestConnectedWalletAddress()
      if (walletLookupSequenceRef.current !== sequence) return
      await performWalletLookup(address, sequence, 'connected')
    } catch (lookupError: unknown) {
      if (walletLookupSequenceRef.current !== sequence) return
      setWalletLookupError(lookupError instanceof Error ? lookupError.message : 'Wallet lookup failed.')
      setWalletLookupLoading(false)
    }
  }, [beginWalletLookup, performWalletLookup])

  useEffect(() => {
    if (cats === null || manifest === null || initialWalletUrlHandledRef.current) return
    initialWalletUrlHandledRef.current = true

    const initialWalletInput = getWalletParamFromUrl()
    if (!initialWalletInput) return

    setWalletInput(initialWalletInput)
    void lookupWallet(initialWalletInput)
  }, [cats, lookupWallet, manifest])

  useEffect(() => {
    const handlePopState = () => {
      const nextWalletInput = getWalletParamFromUrl()
      if (!nextWalletInput) {
        clearWalletFilter(false)
        return
      }

      setWalletInput(nextWalletInput)
      void lookupWallet(nextWalletInput)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [clearWalletFilter, lookupWallet])

  const disconnectWallet = useCallback(() => {
    if (walletFilter?.source !== 'connected') return
    clearWalletFilter()
  }, [clearWalletFilter, walletFilter?.source])

  const clearFilters = useCallback(() => {
    setFilters((current) => ({ ...createEmptyFilterState(), query: current.query }))
    setColorLabSample(null)
    clearWalletFilter()
  }, [clearWalletFilter])

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
          sourceCats={selectedCats}
          catalogCats={cats}
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
              ringStyle={ringStyle}
              showStars={showStars}
              showVignette={showVignette}
              idlePattern={idlePattern}
              idleSpeed={idleSpeed}
              colorLabOpen={colorLabOpen}
              colorLabActive={colorLabMatchingOrders !== null}
              walletFilter={walletFilter}
              walletInput={walletInput}
              walletLookupLoading={walletLookupLoading}
              walletLookupError={walletLookupError}
              onQueryChange={updateQuery}
              onApplyFilters={applyFilters}
              onClearFilters={clearFilters}
              onWalletLookup={lookupWallet}
              onWalletInputChange={setWalletInput}
              onUseConnectedWallet={lookupConnectedWallet}
              onClearWallet={clearWalletFilter}
              onDisconnectWallet={disconnectWallet}
              onRemoveFilter={removeFilter}
              onInteractionModeChange={setInteractionMode}
              onViewModeChange={setViewMode}
              onArtModeChange={setArtMode}
              onGridSizeChange={chooseGridSize}
              onRingStyleChange={setRingStyle}
              onStarsChange={setShowStars}
              onVignetteChange={setShowVignette}
              onIdlePatternChange={setIdlePattern}
              onIdleSpeedChange={setIdleSpeed}
              onColorLabToggle={() => setColorLabOpen((current) => !current)}
            />
          </div>
          <ColorLabPanel
            open={colorLabOpen}
            sample={colorLabSample}
            matchingCount={colorLabMatchingOrders ? filteredCats.length : 0}
            onSampleChange={setColorLabSample}
          />
          {viewMode === 'list' ? (
            <CatList
              cats={filteredCats}
              manifest={manifest}
              names={names}
              recentlyNamed={filters.naming === 'recentlyNamed'}
              artMode={artMode}
              ringStyle={artMode === 'bodies' ? ringStyle : 'off'}
              selectedOrders={selectedOrders}
              interactionMode={interactionMode}
              onToggle={toggleSelection}
              onInspect={inspectCat}
              emptyStateMessage={walletFilter ? 'No MoonCats found for this wallet.' : undefined}
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
              ringStyle={artMode === 'bodies' ? ringStyle : 'off'}
              showStars={showStars}
              showVignette={showVignette}
              idlePattern={idlePattern}
              idleSpeed={idleSpeed}
              selectedOrders={selectedOrders}
              interactionMode={interactionMode}
              onToggle={toggleSelection}
              onInspect={inspectCat}
              emptyStateMessage={walletFilter ? 'No MoonCats found for this wallet.' : undefined}
            />
          )}
        </section>
        <Palette
          cats={selectedCats}
          manifest={manifest}
          ringStyle={ringStyle}
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
