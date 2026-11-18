import type { Citation, Drug, Food, Interaction, Mechanism } from './entities.ts'

export type Kind = 'drug' | 'food' | 'mechanism'

export interface GraphNode {
  kind: Kind
  id: string
  name: string
  aliases: string[]
  group: boolean
  parent?: string
}

export type GraphInteraction = Pick<
  Interaction,
  'id' | 'food' | 'drug' | 'mechanisms' | 'severity' | 'effect' | 'summary' | 'advice'
>

/** Facts about the Dataset itself, derived from its Approved Interactions at build time. */
export interface DatasetStats {
  /** Most recent `reviewed_at` (ISO date), or null when none is recorded. */
  reviewedAt: string | null
  /** Distinct Citation types used, in schema order. */
  citationTypes: Citation['type'][]
}

export interface GraphPayload {
  version: string
  stats: DatasetStats
  nodes: GraphNode[]
  interactions: GraphInteraction[]
}

export interface SearchResult {
  kind: Kind
  id: string
  name: string
  matched: string
  group: boolean
}

export interface ResolvedInteraction<I extends GraphInteraction = GraphInteraction> {
  interaction: I
  inheritedFrom?: string
}

export interface NodeDetail {
  node: GraphNode
  entity: Drug | Food | Mechanism
  parent: GraphNode | null
  children: GraphNode[]
  interactions: ResolvedInteraction<Interaction>[]
  mechanisms: Record<string, Mechanism>
  nodes: Record<string, GraphNode>
}
