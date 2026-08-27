import { useCallback, useEffect, useRef, useState } from 'react'
import type { GridArtMode, GridViewMode } from '../types'

interface DisplayMenuProps {
  viewMode: GridViewMode
  artMode: GridArtMode
  showRings: boolean
  showStars: boolean
  showVignette: boolean
  onViewModeChange: (value: GridViewMode) => void
  onArtModeChange: (value: GridArtMode) => void
  onRingsChange: (value: boolean) => void
  onStarsChange: (value: boolean) => void
  onVignetteChange: (value: boolean) => void
}

export function DisplayMenu({
  viewMode,
  artMode,
  showRings,
  showStars,
  showVignette,
  onViewModeChange,
  onArtModeChange,
  onRingsChange,
  onStarsChange,
  onVignetteChange,
}: DisplayMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const closeMenu = useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && !menuRef.current?.contains(target)) closeMenu(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeMenu()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus())
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeMenu, open])

  return (
    <div className="display-menu" ref={menuRef}>
      <button
        ref={triggerRef}
        className={`collection-toolbar__button${open ? ' is-active' : ''}`}
        type="button"
        aria-expanded={open}
        aria-controls="display-menu-panel"
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="collection-toolbar__button-icon" aria-hidden="true">☷</span>
        <span>Display</span>
        <span className="collection-toolbar__button-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div
          ref={panelRef}
          className="display-menu__panel"
          id="display-menu-panel"
          role="dialog"
          aria-label="Display options"
        >
          <div className="display-menu__header">
            <div>
              <p className="eyebrow">Collection display</p>
              <strong>Arrange the collection</strong>
            </div>
            <button className="display-menu__close" type="button" onClick={() => closeMenu()}>
              <span aria-hidden="true">×</span>
              <span className="sr-only">Close display options</span>
            </button>
          </div>
          <div className="display-menu__body">
            <div className="display-menu__group">
              <span className="display-menu__label">View</span>
              <div className="grid-view-toggle" role="group" aria-label="Grid view">
                <button
                  type="button"
                  className={viewMode === 'compact' ? 'is-active' : ''}
                  aria-pressed={viewMode === 'compact'}
                  onClick={() => onViewModeChange('compact')}
                >
                  Compact
                </button>
                <button
                  type="button"
                  className={viewMode === 'detailed' ? 'is-active' : ''}
                  aria-pressed={viewMode === 'detailed'}
                  onClick={() => onViewModeChange('detailed')}
                >
                  Details
                </button>
                <button
                  type="button"
                  className={viewMode === 'list' ? 'is-active' : ''}
                  aria-pressed={viewMode === 'list'}
                  onClick={() => onViewModeChange('list')}
                >
                  List
                </button>
              </div>
            </div>
            <div className="display-menu__group">
              <span className="display-menu__label">Art</span>
              <div className="grid-art-toggle" role="group" aria-label="Art">
                <button
                  type="button"
                  className={artMode === 'bodies' ? 'is-active' : ''}
                  aria-pressed={artMode === 'bodies'}
                  onClick={() => onArtModeChange('bodies')}
                >
                  Full
                </button>
                <button
                  type="button"
                  className={artMode === 'faces' ? 'is-active' : ''}
                  aria-pressed={artMode === 'faces'}
                  onClick={() => onArtModeChange('faces')}
                >
                  Face
                </button>
              </div>
            </div>
            <div className="display-menu__effects" aria-label="Grid effects">
              <button
                type="button"
                className={`rings-toggle${showRings && artMode === 'bodies' ? ' is-active' : ''}`}
                aria-pressed={showRings && artMode === 'bodies'}
                aria-disabled={artMode === 'faces'}
                disabled={artMode === 'faces'}
                title={artMode === 'faces' ? 'AC rings are available for Full only' : undefined}
                onClick={() => onRingsChange(!showRings)}
              >
                <span className="rings-toggle__icon" aria-hidden="true">◉</span>
                AC rings
              </button>
              <button
                type="button"
                className={`rings-toggle${showStars ? ' is-active' : ''}`}
                aria-pressed={showStars}
                onClick={() => onStarsChange(!showStars)}
              >
                <span className="rings-toggle__icon" aria-hidden="true">✦</span>
                Stars
              </button>
              <button
                type="button"
                className={`rings-toggle${showVignette ? ' is-active' : ''}`}
                aria-pressed={showVignette}
                onClick={() => onVignetteChange(!showVignette)}
              >
                <span className="rings-toggle__icon" aria-hidden="true">◌</span>
                Vignette
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
