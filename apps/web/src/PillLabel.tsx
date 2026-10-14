/**
 * Button label that slides up on hover to reveal a copy beneath it (see `.pill-label` in styles.css).
 * The copy is CSS content with empty alt text, so the accessible name is not doubled.
 */
export function PillLabel({ children }: { children: string }) {
  return (
    <span className="pill-label">
      <span data-label={children}>{children}</span>
    </span>
  )
}
