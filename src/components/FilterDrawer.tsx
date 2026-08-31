import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  activeFilterCount,
  CLASSIFICATION_FILTER_OPTIONS,
  cloneFilterState,
  createEmptyFilterState,
  type FilterIndex,
} from './collectionFilters'
import type { FilterState } from '../types'
import {
  getInjectedWalletProvider,
  loadWalletLookupHistory,
  shortenWalletAddress,
  walletHistoryDisplayLabel,
  type WalletFilter,
} from '../walletLookup'

interface FilterDrawerProps {
  open: boolean
  activeFilters: FilterState
  index: FilterIndex
  walletFilter: WalletFilter | null
  walletLookupLoading: boolean
  walletLookupError: string | null
  onApply: (filters: FilterState) => void
  onWalletLookup: (input: string) => void
  onUseConnectedWallet: () => void
  onClearWallet: () => void
  onDisconnectWallet: () => void
  onClose: () => void
}

type FilterSectionKey = 'classification' | 'rescue' | 'coat' | 'traits' | 'naming'

const RESCUE_CLASSIFICATION_KEYS = new Set(['day1', 'day2', 'week1', 'earlyRescues', 'sub100'])
const TRAIT_CLASSIFICATION_KEYS = new Set(['genesis'])
const RESCUE_CLASSIFICATION_ORDER: Record<string, number> = {
  sub100: 0,
  day1: 1,
  day2: 2,
  week1: 3,
  earlyRescues: 4,
}
const CHARACTER_CLASSIFICATION_OPTIONS = CLASSIFICATION_FILTER_OPTIONS.filter(
  (option) => !RESCUE_CLASSIFICATION_KEYS.has(option.value) && !TRAIT_CLASSIFICATION_KEYS.has(option.value),
)
const RESCUE_CLASSIFICATION_OPTIONS = CLASSIFICATION_FILTER_OPTIONS
  .filter((option) => RESCUE_CLASSIFICATION_KEYS.has(option.value))
  .sort((a, b) => RESCUE_CLASSIFICATION_ORDER[a.value] - RESCUE_CLASSIFICATION_ORDER[b.value])
const TRAIT_CLASSIFICATION_OPTIONS = CLASSIFICATION_FILTER_OPTIONS.filter((option) => TRAIT_CLASSIFICATION_KEYS.has(option.value))

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

