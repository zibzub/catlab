import { useCallback, useEffect, useRef, useState } from 'react'
import type { GridArtMode } from '../types'

interface DisplayMenuProps {
  artMode: GridArtMode
  showRings: boolean
  showStars: boolean
  showVignette: boolean
  onRingsChange: (value: boolean) => void
  onStarsChange: (value: boolean) => void
  onVignetteChange: (value: boolean) => void
}

export function DisplayMenu({
  artMode,
  showRings,
  showStars,
  showVignette,
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
        className={`collection-toolbar__button display-menu__trigger display-menu__trigger--fx${open ? ' is-active' : ''}`}
        type="button"
        aria-expanded={open}
        aria-controls="fx-menu-panel"
        aria-haspopup="dialog"
        aria-label="Display effects"
        title="Display effects"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="display-effects-icon" aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={panelRef}
          className="display-menu__panel"
          id="fx-menu-panel"
          role="dialog"
          aria-label="Visual effects"
        >
          <div className="display-menu__header">
            <div>
              <p className="eyebrow">Visual effects</p>
              <strong>Tune the field</strong>
            </div>
            <button className="display-menu__close" type="button" onClick={() => closeMenu()}>
              <span aria-hidden="true">×</span>
              <span className="sr-only">Close Fx options</span>
            </button>
          </div>
          <div className="display-menu__body">
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
