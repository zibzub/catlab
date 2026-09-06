import type { MouseEvent, ReactNode } from 'react'
import type { ComposePlacedObject } from '../composeExport'
import { MAX_COMPOSE_LAYERS, resetComposeTransform, type ComposeLayerMove } from '../composeModel'
import type { CatRecord } from '../types'

type ComposeColorTarget = 'fill' | 'stroke'

interface ComposePropertiesPanelProps {
  selected: ComposePlacedObject | null
  selectedCat: CatRecord | null
  textFonts: readonly { label: string; value: string }[]
  layerLimitReached: boolean
  colorPickerBusy: boolean
  colorPickerSupported: boolean
  onUpdate: (update: Partial<ComposePlacedObject>, commit?: boolean) => void
  onDuplicate: () => void
  onRemove: () => void
  onReorder: (direction: ComposeLayerMove) => void
  onColorPick: (target: ComposeColorTarget, event: MouseEvent<HTMLButtonElement>) => void
  onBeginTransaction: () => void
  onCommitTransaction: () => void
}

function PropertiesSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="compose-properties__section">
      <h3 className="compose-properties__section-title">{label}</h3>
      {children}
    </section>
  )
}

export function ComposePropertiesPanel({
  selected,
  selectedCat,
  textFonts,
  layerLimitReached,
  colorPickerBusy,
  colorPickerSupported,
  onUpdate,
  onDuplicate,
  onRemove,
  onReorder,
  onColorPick,
  onBeginTransaction,
  onCommitTransaction,
}: ComposePropertiesPanelProps) {
  return (
    <section className="compose-card compose-selected compose-properties" aria-labelledby="compose-properties-title">
      <div className="compose-card__header">
        <div>
          <h2 id="compose-properties-title">Properties</h2>
        </div>
        {selected && <span className="compose-layer-number">{selected.z + 1}</span>}
      </div>
      {!selected ? (
        <p className="compose-help">Select a placed object to edit its content, style, layer, and transforms.</p>
      ) : (
        <>
          <div className="compose-selected-id">
            {selected.kind === 'cat' ? (
              <>
                <strong>MoonCat {selected.rescueOrder}</strong>
                <span>{selectedCat?.catId ?? `Rescue order ${selected.rescueOrder}`}</span>
              </>
            ) : selected.kind === 'rect' ? (
              <>
                <strong>Rectangle layer</strong>
                <span>Editable rectangle object</span>
              </>
            ) : (
              <>
                <strong>Text layer</strong>
                <span>Editable text object</span>
              </>
            )}
          </div>

          {selected.kind === 'cat' && (
            <PropertiesSection label="Appearance">
              <div className="compose-art-options" role="group" aria-label="Placed cat art">
                <button
                  type="button"
                  className={selected.artMode === 'bodies' ? 'is-active' : ''}
                  aria-pressed={selected.artMode === 'bodies'}
                  onClick={() => onUpdate({ artMode: 'bodies' }, true)}
                >
                  Full
                </button>
                <button
                  type="button"
                  className={selected.artMode === 'faces' ? 'is-active' : ''}
                  aria-pressed={selected.artMode === 'faces'}
                  onClick={() => onUpdate({ artMode: 'faces' }, true)}
                >
                  Face
                </button>
              </div>
            </PropertiesSection>
          )}

          {selected.kind === 'text' && (
            <>
              <PropertiesSection label="Content">
                <label className="compose-text-field">
                  <span>Text</span>
                  <textarea
                    rows={3}
                    value={selected.text}
                    onFocus={onBeginTransaction}
                    onBlur={onCommitTransaction}
                    onChange={(event) => onUpdate({ text: event.currentTarget.value })}
                  />
                </label>
              </PropertiesSection>
              <PropertiesSection label="Typography">
                <div className="compose-text-options">
                  <label className="compose-text-field">
                    <span>Font family</span>
                    <select
                      value={selected.fontFamily}
                      onChange={(event) => onUpdate({ fontFamily: event.currentTarget.value }, true)}
                    >
                      {textFonts.map((font) => (
                        <option key={font.label} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="compose-color-options">
                    <div className="compose-color-control">
                      <label className="compose-color-field">
                        <input
                          type="color"
                          value={selected.fill}
                          onFocus={onBeginTransaction}
                          onBlur={onCommitTransaction}
                          onChange={(event) => onUpdate({ fill: event.currentTarget.value })}
                        />
                        <span>Fill</span>
                      </label>
                      <button
                        className="compose-color-pick"
                        type="button"
                        disabled={colorPickerBusy}
                        aria-label="Sample text fill color"
                        title={
                          colorPickerSupported
                            ? 'Sample text fill color (Shift-click for screen picker)'
                            : 'Sample text fill color'
                        }
                        onClick={(event) => onColorPick('fill', event)}
                      >
                        ⌖
                      </button>
                    </div>
                    <div className="compose-color-control">
                      <label className="compose-color-field">
                        <input
                          type="color"
                          value={selected.stroke}
                          onFocus={onBeginTransaction}
                          onBlur={onCommitTransaction}
                          onChange={(event) => onUpdate({ stroke: event.currentTarget.value })}
                        />
                        <span>Outline</span>
                      </label>
                      <button
                        className="compose-color-pick"
                        type="button"
                        disabled={colorPickerBusy}
                        aria-label="Sample text outline color"
                        title={
                          colorPickerSupported
                            ? 'Sample text outline color (Shift-click for screen picker)'
                            : 'Sample text outline color'
                        }
                        onClick={(event) => onColorPick('stroke', event)}
                      >
                        ⌖
                      </button>
                    </div>
                  </div>
                  <label className="compose-range">
                    <span>
                      Outline width <output>{selected.strokeWidth.toFixed(1)} px</output>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="16"
                      step="0.5"
                      value={selected.strokeWidth}
                      onFocus={onBeginTransaction}
                      onKeyDown={onBeginTransaction}
                      onPointerDown={onBeginTransaction}
                      onPointerUp={onCommitTransaction}
                      onKeyUp={onCommitTransaction}
                      onBlur={onCommitTransaction}
                      onChange={(event) => onUpdate({ strokeWidth: Number(event.currentTarget.value) })}
                    />
                  </label>
                  <label className="compose-range">
                    <span>
                      Font size <output>{selected.fontSize} px</output>
                    </span>
                    <input
                      type="range"
                      min="12"
                      max="240"
                      step="1"
                      value={selected.fontSize}
                      onFocus={onBeginTransaction}
                      onKeyDown={onBeginTransaction}
                      onPointerDown={onBeginTransaction}
                      onPointerUp={onCommitTransaction}
                      onKeyUp={onCommitTransaction}
                      onBlur={onCommitTransaction}
                      onChange={(event) => onUpdate({ fontSize: Number(event.currentTarget.value) })}
                    />
                  </label>
                </div>
              </PropertiesSection>
            </>
          )}

          {selected.kind === 'rect' && (
            <PropertiesSection label="Appearance">
              <div className="compose-color-options compose-rectangle-options">
                <div className="compose-color-control">
                  <label className="compose-color-field">
                    <input
                      type="color"
                      value={selected.fill}
                      onFocus={onBeginTransaction}
                      onBlur={onCommitTransaction}
                      onChange={(event) => onUpdate({ fill: event.currentTarget.value })}
                    />
                    <span>Fill</span>
                  </label>
                  <button
                    className="compose-color-pick"
                    type="button"
                    disabled={colorPickerBusy}
                    aria-label="Sample rectangle fill color"
                    title={
                      colorPickerSupported
                        ? 'Sample rectangle fill color (Shift-click for screen picker)'
                        : 'Sample rectangle fill color'
                    }
                    onClick={(event) => onColorPick('fill', event)}
                  >
                    ⌖
                  </button>
                </div>
              </div>
            </PropertiesSection>
          )}

          <PropertiesSection label="Transform">
            {selected.kind !== 'rect' && (
              <label className="compose-range">
                <span>
                  Scale <output>{selected.scale.toFixed(2)}×</output>
                </span>
                <input
                  type="range"
                  min="0.4"
                  max="12"
                  step="0.05"
                  value={selected.scale}
                  onFocus={onBeginTransaction}
                  onKeyDown={onBeginTransaction}
                  onPointerDown={onBeginTransaction}
                  onPointerUp={onCommitTransaction}
                  onKeyUp={onCommitTransaction}
                  onBlur={onCommitTransaction}
                  onChange={(event) => onUpdate({ scale: Number(event.currentTarget.value) })}
                />
              </label>
            )}
            <label className="compose-range">
              <span>
                Rotation <output>{selected.rotation}°</output>
              </span>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={selected.rotation}
                onFocus={onBeginTransaction}
                onKeyDown={onBeginTransaction}
                onPointerDown={onBeginTransaction}
                onPointerUp={onCommitTransaction}
                onKeyUp={onCommitTransaction}
                onBlur={onCommitTransaction}
                onChange={(event) => onUpdate({ rotation: Number(event.currentTarget.value) })}
              />
            </label>
            <div className="compose-art-options compose-flip-options" role="group" aria-label="Flip selected object">
              <button
                type="button"
                className={selected.flipX ? 'is-active' : ''}
                aria-pressed={selected.flipX}
                onClick={() => onUpdate({ flipX: !selected.flipX }, true)}
              >
                Flip Horizontal
              </button>
              <button
                type="button"
                className={selected.flipY ? 'is-active' : ''}
                aria-pressed={selected.flipY}
                onClick={() => onUpdate({ flipY: !selected.flipY }, true)}
              >
                Flip Vertical
              </button>
            </div>
            <button
              className="compose-object-action compose-properties__reset"
              type="button"
              onClick={() => onUpdate(resetComposeTransform(selected), true)}
            >
              Reset transform
            </button>
          </PropertiesSection>

          <PropertiesSection label="Arrange">
            <div className="compose-layer-actions" role="group" aria-label="Layer order">
              <button type="button" onClick={() => onReorder('back')}>
                Back
              </button>
              <button type="button" onClick={() => onReorder('backward')}>
                Behind
              </button>
              <button type="button" onClick={() => onReorder('forward')}>
                Forward
              </button>
              <button type="button" onClick={() => onReorder('front')}>
                Front
              </button>
            </div>
          </PropertiesSection>

          <PropertiesSection label="Actions">
            <div className="compose-properties__actions">
              <button
                className="compose-duplicate"
                type="button"
                onClick={onDuplicate}
                disabled={layerLimitReached}
                title={layerLimitReached ? `Maximum ${MAX_COMPOSE_LAYERS} layers` : 'Duplicate selected'}
              >
                Duplicate selected
              </button>
              <button className="compose-remove" type="button" onClick={onRemove}>
                Remove selected
              </button>
            </div>
          </PropertiesSection>
        </>
      )}
    </section>
  )
}
