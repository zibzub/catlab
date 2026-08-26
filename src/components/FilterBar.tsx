import { useState } from 'react'
import type { FilterState } from '../types'

interface FilterOptions {
  hueNames: string[]
  patterns: string[]
  poses: string[]
  expressions: string[]
  facings: string[]
  rescueYears: number[]
  hasGenesis: boolean
}

interface FilterBarProps {
  filters: FilterState
  options: FilterOptions
  resultCount: number
  totalCount: number
  onChange: (key: keyof FilterState, value: string) => void
  onClear: () => void
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase())
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="filter-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function FilterBar({
  filters,
  options,
  resultCount,
  totalCount,
  onChange,
  onClear,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false)
  const hasFilters = Object.values(filters).some((value) => value !== 'all' && value !== '')
  const valueOptions = (values: string[]) => [
    { value: 'all', label: 'All' },
    ...values.map((value) => ({ value, label: titleCase(value) })),
  ]

  return (
    <div className={`filter-bar${expanded ? ' filter-bar--expanded' : ' filter-bar--collapsed'}`}>
      <div className="filter-bar__topline">
        <label className="search-control">
          <span className="sr-only">Search rescue order or cat ID</span>
          <span className="search-control__icon">⌕</span>
          <input
            type="search"
            value={filters.query}
            onChange={(event) => onChange('query', event.target.value)}
            placeholder="Search rescue order or cat ID"
          />
          {filters.query && (
            <button
              className="search-control__clear"
              type="button"
              aria-label="Clear search"
              onClick={() => onChange('query', '')}
            >
              ×
            </button>
          )}
        </label>
        <div className="result-count" aria-live="polite">
          <strong>{resultCount.toLocaleString()}</strong>
          <span>of {totalCount.toLocaleString()} cats</span>
        </div>
        <button
          className="filters-toggle"
          type="button"
          aria-expanded={expanded}
          aria-controls="filter-options"
          onClick={() => setExpanded((current) => !current)}
        >
          <span>Filters</span>
          <span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
        </button>
        {hasFilters && <span className="filter-bar__active">Active</span>}
      </div>
      <div className="filter-bar__body" id="filter-options" hidden={!expanded}>
        <div className="filter-bar__actions">
          <button className="clear-filters" type="button" onClick={onClear} disabled={!hasFilters}>
            Clear filters
          </button>
        </div>
        <div className="filter-bar__controls">
          <SelectFilter
            label="Hue"
            value={filters.hueName}
            options={valueOptions(options.hueNames)}
            onChange={(value) => onChange('hueName', value)}
          />
          <SelectFilter
            label="Pattern"
            value={filters.pattern}
            options={valueOptions(options.patterns)}
            onChange={(value) => onChange('pattern', value)}
          />
          <SelectFilter
            label="Pose"
            value={filters.pose}
            options={valueOptions(options.poses)}
            onChange={(value) => onChange('pose', value)}
          />
          <SelectFilter
            label="Expression"
            value={filters.expression}
            options={valueOptions(options.expressions)}
            onChange={(value) => onChange('expression', value)}
          />
          <SelectFilter
            label="Facing"
            value={filters.facing}
            options={valueOptions(options.facings)}
            onChange={(value) => onChange('facing', value)}
          />
          <SelectFilter
            label="Year"
            value={filters.rescueYear}
            options={[
              { value: 'all', label: 'All years' },
              ...options.rescueYears.map((year) => ({ value: String(year), label: String(year) })),
            ]}
            onChange={(value) => onChange('rescueYear', value)}
          />
          <SelectFilter
            label="Pale"
            value={filters.pale}
            options={[
              { value: 'all', label: 'All tones' },
              { value: 'pale', label: 'Pale only' },
              { value: 'not-pale', label: 'Not pale' },
            ]}
            onChange={(value) => onChange('pale', value)}
          />
          {options.hasGenesis && (
            <SelectFilter
              label="Genesis"
              value={filters.genesis}
              options={[
                { value: 'all', label: 'All cats' },
                { value: 'genesis', label: 'Genesis only' },
                { value: 'not-genesis', label: 'Not Genesis' },
              ]}
              onChange={(value) => onChange('genesis', value)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
