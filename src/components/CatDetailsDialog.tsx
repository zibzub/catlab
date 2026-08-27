import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { assetPath } from '../data'
import {
  formatMoonCatClassificationFooter,
  formatMoonCatHue,
  formatMoonCatTitle,
  fitSingleLineText,
  getDetailAtlasCell,
  getDetailCardCoat,
  getMoonCatClassificationLabels,
  loadMoonCatClassifications,
  loadMoonCatNames,
  type MoonCatClassifications,
  type MoonCatNames,
} from '../mooncatDetails'
import { downloadDetailCardPng } from '../detailCardExport'
import type { AtlasManifest, CatRecord } from '../types'

interface CatDetailsDialogProps {
  cat: CatRecord | null
  manifest: AtlasManifest
  onClose: () => void
}

const PREVIEW_SCALE = 8

const TRAIT_FIELDS: Array<{ label: string; value: (cat: CatRecord) => string; className?: string }> = [
  { label: 'Cat ID', value: (cat) => cat.catId, className: 'cat-details-cat-id' },
  { label: 'Hue', value: formatMoonCatHue },
  { label: 'Coat', value: (cat) => cat.pale ? 'pale' : 'normal' },
  { label: 'Facing', value: (cat) => cat.facing },
  { label: 'Expression', value: (cat) => cat.expression },
  { label: 'Pose', value: (cat) => cat.pose },
]

