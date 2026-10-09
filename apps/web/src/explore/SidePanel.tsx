import { useEffect, useRef, useState } from 'react'
import type { Drug, Food, Mechanism, NodeDetail } from '@fdi/schema'
import { groupTerm, nodeKey as keyOf, splitKey } from '@fdi/schema/domain'
import { fetchNode } from '../api.ts'
import { InteractionRow } from './InteractionRow.tsx'

interface Props {
  nodeKey: string
  position: { index: number; total: number }
  onSelect: (key: string) => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
  onNotFound: () => void
}

type Load = { key: string; detail?: NodeDetail; error?: boolean }

export function SidePanel({
  nodeKey,
  position,
  onSelect,
  onPrev,
  onNext,
  onClose,
  onNotFound,
}: Props) {
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
  const header = d
    ? [kind, d.parent?.name ?? (d.node.group ? groupTerm(kind) : null)].filter(Boolean).join(' · ')
    : kind

  return (
    <aside ref={panel} tabIndex={-1} className="panel" aria-labelledby="panel-title">
      <div className="panel__top">
        <span className="mono-label">{header}</span>
        <span className="mono-label">
          {position.index + 1} / {position.total}
        </span>
        <button className="pill-button" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
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
          {kind === 'food' && <p className="mono-label">{(entity as Food).category}</p>}
          {kind === 'mechanism' && <p>{(entity as Mechanism).explanation}</p>}
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
            <ul className="panel__rows">
              {d.interactions.map((row) => (
                <InteractionRow
                  key={row.interaction.id}
                  row={row}
                  nodes={d.nodes}
                  mechanisms={d.mechanisms}
                  perspective={kind}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <nav className="panel__nav" aria-label="Browse">
        <button className="pill-button" onClick={onPrev}>
          ← Prev
        </button>
        <button className="pill-button" onClick={onNext}>
          Next →
        </button>
      </nav>
    </aside>
  )
}
