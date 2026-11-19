import { useEffect, useRef } from 'react'
import type { GraphPayload } from '@fdi/schema'
import { RXNORM_ATTRIBUTION, SOURCE_KINDS, datasetFacts, formatReviewed } from './facts.ts'
import { ReportLink } from '../explore/ReportLink.tsx'
import { ABOUT_REPORT_URL } from '../explore/reportUrl.ts'
import './AboutData.css'

/** Modal dialog: the browser traps focus, closes on Escape and returns focus to the opener. */
export function AboutData({ graph, onClose }: { graph: GraphPayload; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const f = datasetFacts(graph)

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
