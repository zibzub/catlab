import { useRef, type ChangeEvent } from 'react'

type ComposeToolbarIconName = 'open' | 'save' | 'undo' | 'redo' | 'copy' | 'paste' | 'trash' | 'export'

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

function ComposeToolbarIcon({ name }: { name: ComposeToolbarIconName }) {
  const paths = {
    open: (
      <>
        <path d="M3 6.5h6l2 2h10v9.8a1.7 1.7 0 0 1-1.7 1.7H4.7A1.7 1.7 0 0 1 3 18.3Z" />
        <path d="M3 8.5h18" />
      </>
    ),
    save: (
      <>
        <path d="M4 3.5h13l3 3v14H4Z" />
        <path d="M8 3.5v6h8v-6M8 20.5v-6h8v6" />
      </>
    ),
    undo: <path d="M9 7 4 12l5 5M5 12h8.2a6.8 6.8 0 0 1 6.8 6.8" />,
    redo: <path d="m15 7 5 5-5 5M19 12h-8.2A6.8 6.8 0 0 0 4 18.8" />,
    copy: (
      <>
        <rect x="8" y="8" width="11" height="12" rx="1.5" />
        <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-10A1.5 1.5 0 0 0 3 5.5v11A1.5 1.5 0 0 0 4.5 18H8" />
      </>
    ),
    paste: (
      <>
        <path d="M8 5.5h8A1.5 1.5 0 0 1 17.5 7v13H6.5V7A1.5 1.5 0 0 1 8 5.5Z" />
        <path d="M9 3.5h6a1 1 0 0 1 1 1v2H8v-2a1 1 0 0 1 1-1ZM9 10h6M9 13h6M9 16h4" />
      </>
    ),
    trash: (
      <>
        <path d="M4 6h16M9 6V3.5h6V6M7 6l.8 14h8.4L17 6M10 10v6M14 10v6" />
      </>
    ),
    export: (
      <>
        <path d="M12 3v11M7.5 8.5 12 13l4.5-4.5M5 16.5v3h14v-3" />
      </>
    ),
  }[name]

  return (
    <svg className="compose-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths}
    </svg>
  )
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
      <ComposeToolbarIcon name={icon} />
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
      <div className="compose-action-bar__group compose-action-bar__document" aria-label="Document actions">
        <ToolbarButton icon="open" label="Open" disabled={documentBusy} onClick={() => openInputRef.current?.click()} />
        <ToolbarButton icon="save" label="Save" disabled={documentBusy} onClick={onSave} />
        <input
          ref={openInputRef}
          className="compose-document-input"
          type="file"
          accept=".catlab"
          onChange={onOpenFile}
        />
      </div>
      <div className="compose-action-bar__group compose-action-bar__history" aria-label="History actions">
        <ToolbarButton icon="undo" label="Undo" title="Undo (Ctrl/Cmd+Z)" disabled={!canUndo} onClick={onUndo} />
        <ToolbarButton icon="redo" label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)" disabled={!canRedo} onClick={onRedo} />
      </div>
      <div className="compose-action-bar__group compose-action-bar__clipboard" aria-label="Clipboard actions">
        <ToolbarButton icon="copy" label="Copy" disabled={!canCopy} onClick={onCopy} />
        <ToolbarButton icon="paste" label="Paste" disabled={!canPaste} onClick={onPaste} />
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
          <ComposeToolbarIcon name="export" />
          <span>Export PNG</span>
        </button>
      </div>
    </div>
  )
}
