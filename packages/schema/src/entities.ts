import { z } from 'zod'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const Slug = z.string().regex(SLUG, 'must be lowercase kebab-case')
export const InteractionId = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*--[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be "<food>--<drug>"')

export const SEVERITIES = ['avoid', 'caution', 'monitor', 'minimal'] as const
export const Severity = z.enum(SEVERITIES)
export type Severity = z.infer<typeof Severity>

export const FOOD_CATEGORIES = [
  'fruit',
  'vegetable',
  'dairy',
  'meat-fish',
  'grain',
  'beverage',
  'alcohol',
  'supplement',
  'other',
] as const

export const MECHANISM_KINDS = [
  'enzyme',
  'transporter',
  'pharmacodynamic',
  'absorption',
  'other',
] as const

const Text = z.string().trim().min(1)

export const Drug = z.strictObject({
  id: Slug,
  name: Text,
  aliases: z.array(Text).default([]),
  group: z.boolean().default(false),
  parent: Slug.optional(),
  drug_class: Text.optional(),
  rxnorm: z.string().regex(/^\d+$/).optional(),
})
export type Drug = z.infer<typeof Drug>

export const Food = z.strictObject({
  id: Slug,
  name: Text,
  aliases: z.array(Text).default([]),
  group: z.boolean().default(false),
  parent: Slug.optional(),
  category: z.enum(FOOD_CATEGORIES),
})
export type Food = z.infer<typeof Food>

export const Mechanism = z.strictObject({
  id: Slug,
  name: Text,
  kind: z.enum(MECHANISM_KINDS),
  explanation: Text,
})
export type Mechanism = z.infer<typeof Mechanism>

export const Citation = z.strictObject({
  type: z.enum(['label', 'review', 'study', 'guideline']),
  title: Text,
  url: z.url({ protocol: /^https?$/ }),
  pmid: z.string().regex(/^\d+$/).optional(),
  setid: z.string().optional(),
})
export type Citation = z.infer<typeof Citation>

export const Interaction = z.strictObject({
  id: InteractionId,
  food: Slug,
  drug: Slug,
  mechanisms: z.array(Slug).min(1),
  severity: Severity,
  effect: z.enum(['increases', 'decreases']),
  summary: Text,
  advice: Text,
  details: Text,
  example: z.strictObject({ patient: Text, pharmacist: Text }).optional(),
  citations: z.array(Citation).min(1),
  status: z.enum(['approved', 'pending', 'rejected']),
  source: z.enum(['curated', 'openfda']),
  reviewed_at: z.iso.date(),
})
export type Interaction = z.infer<typeof Interaction>