export function CatDetailsDialog({ cat, manifest, onClose }: CatDetailsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const imageWindowRef = useRef<HTMLDivElement>(null)
  const actionChainStationRef = useRef<HTMLAnchorElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const attributeStripRef = useRef<HTMLDivElement>(null)
  const classificationFooterRef = useRef<HTMLDivElement>(null)
  const [names, setNames] = useState<MoonCatNames>({})
  const [classifications, setClassifications] = useState<MoonCatClassifications | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportStatus, setExportStatus] = useState('')

  useEffect(() => {
    let active = true
    loadMoonCatNames().then((loadedNames) => {
      if (active) setNames(loadedNames)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    loadMoonCatClassifications()
      .then((loadedClassifications) => {
        if (active) setClassifications(loadedClassifications)
      })
      .catch(() => {
        if (active) setClassifications(null)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setActionsOpen(false)
    setExportBusy(false)
    setExportStatus('')
  }, [cat?.rescueOrder])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!cat) {
      if (dialog.open) dialog.close()
      return
    }
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    window.requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }))
  }, [cat])

  const title = cat ? formatMoonCatTitle(cat, names) : 'MoonCat'
  const coat = cat ? getDetailCardCoat(cat) : { coat: '#ff69b4', outline: '#c13a80', genesis: null }
  const atlasCell = cat ? getDetailAtlasCell(cat, manifest) : null
  const classificationFooter = cat
    ? formatMoonCatClassificationFooter(getMoonCatClassificationLabels(cat, classifications))
    : ''
  const links = cat
    ? {
      chainStation: `https://mooncatrescue.com/mooncats/${cat.rescueOrder}`,
      openSea: `https://opensea.io/item/ethereum/0xc3f733ca98e0dad0386979eb96fb1722a1a05e69/${cat.rescueOrder}`,
    }
    : null
  const previewStyle = useMemo<CSSProperties>(() => {
    if (!atlasCell || !cat) return {}
    return {
      width: manifest.atlas.cellWidth * PREVIEW_SCALE,
      height: manifest.atlas.cellHeight * PREVIEW_SCALE,
      backgroundImage: `url("${atlasCell.url}")`,
      backgroundPosition: `-${atlasCell.x * PREVIEW_SCALE}px -${atlasCell.y * PREVIEW_SCALE}px`,
      backgroundSize: `${manifest.atlas.width * PREVIEW_SCALE}px ${manifest.atlas.height * PREVIEW_SCALE}px`,
    }
  }, [atlasCell, cat, manifest.atlas.cellHeight, manifest.atlas.cellWidth, manifest.atlas.height, manifest.atlas.width])

  useEffect(() => {
    const fitCardText = () => {
      fitSingleLineText(titleRef.current, { minFontSize: 16 })
      fitSingleLineText(attributeStripRef.current, { minFontSize: 10 })
      if (classificationFooter) fitSingleLineText(classificationFooterRef.current, { minFontSize: 17 })
      else classificationFooterRef.current?.style.removeProperty('font-size')
    }
    const frameId = window.requestAnimationFrame(fitCardText)
    const observer = typeof ResizeObserver === 'function' && cardRef.current
      ? new ResizeObserver(fitCardText)
      : null
    if (observer && cardRef.current) observer.observe(cardRef.current)
    document.fonts?.ready?.then(fitCardText)
    return () => {
      window.cancelAnimationFrame(frameId)
      observer?.disconnect()
    }
  }, [classificationFooter, title])

  function closeActions(restoreFocus = true) {
    const wasOpen = actionsOpen
    setActionsOpen(false)
    setExportStatus('')
    if (restoreFocus && wasOpen) {
      window.requestAnimationFrame(() => imageWindowRef.current?.focus())
    }
  }

  function closeDialog() {
    closeActions(false)
    if (dialogRef.current?.open) dialogRef.current.close()
    onClose()
  }

  function handleDialogCancel(event: React.SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    if (actionsOpen) closeActions()
    else closeDialog()
  }

  function openActions() {
    if (!cat) return
    setActionsOpen(true)
    setExportStatus('')
    window.requestAnimationFrame(() => actionChainStationRef.current?.focus())
  }

  async function saveCard() {
    if (!cat || !links || exportBusy) return
    setExportBusy(true)
    setExportStatus('Rendering PNG…')
    try {
      const loadedClassifications = classifications ?? await loadMoonCatClassifications().catch(() => null)
      const footer = formatMoonCatClassificationFooter(
        getMoonCatClassificationLabels(cat, loadedClassifications),
      )
      await downloadDetailCardPng({
        cat,
        manifest,
        title,
        coatColor: coat.coat,
        classificationFooter: footer,
      })
      setExportStatus('Card saved.')
    } catch (error: unknown) {
      setExportStatus(error instanceof Error ? error.message : 'Could not save the card.')
    } finally {
      setExportBusy(false)
    }
  }

  const cardStyle = {
    '--cat-details-coat': coat.coat,
    '--cat-details-outline': coat.outline,
  } as CSSProperties

  return (
    <dialog
      ref={dialogRef}
      className="cat-details-dialog"
      aria-labelledby="cat-details-title"
      onCancel={handleDialogCancel}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          if (actionsOpen) closeActions()
          else closeDialog()
        }
      }}
    >
      {cat && links && (
        <article
          ref={cardRef}
          className="cat-details-card"
          data-theme="template-card"
          data-genesis={coat.genesis ?? undefined}
          style={cardStyle}
        >
          <img
            className="cat-details-template"
            src={assetPath('img/template_full.png')}
            alt=""
            aria-hidden="true"
          />
          <header className="cat-details-title-line">
            <h2 ref={titleRef} id="cat-details-title">{title}</h2>
            <button
              ref={closeRef}
              className="cat-details-close"
              type="button"
              aria-label="Close MoonCat details"
              onClick={closeDialog}
            >
              ×
            </button>
          </header>
          <div
            ref={imageWindowRef}
            className="cat-details-image-window"
            role="button"
            tabIndex={0}
            aria-label="Open MoonCat card actions"
            aria-haspopup="dialog"
            aria-expanded={actionsOpen}
            onClick={openActions}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              openActions()
            }}
          >
            <div className="cat-details-preview-frame">
              <div className="cat-details-preview" aria-label="MoonCat atlas preview" style={previewStyle} />
            </div>
            <span className="cat-details-image-hint cat-details-download-icon" aria-hidden="true" />
          </div>
          <div ref={attributeStripRef} className="cat-details-attribute-strip" aria-live="polite">
            <span>{cat.rescueYear} RESCUE</span>
            <span>{cat.hueName.toUpperCase()}</span>
            <span>{cat.pattern.toUpperCase()}</span>
          </div>
          <section className="cat-details-detail-panel" aria-live="polite">
            <div className="cat-details-status" aria-hidden="true" />
            <dl className="cat-details-traits">
              {TRAIT_FIELDS.map((field) => (
                <div className="cat-details-trait" key={field.label}>
                  <dt>{field.label}</dt>
                  <dd className={field.className}>{field.value(cat)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <div ref={classificationFooterRef} className="cat-details-classification-footer" hidden={!classificationFooter}>
            {classificationFooter}
          </div>
          <footer className="cat-details-footer">
            <div className="cat-details-links" aria-label="MoonCat links">
              <a href={links.chainStation} target="_blank" rel="noopener noreferrer">
                <span>ChainStation</span>
                <span className="cat-details-action-icon cat-details-external-icon" aria-hidden="true" />
              </a>
              <a
                href={links.openSea}
                target="_blank"
                rel="noopener noreferrer"
                title="OpenSea applies to acclimated MoonCats and may not resolve every cat."
              >
                <span>OpenSea</span>
                <span className="cat-details-action-icon cat-details-external-icon" aria-hidden="true" />
              </a>
            </div>
          </footer>
          <div
            className="cat-details-actions"
            hidden={!actionsOpen}
            onClick={(event) => {
              if (event.target === event.currentTarget) closeActions()
            }}
          >
            <div
              className="cat-details-actions-panel"
              role="dialog"
              aria-modal="true"
              aria-label="MoonCat card actions"
              onClick={(event) => event.stopPropagation()}
            >
              <a
                ref={actionChainStationRef}
                href={links.chainStation}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => closeActions()}
              >
                <span>ChainStation</span>
                <span className="cat-details-action-icon cat-details-external-icon" aria-hidden="true" />
              </a>
              <a
                href={links.openSea}
                target="_blank"
                rel="noopener noreferrer"
                title="OpenSea applies to acclimated MoonCats and may not resolve every cat."
                onClick={() => closeActions()}
              >
                <span>OpenSea</span>
                <span className="cat-details-action-icon cat-details-external-icon" aria-hidden="true" />
              </a>
              <button type="button" disabled={exportBusy} onClick={saveCard}>
                <span>Save Card</span>
                <span className="cat-details-action-icon cat-details-download-icon" aria-hidden="true" />
              </button>
              <div className={`cat-details-actions-status${exportStatus && exportStatus !== 'Card saved.' ? ' is-error' : ''}`} role="status" aria-live="polite">
                {exportStatus}
              </div>
            </div>
          </div>
        </article>
      )}
    </dialog>
  )
}
