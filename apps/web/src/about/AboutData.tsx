import { useEffect, useRef } from 'react'
import type { GraphPayload } from '@fdi/schema'
import {
  RXNORM_ATTRIBUTION,
  SOURCE_KINDS,
  datasetFacts,
  formatReviewed,
  recentlyReviewed,
} from './facts.ts'
import { csvFileName, interactionsToCsv } from './interactionsToCsv.ts'
import { SEVERITY_LABEL } from '../explore/SeverityBadge.tsx'
import { nodeKey } from '@fdi/schema/domain'
import { ReportLink } from '../explore/ReportLink.tsx'
import { ABOUT_REPORT_URL } from '../explore/reportUrl.ts'
import './AboutData.css'

/** Built in the browser from the loaded Dataset: no request, so it works offline. */
function downloadCsv(graph: GraphPayload) {
  const url = URL.createObjectURL(
    new Blob([interactionsToCsv(graph)], { type: 'text/csv;charset=utf-8' }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = csvFileName(graph)
  a.click()
  URL.revokeObjectURL(url)
}

/** Modal dialog: the browser traps focus, closes on Escape and returns focus to the opener. */
export function AboutData({
  graph,
  onClose,
  onSelectNode,
}: {
  graph: GraphPayload
  onClose: () => void
  /** Show this node ("food:kale") on the map. The caller closes the dialog. */
  onSelectNode: (node: string) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const f = datasetFacts(graph)
  const recent = recentlyReviewed(graph)

  const nodeLink = (kind: 'food' | 'drug', n: { id: string; name: string }) => (
    <a
      className="about__node"
      href={`?node=${nodeKey(kind, n.id)}`}
      onClick={(e) => {
        e.preventDefault()
        onSelectNode(nodeKey(kind, n.id))
      }}
    >
      {n.name}
    </a>
  )

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) {
      d.showModal()
      d.querySelector<HTMLElement>('.about__close')?.focus() // not the first link
    }
  }, [])

  return (
    <dialog
      ref={ref}
      className="about"
      aria-labelledby="about-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
    >
      <div className="about__body">
        <h2 id="about-title" className="about__title">
          About the data
        </h2>

        <p>
          {f.drugs} Drugs, {f.foods} Foods and {f.interactions} Interactions.{' '}
          {f.reviewedAt ? (
            <>
              Most recently reviewed on{' '}
              <time dateTime={f.reviewedAt}>{formatReviewed(f.reviewedAt)}</time>.
            </>
          ) : (
            'No review date is recorded.'
          )}{' '}
          Every Interaction was written by hand and links to its Sources. Severity is our advice,
          taken from the main Source for that Interaction.
        </p>

        {recent.length > 0 && (
          <>
            <h3 id="about-recent" className="about__sub">
              Recently reviewed
            </h3>
            <ul aria-labelledby="about-recent" className="about__recent">
              {recent.map((r) => (
                <li key={r.id}>
                  {nodeLink('food', r.food)} and {nodeLink('drug', r.drug)}
                  <span className="about__recent-meta">
                    {SEVERITY_LABEL[r.severity]}, reviewed on{' '}
                    <time dateTime={r.reviewedAt}>{formatReviewed(r.reviewedAt)}</time>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="about__sub">Sources</h3>
        <p>Each Interaction links to published evidence. The kinds used here:</p>
        <ul>
          {f.citationTypes.map((t) => (
            <li key={t}>{SOURCE_KINDS[t]}</li>
          ))}
        </ul>
        <p>
          Research databases (FooDrugs and the Diet-Drug Interactions Database) were used only to
          find pairs worth checking. Their grades never set a Severity.
        </p>
        <p>
          Brand names come from RxNorm. <span className="about__quote">{RXNORM_ATTRIBUTION}</span>
        </p>

        <h3 className="about__sub">What it leaves out</h3>
        <ul>
          <li>US drug names only.</li>
          <li>
            Interactions between a food or drink and a drug only. Drug-to-drug is not covered.
          </li>
          <li>A medication that is not in the Dataset shows as “not checked”.</li>
          <li>
            No result does not mean no interaction. The Dataset is curated and incomplete, so an
            empty list is never a sign that something is safe.
          </li>
        </ul>

        <h3 className="about__sub">Take the data with you</h3>
        <p>
          Every Interaction as a spreadsheet file: Drug, Food, Severity, Effect, Mechanisms,
          summary, review date and Source links. Helpful pairings are not included.
        </p>
        <button className="about__download pill-button" onClick={() => downloadCsv(graph)}>
          Download the interactions (CSV)
        </button>

        <h3 className="about__sub">Your medication list</h3>
        <p>It stays on this device. It is never sent anywhere.</p>

        <ReportLink href={ABOUT_REPORT_URL} />

        <p className="about__disclaimer">
          Informational only — not medical advice. Talk to your pharmacist or doctor before changing
          your diet or medications.
        </p>

        <button className="about__close pill-button" onClick={() => ref.current?.close()}>
          Close
        </button>
      </div>
    </dialog>
  )
}
