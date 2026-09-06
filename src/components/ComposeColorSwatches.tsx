import type { ChangeEvent } from 'react'
import { CatLabIcon } from './CatLabIcon'

interface ComposeColorSwatchesProps {
  foreground: string
  background: string
  onForegroundChange: (color: string) => void
  onBackgroundChange: (color: string) => void
  onSwap: () => void
  onReset: () => void
}

function ColorSwatch({
  label,
  value,
  onChange,
  className,
}: {
  label: string
  value: string
  onChange: (color: string) => void
  className: string
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.currentTarget.value)
  }

  return (
    <label className={`compose-color-swatch ${className}`} title={`${label} (${value})`}>
      <input type="color" value={value} aria-label={`${label} color`} onChange={handleChange} />
      <span aria-hidden="true" style={{ backgroundColor: value }} />
    </label>
  )
}

export function ComposeColorSwatches({
  foreground,
  background,
  onForegroundChange,
  onBackgroundChange,
  onSwap,
  onReset,
}: ComposeColorSwatchesProps) {
  return (
    <div className="compose-color-swatches" role="group" aria-label="Foreground and background colors">
      <div className="compose-color-swatches__stack">
        <ColorSwatch
          className="compose-color-swatch--background"
          label="Background"
          value={background}
          onChange={onBackgroundChange}
        />
        <ColorSwatch
          className="compose-color-swatch--foreground"
          label="Foreground"
          value={foreground}
          onChange={onForegroundChange}
        />
      </div>
      <div className="compose-color-swatches__actions">
        <button
          className="compose-color-swatches__action compose-color-swatches__action--swap"
          type="button"
          aria-label="Swap foreground and background colors"
          title="Swap foreground and background colors"
          onClick={onSwap}
        >
          <span aria-hidden="true">⇄</span>
        </button>
        <button
          className="compose-color-swatches__action compose-color-swatches__action--reset"
          type="button"
          aria-label="Reset foreground and background colors"
          title="Reset foreground and background colors to white and black"
          onClick={onReset}
        >
          <CatLabIcon name="restore" />
        </button>
      </div>
    </div>
  )
}
