import { useEffect, useState } from 'react'
import type { GraphPayload, Kind } from '@fdi/schema'
import { splitKey } from '@fdi/schema/domain'
import { fetchGraph } from './api.ts'
import { ExploreTab } from './explore/ExploreTab.tsx'
import { MyMedsTab } from './meds/MyMedsTab.tsx'
import { useTheme } from './theme/useTheme.ts'
import { useUrlState } from './useUrlState.ts'
import './App.css'

export function App() {
  const [state, update] = useUrlState()
  const [graph, setGraph] = useState<GraphPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [medsFilter, setMedsFilter] = useState<Set<string> | null>(null)

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    fetchGraph().then(
      (g) => live && setGraph(g),
      (e: Error) => live && setError(e.message),
    )
    return () => {
      live = false
    }
  }, [attempt])

  const retry = () => {
    setError(null)
    setAttempt((n) => n + 1)
  }

  const selectedKind: Kind | null =
    state.tab === 'explore' && state.node ? splitKey(state.node)[0] : null
  const palette = useTheme(state.tint, selectedKind)

  return (
    <div className="app">
      <header className="app__bar">
        <h1 className="app__title mono-label">Food–Drug Interaction Map</h1>
        <nav className="app__tabs" role="tablist" aria-label="Mode">
          {(['explore', 'meds'] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              className="pill-button"
              aria-selected={state.tab === tab}
              aria-pressed={state.tab === tab}
              onClick={() => update({ tab }, { push: true })}
            >
              {tab === 'explore' ? 'Explore' : 'My meds'}
            </button>
          ))}
        </nav>
        <button
          className="pill-button app__palette"
          aria-pressed={state.tint}
          onClick={() => update({ tint: !state.tint })}
        >
          Color
        </button>
      </header>

      {error && (
        <div role="alert" className="app__banner">
          Couldn't load the interaction data.{' '}
          <button className="pill-button" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      <main className="app__main">
        {!graph ? (
          !error && <p className="app__loading mono-label">Loading…</p>
        ) : state.tab === 'explore' ? (
          <ExploreTab
            graph={graph}
            state={state}
            update={update}
            palette={palette}
            medsFilter={medsFilter}
            clearMedsFilter={() => setMedsFilter(null)}
          />
        ) : (
          <MyMedsTab
            graph={graph}
            onSeeOnMap={(keys) => {
              setMedsFilter(keys)
              update({ tab: 'explore', node: null, q: '', mech: true }, { push: true })
            }}
          />
        )}
      </main>

      <footer className="app__footer">
        Informational only — not medical advice. Talk to your pharmacist or doctor before changing
        your diet or medications.
      </footer>
    </div>
  )
}
