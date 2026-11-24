import { SEVERITY_LABEL, SeverityBadge } from './SeverityBadge.tsx'
import type { JumpLink } from './panelGroups.ts'

/** Move focus to the heading and scroll it into view; reduced motion jumps without animating. */
function jump(e: React.MouseEvent, id: string) {
  e.preventDefault()
  const h = document.getElementById(id)
  if (!h) return
  h.focus({ preventScroll: true })
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  h.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' })
}

/** The jump-to-Severity row above a long list, from `jumpLinks`. */
export function JumpNav({ links }: { links: JumpLink[] }) {
  if (!links.length) return null
  return (
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
  )
}
