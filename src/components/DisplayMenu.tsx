import { useCallback, useEffect, useRef, useState } from 'react'
import type { GridArtMode, IdlePattern, IdleSpeed, RingStyle } from '../types'

interface DisplayMenuProps {
  artMode: GridArtMode
  ringStyle: RingStyle
  showStars: boolean
  showVignette: boolean
  idlePattern: IdlePattern
  idleSpeed: IdleSpeed
  onRingStyleChange: (value: RingStyle) => void
  onStarsChange: (value: boolean) => void
  onVignetteChange: (value: boolean) => void
  onIdlePatternChange: (value: IdlePattern) => void
  onIdleSpeedChange: (value: IdleSpeed) => void
}

export function DisplayMenu({
  artMode,
  ringStyle,
  showStars,
  showVignette,
  idlePattern,
  idleSpeed,
  onRingStyleChange,
  onStarsChange,
  onVignetteChange,
  onIdlePatternChange,
  onIdleSpeedChange,
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
              <div className="rings-style-picker" role="group" aria-label="Ring style">
                {(['off', 'ac', 'outline'] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    className={`rings-toggle rings-toggle--${style}${ringStyle === style && artMode === 'bodies' ? ' is-active' : ''}`}
                    aria-pressed={ringStyle === style && artMode === 'bodies'}
                    aria-disabled={artMode === 'faces'}
                    disabled={artMode === 'faces'}
                    title={artMode === 'faces' ? 'Ring styles are available for Full only' : undefined}
                    onClick={() => onRingStyleChange(style)}
                  >
                    <span className="rings-toggle__icon" aria-hidden="true">{style === 'off' ? '×' : style === 'ac' ? '◉' : '◌'}</span>
                    {style === 'off' ? 'Off' : style === 'ac' ? 'AC' : 'Outline'}
                  </button>
                ))}
              </div>
              <div className="idle-controls" aria-label="Idle animation">
                <label className="idle-controls__row">
                  <span>Idle</span>
                  <select
                    aria-label="Idle pattern"
                    value={idlePattern}
                    onChange={(event) => onIdlePatternChange(event.target.value as IdlePattern)}
                  >
                    <option value="off">Off</option>
                    <option value="wave">Wave</option>
                    <option value="cascade">Cascade</option>
                    <option value="random">Random</option>
                    <option value="popcorn">Popcorn</option>
                    <option value="ripple">Ripple</option>
                    <option value="worm">Worm</option>
                    <option value="snake-game">Snake</option>
                  </select>
                </label>
                <label className="idle-controls__row">
                  <span>Speed</span>
                  <select
                    aria-label="Idle speed"
                    value={idleSpeed}
                    onChange={(event) => onIdleSpeedChange(event.target.value as IdleSpeed)}
                  >
                    <option value="slow">Slow</option>
                    <option value="medium">Medium</option>
                    <option value="fast">Fast</option>
                  </select>
                </label>
              </div>
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
