import { useRef, type ChangeEvent } from 'react'
import { CatLabIcon, type CatLabIconName } from './CatLabIcon'

type ComposeToolbarIconName = Extract<
  CatLabIconName,
  | 'folder-open'
  | 'device-floppy'
  | 'arrow-back-up'
  | 'arrow-forward-up'
  | 'copy'
  | 'clipboard-text'
  | 'trash'
  | 'download'
>

interface ComposeToolbarProps {
  compositionName: string
  onCompositionNameChange: (value: string) => void
  documentBusy: boolean
  onOpenFile: (event: ChangeEvent<HTMLInputElement>) => void
  onSave: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  canCopy: boolean
  canPaste: boolean
  onCopy: () => void
  onPaste: () => void
  canClear: boolean
  onClear: () => void
  exportBusy: boolean
  onExport: () => void
}

function ToolbarButton({
  icon,
  label,
  title,
  disabled,
  className = '',
  onClick,
}: {
  icon: ComposeToolbarIconName
  label: string
  title?: string
  disabled?: boolean
  className?: string
  onClick: () => void
}) {
  return (
    <button
      className={`compose-toolbar__button${className ? ` ${className}` : ''}`}
      type="button"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
    >
      <CatLabIcon name={icon} className="compose-toolbar__icon" />
      <span className="sr-only">{label}</span>
    </button>
  )
}

export function ComposeToolbar({
  compositionName,
  onCompositionNameChange,
  documentBusy,
  onOpenFile,
  onSave,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  canCopy,
  canPaste,
  onCopy,
  onPaste,
  canClear,
  onClear,
  exportBusy,
  onExport,
}: ComposeToolbarProps) {
  const openInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="compose-action-bar" aria-label="Composition actions">
      <label className="compose-action-bar__name">
        <span className="sr-only">Composition name</span>
        <input
          type="text"
          value={compositionName}
          onChange={(event) => onCompositionNameChange(event.currentTarget.value)}
          aria-label="Composition name"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className="compose-action-bar__controls">
        <div className="compose-action-bar__group compose-action-bar__document" aria-label="Document actions">
          <ToolbarButton
            icon="folder-open"
            label="Open"
            disabled={documentBusy}
            onClick={() => openInputRef.current?.click()}
          />
          <ToolbarButton icon="device-floppy" label="Save" disabled={documentBusy} onClick={onSave} />
          <input
            ref={openInputRef}
            className="compose-document-input"
            type="file"
            accept=".catlab"
            onChange={onOpenFile}
          />
        </div>
        <div className="compose-action-bar__group compose-action-bar__history" aria-label="History actions">
          <ToolbarButton
            icon="arrow-back-up"
            label="Undo"
            title="Undo (Ctrl/Cmd+Z)"
            disabled={!canUndo}
            onClick={onUndo}
          />
          <ToolbarButton
            icon="arrow-forward-up"
            label="Redo"
            title="Redo (Ctrl/Cmd+Shift+Z)"
            disabled={!canRedo}
            onClick={onRedo}
          />
        </div>
        <div className="compose-action-bar__group compose-action-bar__clipboard" aria-label="Clipboard actions">
          <ToolbarButton icon="copy" label="Copy" disabled={!canCopy} onClick={onCopy} />
          <ToolbarButton icon="clipboard-text" label="Paste" disabled={!canPaste} onClick={onPaste} />
        </div>
      </div>
      <div className="compose-action-bar__actions">
        <ToolbarButton
          icon="trash"
          label="Clear layers"
          className="compose-clear"
          disabled={!canClear}
          onClick={onClear}
        />
        <button
          className="compose-export"
          type="button"
          disabled={exportBusy}
          onClick={onExport}
          aria-label="Export PNG"
          title="Export PNG"
        >
          <CatLabIcon name="download" className="compose-toolbar__icon" />
          <span>Export PNG</span>
        </button>
      </div>
    </div>
  )
}
