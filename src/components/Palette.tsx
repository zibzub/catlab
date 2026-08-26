import { useState } from 'react'
import { MoonCatSprite } from './MoonCatSprite'
import type { AtlasManifest, CatRecord } from '../types'

interface PaletteProps {
  cats: CatRecord[]
  manifest: AtlasManifest
  showRings: boolean
  onRemove: (rescueOrder: number) => void
  onClear: () => void
}

export function Palette({ cats, manifest, showRings, onRemove, onClear }: PaletteProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <aside
      className={`palette-panel${showRings ? '' : ' palette-panel--rings-hidden'}${
        mobileOpen ? ' palette-panel--mobile-open' : ''
      }`}
      aria-labelledby="palette-title"
    >
      <button
        className="palette-mobile-tab"
        type="button"
        aria-expanded={mobileOpen}
        aria-controls="palette-drawer-content"
        onClick={() => setMobileOpen((current) => !current)}
      >
        <span>Palette</span>
        <strong>{cats.length}</strong>
        <span aria-hidden="true">{mobileOpen ? '⌄' : '⌃'}</span>
      </button>
      <div className="palette-panel__content" id="palette-drawer-content">
        <div className="palette-panel__header">
          <div>
            <p className="eyebrow">App-level selection</p>
            <h2 id="palette-title">Palette</h2>
          </div>
          <span className="palette-count" aria-live="polite">
            {cats.length}
          </span>
        </div>
        <div className="palette-panel__intro">
          <p>Click any bare MoonCat to keep it here for the next CatLab tool.</p>
          <button type="button" className="palette-clear" onClick={onClear} disabled={cats.length === 0}>
            Clear
          </button>
        </div>
        {cats.length === 0 ? (
          <div className="palette-empty">
            <span className="palette-empty__orb">+</span>
            <strong>Your palette is ready.</strong>
            <span>Selected cats will appear here.</span>
          </div>
        ) : (
          <ul className="palette-list">
            {cats.map((cat) => (
              <li className="palette-item" key={cat.rescueOrder}>
                <MoonCatSprite cat={cat} manifest={manifest} variant="palette" />
                <span className="palette-item__details">
                  <strong>{cat.rescueOrder.toLocaleString()}</strong>
                  <span>{cat.catId}</span>
                  <small>
                    {cat.hueName} · {cat.pattern}
                  </small>
                </span>
                <button
                  type="button"
                  className="palette-item__remove"
                  aria-label={`Remove MoonCat ${cat.rescueOrder} from palette`}
                  onClick={() => onRemove(cat.rescueOrder)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