function parseHueBound(value: string) {
  if (value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function FilterOption({
  label,
  count,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  count: number
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <label className={`filter-drawer__option${checked ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />
      <span className="filter-drawer__checkbox" aria-hidden="true" />
      <span className="filter-drawer__option-label">{label}</span>
      <span className="filter-drawer__option-count">{count.toLocaleString()}</span>
    </label>
  )
}

function RadioOption({
  name,
  value,
  label,
  count,
  checked,
  onChange,
}: {
  name: string
  value: string
  label: string
  count: number
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className={`filter-drawer__option${checked ? ' is-selected' : ''}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />
      <span className="filter-drawer__radio" aria-hidden="true" />
      <span className="filter-drawer__option-label">{label}</span>
      <span className="filter-drawer__option-count">{count.toLocaleString()}</span>
    </label>
  )
}

function FilterAccordionSection({
  id,
  title,
  selectedCount,
  open,
  onToggle,
  children,
}: {
  id: FilterSectionKey
  title: string
  selectedCount: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const bodyId = `filter-drawer-section-${id}`
  return (
    <section className={`filter-drawer__section${open ? ' is-open' : ''}`}>
      <h3 className="filter-drawer__section-heading">
        <button
          className="filter-drawer__section-toggle"
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <span>{title}</span>
          {selectedCount > 0 && <span className="filter-drawer__section-count">{selectedCount}</span>}
          <span className="filter-drawer__section-chevron" aria-hidden="true">{open ? '⌃' : '⌄'}</span>
        </button>
      </h3>
      <div className="filter-drawer__section-body" id={bodyId} hidden={!open}>
        {children}
      </div>
    </section>
  )
}

export function FilterDrawer({
  open,
  activeFilters,
  index,
  walletFilter,
  walletLookupLoading,
  walletLookupError,
  onApply,
  onWalletLookup,
  onUseConnectedWallet,
  onClearWallet,
  onDisconnectWallet,
  onClose,
}: FilterDrawerProps) {
  const [draft, setDraft] = useState<FilterState>(() => cloneFilterState(activeFilters))
  const [hueSearch, setHueSearch] = useState('')
  const [walletInput, setWalletInput] = useState('')
  const [walletHistory, setWalletHistory] = useState(loadWalletLookupHistory)
  const [walletHistoryOpen, setWalletHistoryOpen] = useState(false)
  const [openSections, setOpenSections] = useState<Record<FilterSectionKey, boolean>>({
    classification: false,
    rescue: false,
    coat: false,
    traits: false,
    naming: false,
  })
  const closeRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft(cloneFilterState(activeFilters))
      setHueSearch('')
      setWalletInput(walletFilter?.input ?? '')
      window.requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }))
    }
    wasOpenRef.current = open
  }, [activeFilters, open, walletFilter])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  useEffect(() => {
    if (!walletFilter) {
      setWalletInput('')
      setWalletHistoryOpen(false)
      return
    }

    setWalletHistory(loadWalletLookupHistory())
    setWalletInput(walletFilter.source === 'connected'
      ? walletFilter.resolvedName || walletFilter.label || walletFilter.input
      : walletFilter.input)
  }, [walletFilter])

  if (!open) return null

  const draftCount = activeFilterCount(draft)
  const filteredHues = index.options.hueNames.filter((hue) => (
    hue.toLowerCase().includes(hueSearch.trim().toLowerCase())
  ))
  const characterCatsCount = draft.classifications.filter((value) =>
    CHARACTER_CLASSIFICATION_OPTIONS.some((option) => option.value === value),
  ).length
  const rescueCount = draft.rescueYears.length + draft.classifications.filter((value) => RESCUE_CLASSIFICATION_KEYS.has(value)).length
  const coatCount = draft.hueNames.length
    + (draft.hueValueMin !== null || draft.hueValueMax !== null ? 1 : 0)
    + draft.patterns.length
    + (draft.pale === 'all' ? 0 : 1)
  const traitsCount = draft.poses.length + draft.expressions.length + draft.facings.length
    + draft.classifications.filter((value) => TRAIT_CLASSIFICATION_KEYS.has(value)).length
  const namingCount = draft.naming === 'all' ? 0 : 1
  const injectedWalletAvailable = getInjectedWalletProvider() !== null
  const connectedWalletActive = walletFilter?.source === 'connected'

  const setSectionOpen = (section: FilterSectionKey) => {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }))
  }

  const clearDraft = () => {
    setDraft({ ...createEmptyFilterState(), query: activeFilters.query })
  }

  const applyDraft = () => {
    onApply({ ...cloneFilterState(draft), query: activeFilters.query })
    onClose()
  }

  return (
    <>
      <button
        className="filter-drawer__backdrop"
        type="button"
        aria-label="Close filters"
        onClick={onClose}
      />
      <aside
        className="filter-drawer"
        id="filter-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-drawer-title"
      >
        <div className="filter-drawer__header">
          <div>
            <h2 id="filter-drawer-title">Filter MoonCats</h2>
          </div>
          <button ref={closeRef} className="filter-drawer__close" type="button" onClick={onClose}>
            <span aria-hidden="true">×</span>
            <span className="sr-only">Close filters</span>
          </button>
        </div>

        <div className="filter-drawer__sections">
          <section className="filter-drawer__section filter-drawer__wallet">
            <div className="filter-drawer__wallet-header">
              <span className="filter-drawer__field-label">Wallet</span>
              {walletFilter && <span className="filter-drawer__field-meta">{walletFilter.ids.size.toLocaleString()} cats</span>}
            </div>
            <div
              className="filter-drawer__wallet-entry"
              onFocus={() => {
                const recent = loadWalletLookupHistory()
                setWalletHistory(recent)
                setWalletHistoryOpen(recent.length > 0)
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setWalletHistoryOpen(false)
              }}
            >
              <form
                className="filter-drawer__wallet-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  setWalletHistoryOpen(false)
                  onWalletLookup(walletInput)
                }}
              >
                <label className="filter-drawer__wallet-input-wrap">
                  <span className="sr-only">Ethereum address or ENS name</span>
                  <input
                    type="text"
                    value={walletInput}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Address or ENS name"
                    onChange={(event) => setWalletInput(event.target.value)}
                  />
                  {walletFilter && (
                    <button
                      className="filter-drawer__wallet-clear"
                      type="button"
                      aria-label="Clear wallet"
                      title="Clear wallet"
                      onClick={() => {
                        setWalletInput('')
                        setWalletHistoryOpen(false)
                        onClearWallet()
                      }}
                    >
                      ×
                    </button>
                  )}
                </label>
                <button className="filter-drawer__wallet-submit" type="submit" disabled={walletLookupLoading}>
                  {walletLookupLoading ? 'Looking up…' : 'Lookup'}
                </button>
                <button
                  className={`filter-drawer__wallet-connect${connectedWalletActive ? ' filter-drawer__wallet-disconnect' : ''}`}
                  type="button"
                  disabled={!connectedWalletActive && (!injectedWalletAvailable || walletLookupLoading)}
                  title={connectedWalletActive
                    ? 'Clear the connected wallet filter'
                    : injectedWalletAvailable
                      ? 'Use the selected account from your browser wallet'
                      : undefined}
                  onClick={connectedWalletActive ? onDisconnectWallet : onUseConnectedWallet}
                >
                  {!connectedWalletActive && <span className="wallet-icon" aria-hidden="true" />}
                  <span>{connectedWalletActive ? 'Disconnect' : 'Connect'}</span>
                </button>
              </form>
              {walletHistoryOpen && walletHistory.length > 0 && (
                <div className="filter-drawer__wallet-history" role="listbox" aria-label="Recent wallet lookups">
                  {walletHistory.map((entry) => (
                    <button
                      key={entry.address || entry.input}
                      className="filter-drawer__wallet-history-item"
                      type="button"
                      role="option"
                      aria-label={`Look up wallet ${walletHistoryDisplayLabel(entry)}`}
                      onClick={() => {
                        setWalletInput(entry.input)
                        setWalletHistoryOpen(false)
                        onWalletLookup(entry.input)
                      }}
                    >
                      <span>{walletHistoryDisplayLabel(entry)}</span>
                      {entry.resolvedName && entry.address && <small>{shortenWalletAddress(entry.address)}</small>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {walletLookupError && <p className="filter-drawer__wallet-error" role="alert">{walletLookupError}</p>}
            {walletFilter && !walletLookupError && (
              <div className="filter-drawer__wallet-status" role="status">
                <span>{walletFilter.ids.size === 0 ? 'No MoonCats found.' : `${walletFilter.ids.size.toLocaleString()} MoonCats found.`}</span>
                <button type="button" onClick={onClearWallet}>Clear wallet</button>
              </div>
            )}
          </section>

          <FilterAccordionSection
            id="coat"
            title="Coat"
            selectedCount={coatCount}
            open={openSections.coat}
            onToggle={() => setSectionOpen('coat')}
          >
            <div className="filter-drawer__field">
              <div className="filter-drawer__field-header">
                <span className="filter-drawer__field-label">Hue Name</span>
                {hueSearch.trim() && <span className="filter-drawer__field-meta">{filteredHues.length} shown</span>}
              </div>
              <label className="filter-drawer__inline-search">
                <span className="sr-only">Search hue names</span>
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={hueSearch}
                  onChange={(event) => setHueSearch(event.target.value)}
                  placeholder="Search hues"
                />
                {hueSearch && (
                  <button
                    type="button"
                    aria-label="Clear hue search"
                    onClick={() => setHueSearch('')}
                  >
                    ×
                  </button>
                )}
              </label>
              <div className="filter-drawer__option-list filter-drawer__option-list--hues">
                {filteredHues.map((hue) => (
                  <FilterOption
                    key={hue}
                    label={hue.replace(/\b\w/g, (character) => character.toUpperCase())}
                    count={index.counts.hueNames[hue] ?? 0}
                    checked={draft.hueNames.includes(hue)}
                    onChange={() => setDraft((current) => ({
                      ...current,
                      hueNames: toggleValue(current.hueNames, hue),
                    }))}
                  />
                ))}
                {filteredHues.length === 0 && <span className="filter-drawer__empty">No hues match.</span>}
              </div>
            </div>
            <div className="filter-drawer__field">
              <div className="filter-drawer__field-header">
                <span className="filter-drawer__field-label">Hue Value</span>
                <span className="filter-drawer__field-meta">inclusive range</span>
              </div>
              <div className="filter-drawer__hue-range">
                <label className="filter-drawer__number-field">
                  <span>Min</span>
                  <input
                    type="number"
                    step="1"
                    inputMode="numeric"
                    value={draft.hueValueMin ?? ''}
                    aria-label="Minimum hue value"
                    placeholder="Any"
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      hueValueMin: parseHueBound(event.target.value),
                    }))}
                  />
                </label>
                <label className="filter-drawer__number-field">
                  <span>Max</span>
                  <input
                    type="number"
                    step="1"
                    inputMode="numeric"
                    value={draft.hueValueMax ?? ''}
                    aria-label="Maximum hue value"
                    placeholder="Any"
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      hueValueMax: parseHueBound(event.target.value),
                    }))}
                  />
                </label>
              </div>
            </div>
            <div className="filter-drawer__field">
              <span className="filter-drawer__field-label">Pale / Normal</span>
              <div className="filter-drawer__option-list">
                <RadioOption
                  name="coat-pale"
                  value="all"
                  label="All coats"
                  count={index.totalCount}
                  checked={draft.pale === 'all'}
                  onChange={() => setDraft((current) => ({ ...current, pale: 'all' }))}
                />
                <RadioOption
                  name="coat-pale"
                  value="pale"
                  label="Pale"
                  count={index.counts.pale.pale}
                  checked={draft.pale === 'pale'}
                  onChange={() => setDraft((current) => ({ ...current, pale: 'pale' }))}
                />
                <RadioOption
                  name="coat-pale"
                  value="normal"
                  label="Normal"
                  count={index.counts.pale.normal}
                  checked={draft.pale === 'normal'}
                  onChange={() => setDraft((current) => ({ ...current, pale: 'normal' }))}
                />
              </div>
            </div>
            <div className="filter-drawer__field">
              <span className="filter-drawer__field-label">Pattern</span>
              <div className="filter-drawer__option-list">
                {index.options.patterns.map((pattern) => (
                  <FilterOption
                    key={pattern}
                    label={pattern.replace(/\b\w/g, (character) => character.toUpperCase())}
                    count={index.counts.patterns[pattern] ?? 0}
                    checked={draft.patterns.includes(pattern)}
                    onChange={() => setDraft((current) => ({
                      ...current,
                      patterns: toggleValue(current.patterns, pattern),
                    }))}
                  />
                ))}
              </div>
            </div>
          </FilterAccordionSection>

          <FilterAccordionSection
            id="classification"
            title="Character Cats"
            selectedCount={characterCatsCount}
            open={openSections.classification}
            onToggle={() => setSectionOpen('classification')}
          >
            <div className="filter-drawer__option-list">
              {CHARACTER_CLASSIFICATION_OPTIONS.map((option) => {
                const count = index.counts.classifications[option.value] ?? 0
                return (
                  <FilterOption
                    key={option.value}
                    label={option.label}
                    count={count}
                    checked={draft.classifications.includes(option.value)}
                    disabled={count === 0}
                    onChange={() => setDraft((current) => ({
                      ...current,
                      classifications: toggleValue(current.classifications, option.value),
                    }))}
                  />
                )
              })}
            </div>
          </FilterAccordionSection>

          <FilterAccordionSection
            id="traits"
            title="Traits"
            selectedCount={traitsCount}
            open={openSections.traits}
            onToggle={() => setSectionOpen('traits')}
          >
            <div className="filter-drawer__field">
              <span className="filter-drawer__field-label">Special</span>
              <div className="filter-drawer__option-list">
                {TRAIT_CLASSIFICATION_OPTIONS.map((option) => {
                  const count = index.counts.classifications[option.value] ?? 0
                  return (
                    <FilterOption
                      key={option.value}
                      label={option.label}
                      count={count}
                      checked={draft.classifications.includes(option.value)}
                      disabled={count === 0}
                      onChange={() => setDraft((current) => ({
                        ...current,
                        classifications: toggleValue(current.classifications, option.value),
                      }))}
                    />
                  )
                })}
              </div>
            </div>
            {([
              ['Pose', 'poses', index.options.poses, index.counts.poses],
              ['Expression', 'expressions', index.options.expressions, index.counts.expressions],
              ['Facing', 'facings', index.options.facings, index.counts.facings],
            ] as const).map(([label, key, values, counts]) => (
              <div className="filter-drawer__field" key={key}>
                <span className="filter-drawer__field-label">{label}</span>
                <div className="filter-drawer__option-list">
                  {values.map((value) => (
                    <FilterOption
                      key={value}
                      label={value.replace(/\b\w/g, (character) => character.toUpperCase())}
                      count={counts[value] ?? 0}
                      checked={draft[key].includes(value)}
                      onChange={() => setDraft((current) => ({
                        ...current,
                        [key]: toggleValue(current[key], value),
                      }))}
                    />
                  ))}
                </div>
              </div>
            ))}
          </FilterAccordionSection>

          <FilterAccordionSection
            id="naming"
            title="Name"
            selectedCount={namingCount}
            open={openSections.naming}
            onToggle={() => setSectionOpen('naming')}
          >
            <div className="filter-drawer__option-list">
              <RadioOption
                name="naming"
                value="all"
                label="All cats"
                count={index.totalCount}
                checked={draft.naming === 'all'}
                onChange={() => setDraft((current) => ({ ...current, naming: 'all' }))}
              />
              <RadioOption
                name="naming"
                value="named"
                label="Named"
                count={index.counts.naming.named}
                checked={draft.naming === 'named'}
                onChange={() => setDraft((current) => ({ ...current, naming: 'named' }))}
              />
              <RadioOption
                name="naming"
                value="unnamed"
                label="Unnamed"
                count={index.counts.naming.unnamed}
                checked={draft.naming === 'unnamed'}
                onChange={() => setDraft((current) => ({ ...current, naming: 'unnamed' }))}
              />
            </div>
          </FilterAccordionSection>

          <FilterAccordionSection
            id="rescue"
            title="Rescue"
            selectedCount={rescueCount}
            open={openSections.rescue}
            onToggle={() => setSectionOpen('rescue')}
          >
            <div className="filter-drawer__field">
              <span className="filter-drawer__field-label">Rescue Groups</span>
              <div className="filter-drawer__option-list">
                {RESCUE_CLASSIFICATION_OPTIONS.map((option) => {
                  const count = index.counts.classifications[option.value] ?? 0
                  return (
                    <FilterOption
                      key={option.value}
                      label={option.label}
                      count={count}
                      checked={draft.classifications.includes(option.value)}
                      disabled={count === 0}
                      onChange={() => setDraft((current) => ({
                        ...current,
                        classifications: toggleValue(current.classifications, option.value),
                      }))}
                    />
                  )
                })}
              </div>
            </div>
            <div className="filter-drawer__field">
              <span className="filter-drawer__field-label">Rescue Year</span>
              <div className="filter-drawer__option-list">
                {index.options.rescueYears.map((year) => (
                  <FilterOption
                    key={year}
                    label={String(year)}
                    count={index.counts.rescueYears[String(year)] ?? 0}
                    checked={draft.rescueYears.includes(year)}
                    onChange={() => setDraft((current) => ({
                      ...current,
                      rescueYears: toggleValue(current.rescueYears, year),
                    }))}
                  />
                ))}
              </div>
            </div>
          </FilterAccordionSection>
        </div>

        <div className="filter-drawer__footer">
          <button className="filter-drawer__clear" type="button" onClick={clearDraft} disabled={draftCount === 0}>
            Clear all
          </button>
          <div className="filter-drawer__footer-actions">
            <button className="filter-drawer__cancel" type="button" onClick={onClose}>Cancel</button>
            <button className="filter-drawer__apply" type="button" onClick={applyDraft}>
              Apply{draftCount > 0 ? ` (${draftCount})` : ''}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
