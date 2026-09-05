import { useState, type CSSProperties } from 'react'
import { getMoonCatAtlasCell } from '../mooncat-index/atlas'
import { orderComposeLayers } from '../composeModel'
import type { ComposePlacedObject } from '../composeExport'
import type { AtlasManifest } from '../types'

interface ComposeLayersPanelProps {
  objects: ComposePlacedObject[]
  manifest: AtlasManifest
  selectedId: string | null
  onSelect: (id: string) => void
  onUpdate: (id: string, update: Partial<ComposePlacedObject>) => void
}

export function getComposeLayerLabel(object: ComposePlacedObject) {
  if (object.kind === 'cat') return `MoonCat ${object.rescueOrder}`
  if (object.kind === 'rect') return 'Rectangle'
  return 'Text'
}

export function getComposeLayerDescription(object: ComposePlacedObject) {
  if (object.kind === 'cat') return object.artMode === 'faces' ? 'Face' : 'Full'
  if (object.kind === 'rect') return object.fill
  const excerpt = object.text.trim().replace(/\s+/g, ' ')
  return excerpt || 'Empty text'
}

function ComposeLayerIcon({ kind }: { kind: 'eye' | 'eye-off' | 'lock' | 'unlock' }) {
  const paths = {
    eye: (
      <>
        <path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z" />
        <circle cx="12" cy="12" r="2.25" />
      </>
    ),
    'eye-off': (
      <>
        <path d="m3 3 18 18" />
        <path d="M10.6 6.98A10.8 10.8 0 0 1 12 7c6.1 0 9.5 5 9.5 5a16 16 0 0 1-3.2 3.2M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.4 5 9.5 5c1.35 0 2.55-.28 3.6-.7" />
      </>
    ),
    lock: (
      <>
        <rect x="5.5" y="10" width="13" height="10" rx="1.7" />
        <path d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3" />
      </>
    ),
    unlock: (
      <>
        <rect x="5.5" y="10" width="13" height="10" rx="1.7" />
        <path d="M8.5 10V7a3.5 3.5 0 0 1 6.1-2.4" />
      </>
    ),
  }[kind]

  return (
    <svg className="compose-layer-row__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths}
    </svg>
  )
}

function LayerPreview({ object, manifest }: { object: ComposePlacedObject; manifest: AtlasManifest }) {
  if (object.kind === 'cat') {
    const cell = getMoonCatAtlasCell(manifest, object.rescueOrder, object.artMode)
    const scale = 32 / Math.max(cell.cellWidth, cell.cellHeight)
    const style: CSSProperties = {
      backgroundImage: `url(${cell.assetUrl})`,
      backgroundPosition: `-${cell.x * scale}px -${cell.y * scale}px`,
      backgroundSize: `${cell.atlas.width * scale}px ${cell.atlas.height * scale}px`,
    }
    return (
      <span className="compose-layer-row__preview compose-layer-row__preview--cat" style={style} aria-hidden="true" />
    )
  }

  if (object.kind === 'rect') {
    return (
      <span
        className="compose-layer-row__preview compose-layer-row__preview--rect"
        style={{ backgroundColor: object.fill }}
        aria-hidden="true"
      />
    )
  }

  return (
    <span className="compose-layer-row__preview compose-layer-row__preview--text" aria-hidden="true">
      T
    </span>
  )
}

export function ComposeLayersPanel({ objects, manifest, selectedId, onSelect, onUpdate }: ComposeLayersPanelProps) {
  const [open, setOpen] = useState(true)
  const orderedObjects = orderComposeLayers(objects)

  return (
    <details
      className="compose-card compose-layers"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="compose-card__header compose-layers__summary">
        <span>
          <h2>Layers</h2>
          <small>Front to back</small>
        </span>
        <span className="compose-count">{objects.length}</span>
      </summary>
      {orderedObjects.length === 0 ? (
        <p className="compose-help">Add an object to see it here.</p>
      ) : (
        <div className="compose-layer-list" role="list" aria-label="Composition layers">
          {orderedObjects.map((object) => {
            const label = getComposeLayerLabel(object)
            const description = getComposeLayerDescription(object)
            const primary = object.kind === 'text' ? description : label
            const secondary = object.kind === 'text' ? label : description
            return (
              <div
                className={`compose-layer-row${selectedId === object.id ? ' is-selected' : ''}`}
                role="listitem"
                key={object.id}
              >
                <button
                  className="compose-layer-row__select"
                  type="button"
                  aria-label={`Select ${label} layer`}
                  aria-pressed={selectedId === object.id}
                  onClick={() => onSelect(object.id)}
                >
                  <LayerPreview object={object} manifest={manifest} />
                  <span className="compose-layer-row__copy">
                    <strong title={primary}>{primary}</strong>
                    <span title={secondary}>{secondary}</span>
                  </span>
                </button>
                <span className="compose-layer-row__actions">
                  <button
                    className="compose-layer-row__control"
                    type="button"
                    aria-label={`${object.visible ? 'Hide' : 'Show'} ${label}`}
                    title={`${object.visible ? 'Hide' : 'Show'} ${label}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onUpdate(object.id, { visible: !object.visible })
                    }}
                  >
                    <ComposeLayerIcon kind={object.visible ? 'eye' : 'eye-off'} />
                  </button>
                  <button
                    className="compose-layer-row__control"
                    type="button"
                    aria-label={`${object.locked ? 'Unlock' : 'Lock'} ${label}`}
                    title={`${object.locked ? 'Unlock' : 'Lock'} ${label}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onUpdate(object.id, { locked: !object.locked })
                    }}
                  >
                    <ComposeLayerIcon kind={object.locked ? 'lock' : 'unlock'} />
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </details>
  )
}
