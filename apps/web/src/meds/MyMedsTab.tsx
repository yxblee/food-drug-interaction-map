import type { GraphPayload } from '@fdi/schema'

export interface MyMedsTabProps {
  graph: GraphPayload
  onSeeOnMap: (keys: Set<string>) => void
}

export function MyMedsTab(_props: MyMedsTabProps) {
  return <p className="mono-label">My meds</p>
}
