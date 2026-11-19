import { PillLabel } from '../PillLabel.tsx'
import { dailymedUrl, MedlinePlusLink, NlmSource } from '../MedlinePlusLink.tsx'
import { useEffect, useRef, useState } from 'react'
import { type Drug, type Food, type Mechanism, type NodeDetail } from '@fdi/schema'
import { groupTerm, nodeKey as keyOf, splitKey } from '@fdi/schema/domain'
import { fetchNode } from '../api.ts'
import { SEVERITY_LABEL, SeverityBadge, SeverityGroupHeading } from './SeverityBadge.tsx'
import { InteractionRow } from './InteractionRow.tsx'
import { PAIRING_MEANING, PairingRow } from './PairingRow.tsx'
import { jumpLinks, panelGroups } from './panelGroups.ts'

interface Props {
  nodeKey: string
  onSelect: (key: string) => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
  onNotFound: () => void
}

type Load = { key: string; detail?: NodeDetail; error?: boolean }

export function SidePanel({ nodeKey, onSelect, onPrev, onNext, onClose, onNotFound }: Props) {
  const [load, setLoad] = useState<Load>({ key: nodeKey })
  const [kind, id] = splitKey(nodeKey)

  useEffect(() => {
    let live = true
    fetchNode(kind, id).then(
      (detail) => {
        if (!live) return
        if (detail === null) onNotFound()
        else setLoad({ key: nodeKey, detail })
      },
      () => live && setLoad({ key: nodeKey, error: true }),
    )
    return () => {
      live = false
    }
  }, [kind, id, nodeKey, onNotFound])

  // Move focus into the panel on open; give it back to the opener on close.
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    panel.current?.focus()
    return () => {
      if (opener && opener.isConnected) opener.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, button, a, summary, [contenteditable="true"]'))
        return
      if (e.key === 'ArrowLeft') onPrev()
      else if (e.key === 'ArrowRight') onNext()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPrev, onNext, onClose])

  const d = load.key === nodeKey ? load.detail : undefined
  const entity = d?.entity
  const { collapsed, groups } = panelGroups(d?.interactions ?? [])
  const links = jumpLinks(groups, !!d && d.pairings.length > 0 && kind !== 'mechanism')
  const jump = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    const h = document.getElementById(id)
    if (!h) return
    h.focus({ preventScroll: true })
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    h.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' })
  }
  const header = d
    ? [kind, d.parent?.name ?? (d.node.group ? groupTerm(kind) : null)].filter(Boolean).join(' · ')
    : kind

  return (
    <aside ref={panel} tabIndex={-1} className="panel" aria-labelledby="panel-title">
      <div className="panel__top">
        <span className="mono-label">{header}</span>
        <div className="panel__actions">
          <button className="pill-button" onClick={onPrev} aria-label={`Previous ${kind}`}>
            <PillLabel>←</PillLabel>
          </button>
          <button className="pill-button" onClick={onNext} aria-label={`Next ${kind}`}>
            <PillLabel>→</PillLabel>
          </button>
          <button className="pill-button" onClick={onClose} aria-label="Close panel">
            ✕
          </button>
        </div>
      </div>
      <h2 id="panel-title" className="panel__title">
        {d?.node.name ?? '…'}
      </h2>

      {load.key === nodeKey && load.error && (
        <p role="alert">Couldn't load details. Try again in a moment.</p>
      )}

      {d && entity && (
        <div className="panel__body">
          {kind === 'drug' && (entity as Drug).drug_class && (
            <p className="mono-label">{(entity as Drug).drug_class}</p>
          )}
          {kind === 'drug' && ((entity as Drug).medlineplus || (entity as Drug).dailymed) && (
            <p className="panel__about">
              {(entity as Drug).medlineplus && (
                <MedlinePlusLink
                  label="About this medication (MedlinePlus)"
                  short="MedlinePlus"
                  url={(entity as Drug).medlineplus!}
                />
              )}
              {(entity as Drug).dailymed && (
                <MedlinePlusLink
                  label="Read the label (DailyMed)"
                  short="DailyMed label"
                  url={dailymedUrl((entity as Drug).dailymed!)}
                />
              )}
              <NlmSource
                medlineplus={!!(entity as Drug).medlineplus}
                dailymed={!!(entity as Drug).dailymed}
              />
            </p>
          )}
          {kind === 'food' && <p className="mono-label">{(entity as Food).category}</p>}
          {kind === 'mechanism' && <p>{(entity as Mechanism).explanation}</p>}
          <div className="panel__meta">
            {d.node.aliases.length > 0 && (
              <p className="panel__aliases">Also known as {d.node.aliases.join(', ')}</p>
            )}
            {d.parent && (
              <p className="panel__aliases">
                Part of{' '}
                <button
                  className="link-button"
                  onClick={() => onSelect(keyOf(d.parent!.kind, d.parent!.id))}
                >
                  {d.parent.name}
                </button>
              </p>
            )}
          </div>
          {d.children.length > 0 && (
            <p className="panel__aliases">
              Includes{' '}
              {d.children.map((c, k) => (
                <span key={c.id}>
                  {k > 0 && ', '}
                  <button className="link-button" onClick={() => onSelect(keyOf(c.kind, c.id))}>
                    {c.name}
                  </button>
                </span>
              ))}
            </p>
          )}

          {d.interactions.length === 0 ? (
            <p>
              No food–drug interactions recorded for this item in our dataset. That does not mean a
              combination is safe.
            </p>
          ) : (
            <>
              {links.length > 0 && (
                <nav className="jump" aria-label="Jump to severity">
                  {links.map((l) => (
                    <a key={l.id} href={`#${l.id}`} onClick={(e) => jump(e, l.id)}>
                      {l.severity ? (
                        <>
                          <SeverityBadge severity={l.severity} decorative />
                          <span className="sr-only">{SEVERITY_LABEL[l.severity]} </span>
                          {l.count}
                        </>
                      ) : (
                        'Helps to take with'
                      )}
                    </a>
                  ))}
                </nav>
              )}
              {groups.map(({ severity: sev, rows, inheritedFrom: from }) => {
                const owner = from ? d.nodes[keyOf(kind, from)] : undefined
                return (
                  <section key={sev} aria-labelledby={`sev-${sev}`} className="panel__sev">
                    <SeverityGroupHeading severity={sev} count={rows.length} />
                    {owner && <p className="mono-label">Applies to {owner.name}</p>}
                    {sev === 'avoid' && (
                      <p className="irow__caution">
                        Serious interaction. Check with your pharmacist or doctor before combining.
                      </p>
                    )}
                    <ul className="panel__rows">
                      {rows.map((row) => (
                        <InteractionRow
                          key={row.interaction.id}
                          row={row}
                          nodes={d.nodes}
                          mechanisms={d.mechanisms}
                          perspective={kind}
                          onSelect={onSelect}
                          grouped={{ inherited: !!from }}
                          groupSeverity={sev}
                          collapsible={collapsed}
                        />
                      ))}
                    </ul>
                  </section>
                )
              })}
            </>
          )}

          {d.pairings.length > 0 && kind !== 'mechanism' && (
            <section aria-labelledby="pairs-title" className="panel__pairs">
              <h3 id="pairs-title" tabIndex={-1}>
                Helpful pairings <span className="sev-count">({d.pairings.length})</span>
              </h3>
              <p className="sev-meaning">{PAIRING_MEANING}</p>
              <ul className="panel__rows">
                {d.pairings.map((r) => (
                  <PairingRow
                    key={r.pairing.id}
                    pairing={r.pairing}
                    nodes={d.nodes}
                    perspective={kind}
                    inheritedFrom={r.inheritedFrom}
                    onSelect={onSelect}
                  />
                ))}
              </ul>
            </section>
          )}

          {kind === 'drug' && (entity as Drug).medlineplus && (
            <p className="panel__attribution">
              Source: MedlinePlus, National Library of Medicine. NLM is not responsible for and does
              not endorse this site.
            </p>
          )}
        </div>
      )}
    </aside>
  )
}
