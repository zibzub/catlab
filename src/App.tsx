import { useCallback, useEffect, useMemo, useState } from 'react'
import { CatGrid } from './components/CatGrid'
import { FilterBar } from './components/FilterBar'
import { Palette } from './components/Palette'
import { loadGeneratedData } from './data'
import type { AtlasManifest, CatRecord, FilterState } from './types'

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

function AppHeader({ catalogCount, selectedCount }: { catalogCount: number; selectedCount: number }) {
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          ◒
        </span>
        <span>
          <strong>CatLab</strong>
          <small>MoonCat index</small>
        </span>
      </div>
      <div className="header-note">
        <span className="status-dot" />
        <span>Local collection</span>
        <span className="header-divider" />
        <span>{catalogCount.toLocaleString()} native cats</span>
      </div>
      <div className="header-selection">
        <span>Palette</span>
        <strong>{selectedCount}</strong>
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

  if (!cats || !manifest) {
    return (
      <div className="app-shell app-shell--state">
        <AppHeader catalogCount={0} selectedCount={0} />
        <LoadingState
          message={error ?? 'Loading the local MoonCat index…'}
          error={Boolean(error)}
        />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <AppHeader catalogCount={cats.length} selectedCount={selectedCats.length} />
      <main className="workspace">
        <section className="collection-panel" aria-labelledby="collection-title">
          <div className="collection-panel__heading">
            <div>
              <p className="eyebrow">Adoption center · bare/native</p>
              <h1 id="collection-title">Find your next MoonCat</h1>
            </div>
            <div className="ordering-note">
              <span className="ordering-note__icon">↕</span>
              <span>
                <strong>Rescue order</strong>
                <small>ascending</small>
              </span>
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
            selectedOrders={selectedOrders}
            onToggle={toggleSelection}
          />
        </section>
        <Palette
          cats={selectedCats}
          manifest={manifest}
          onRemove={removeSelection}
          onClear={clearSelection}
        />
      </main>
    </div>
  )
}
