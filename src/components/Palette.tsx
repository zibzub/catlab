import { useState } from 'react'
import { exportSelectedCats, MAX_EXPORT_CATS, type ExportFormat, type ExportSize } from '../export'
import { MoonCatSprite } from './MoonCatSprite'
import type { AtlasManifest, CatRecord, GridArtMode } from '../types'

interface PaletteProps {
  cats: CatRecord[]
  manifest: AtlasManifest
  showRings: boolean
  mobileOpen: boolean
  onMobileClose: () => void
  onRemove: (rescueOrder: number) => void
  onClear: () => void
  onCompose: () => void
}

export function Palette({
  cats,
  manifest,
  showRings,
  mobileOpen,
  onMobileClose,
  onRemove,
  onClear,
  onCompose,
}: PaletteProps) {
  const [exportArt, setExportArt] = useState<GridArtMode>('bodies')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png')
  const [exportSize, setExportSize] = useState<ExportSize>('medium')
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const exportBlocked = cats.length > MAX_EXPORT_CATS

  async function handleExport() {
    if (exportBusy || exportBlocked) return
    setExportBusy(true)
    setExportError(null)
    try {
      await exportSelectedCats(cats, manifest, {
        artMode: exportArt,
        format: exportFormat,
        size: exportSize,
      })
    } catch (error: unknown) {
      setExportError(error instanceof Error ? error.message : 'Could not export the selected MoonCats.')
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <>
      {mobileOpen && (
        <button
          className="palette-mobile-backdrop"
          type="button"
          aria-label="Close Palette"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`palette-panel${showRings ? '' : ' palette-panel--rings-hidden'}${
          mobileOpen ? ' palette-panel--mobile-open' : ''
        }`}
        aria-labelledby="palette-title"
      >
        <div className="palette-panel__content" id="palette-drawer-content">
          <div className="palette-panel__header">
            <div>
              <h2 id="palette-title">Palette</h2>
            </div>
            <span className="palette-count" aria-live="polite">
              {cats.length}
            </span>
            <button
              className="palette-mobile-close"
              type="button"
              aria-label="Close Palette"
              onClick={onMobileClose}
            >
              ×
            </button>
          </div>
          <div className="palette-panel__intro">
            <p>Click any MoonCat to keep it here for Compose.</p>
            <div className="palette-panel__actions">
              <button type="button" className="palette-compose" onClick={onCompose}>
                Compose
              </button>
              <button type="button" className="palette-clear" onClick={onClear} disabled={cats.length === 0}>
                Clear
              </button>
            </div>
          </div>
          {cats.length > 0 && (
            <section className="palette-export" aria-labelledby="palette-export-title">
              <div className="palette-export__header">
                <div>
                  <p className="eyebrow">Local download</p>
                  <h3 id="palette-export-title">Export</h3>
                </div>
                <span className="palette-export__limit">{cats.length}/{MAX_EXPORT_CATS}</span>
              </div>
              <div className="palette-export__controls">
                <fieldset className="palette-export__group">
                  <legend>Art</legend>
                  <div className="palette-export__options" role="group" aria-label="Export art">
                    {(['bodies', 'faces'] as const).map((art) => (
                      <button
                        key={art}
                        type="button"
                        className={exportArt === art ? 'is-active' : ''}
                        aria-pressed={exportArt === art}
                        onClick={() => setExportArt(art)}
                      >
                        {art === 'bodies' ? 'Full' : 'Face'}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="palette-export__group">
                  <legend>Format</legend>
                  <div className="palette-export__options" role="group" aria-label="Export format">
                    {(['png', 'webp'] as const).map((format) => (
                      <button
                        key={format}
                        type="button"
                        className={exportFormat === format ? 'is-active' : ''}
                        aria-pressed={exportFormat === format}
                        onClick={() => setExportFormat(format)}
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="palette-export__group">
                  <legend>Size</legend>
                  <div className="palette-export__options" role="group" aria-label="Export size">
                    {(['small', 'medium', 'large'] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={exportSize === size ? 'is-active' : ''}
                        aria-pressed={exportSize === size}
                        onClick={() => setExportSize(size)}
                      >
                        {size === 'small' ? 'Small 8×' : size === 'medium' ? 'Medium 16×' : 'Large 32×'}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
              {exportBlocked ? (
                <p className="palette-export__message palette-export__message--error" role="alert">
                  Reduce the selection to {MAX_EXPORT_CATS} or fewer cats before exporting.
                </p>
              ) : exportError ? (
                <p className="palette-export__message palette-export__message--error" role="alert">
                  {exportError}
                </p>
              ) : (
                <p className="palette-export__message">
                  {cats.length === 1
                    ? 'One image will download.'
                    : `${cats.length} images will download as one ZIP.`}
                </p>
              )}
              <button
                className="palette-export__submit"
                type="button"
                disabled={exportBlocked || exportBusy}
                onClick={handleExport}
              >
                {exportBusy
                  ? 'Preparing…'
                  : cats.length === 1
                    ? `Download ${exportFormat.toUpperCase()}`
                    : `Download ZIP · ${cats.length} cats`}
              </button>
            </section>
          )}
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
                    <strong>{cat.rescueOrder}</strong>
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
    </>
  )
}
