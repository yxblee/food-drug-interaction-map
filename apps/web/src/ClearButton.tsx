import './combobox.css'

/** The clear control both comboboxes share; the native search "x" is system blue and unnamed. */
export function ClearButton({ onClear }: { onClear: () => void }) {
  return (
    <button type="button" className="combo__clear" aria-label="Clear search" onClick={onClear}>
      ✕
    </button>
  )
}
