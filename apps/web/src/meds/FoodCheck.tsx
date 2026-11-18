import { useMemo, useState } from 'react'
import type { GraphPayload } from '@fdi/schema'
import { groupTerm, nodeKey, searchNodes, type Index } from '@fdi/schema/domain'
import { SEVERITY_LABEL } from '../explore/SeverityBadge.tsx'
import { checkFood, type DrugPairings } from './checkMeds.ts'
import { Combobox, NoMatch } from './Combobox.tsx'
import { WarningRow } from './WarningRow.tsx'

/** "Can I have…?": one Food answered against the Medication list, on device. */
export function FoodCheck({
  graph,
  ix,
  meds,
  notChecked,
  helps,
}: {
  graph: GraphPayload
  ix: Index
  meds: string[]
  notChecked: string[]
  helps: DrugPairings[]
}) {
  const [query, setQuery] = useState('')
  // The Food being answered, with the name the person typed (an Alias such as "wine").
  const [picked, setPicked] = useState<{ id: string; matched: string } | null>(null)
  const foods = useMemo(() => graph.nodes.filter((n) => n.kind === 'food'), [graph])
  const options = useMemo(() => searchNodes(foods, query, 8), [foods, query])
  const food = picked && ix.nodes.get(nodeKey('food', picked.id))
  const warnings = useMemo(() => (picked ? checkFood(ix, picked.id, meds) : []), [ix, picked, meds])
  const drugs = [...new Set(warnings.flatMap((w) => w.affected.map((h) => h.drug.name)))]
  const mixed = warnings.some((w) =>
    w.affected.some((h) => h.interaction.severity !== warnings[0].severity),
  )

  return (
    <section className="foodcheck" aria-label="Check a food">
      <Combobox
        id="food"
        label="Can I have…?"
        placeholder="e.g. grapefruit or wine"
        listLabel="Matching foods"
        query={query}
        onQuery={setQuery}
        rows={options.map((o) => ({
          key: o.id,
          label: (
            <>
              {o.name}
              {o.matched !== o.name && <span className="mono-label"> ({o.matched})</span>}
              {o.group && <span className="mono-label"> · {groupTerm('food')}</span>}
            </>
          ),
          pick: () => {
            setPicked({ id: o.id, matched: o.matched })
            setQuery('')
          },
        }))}
      >
        {options.length === 0 && !!query.trim() && <NoMatch hint="Check the spelling." />}
      </Combobox>
      <p role="status" className="meds__status">
        {food && (
          <>
            {meds.length === 0 ? (
              notChecked.length > 0 ? (
                <>
                  We can't check <FoodName food={food} matched={picked.matched} />: none of the
                  names on your list are in our dataset.
                </>
              ) : (
                <>
                  Add your medications first, then we can check{' '}
                  <FoodName food={food} matched={picked.matched} /> against them.
                </>
              )
            ) : warnings.length === 0 ? (
              <>
                Our dataset has no interaction between{' '}
                <FoodName food={food} matched={picked.matched} /> and the {meds.length}{' '}
                {meds.length === 1 ? 'medication' : 'medications'} on your list. That doesn't mean
                the combination is safe: our dataset is not exhaustive. Ask your pharmacist if
                you're unsure.
              </>
            ) : (
              <>
                <FoodName food={food} matched={picked.matched} /> interacts with {drugs.join(', ')}{' '}
                on your list. Severity: {mixed && 'up to '}
                {SEVERITY_LABEL[warnings[0].severity]}.
              </>
            )}
            {meds.length > 0 && notChecked.length > 0 && (
              <> Not checked: {notChecked.join(', ')}.</>
            )}
          </>
        )}
      </p>
      {warnings.length > 0 && (
        <ul className="meds__list">
          {warnings.map((w) => (
            <WarningRow key={w.food.id} warning={w} helps={helps} showSeverity />
          ))}
        </ul>
      )}
    </section>
  )
}

function FoodName({ food, matched }: { food: { name: string }; matched: string }) {
  return (
    <strong>
      {food.name}
      {matched !== food.name && ` (${matched})`}
    </strong>
  )
}
