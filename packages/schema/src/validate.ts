import type { z } from 'zod'
import { Drug, Food, Interaction, Mechanism } from './entities.ts'

export interface RawFile {
  file: string
  data: unknown
}
export interface RawDataset {
  drugs: RawFile[]
  foods: RawFile[]
  mechanisms: RawFile[]
  interactions: RawFile[]
}
export interface Dataset {
  drugs: Drug[]
  foods: Food[]
  mechanisms: Mechanism[]
  interactions: Interaction[]
}
export type ValidationResult = { dataset: Dataset } | { errors: string[] }

const stem = (file: string) => file.replace(/^.*\//, '').replace(/\.ya?ml$/, '')

interface Hierarchical {
  id: string
  name: string
  aliases: string[]
  group: boolean
  parent?: string
}

export function validateDataset(raw: RawDataset): ValidationResult {
  const errors: string[] = []
  const fileOf = new WeakMap<object, string>()

  function parseAll<T extends { id: string }>(files: RawFile[], schema: z.ZodType<T>): T[] {
    const out: T[] = []
    const seen = new Set<string>()
    for (const { file, data } of files) {
      const r = schema.safeParse(data)
      if (!r.success) {
        for (const issue of r.error.issues) {
          errors.push(`${file}: ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        }
        continue
      }
      if (r.data.id !== stem(file))
        errors.push(`${file}: id "${r.data.id}" does not match filename`)
      if (seen.has(r.data.id)) errors.push(`${file}: duplicate id "${r.data.id}"`)
      seen.add(r.data.id)
      fileOf.set(r.data, file)
      out.push(r.data)
    }
    return out
  }

  function checkHierarchy(items: Hierarchical[]) {
    const byId = new Map(items.map((i) => [i.id, i]))
    for (const i of items) {
      if (!i.parent) continue
      const file = fileOf.get(i)
      if (i.group) errors.push(`${file}: parent: a group cannot have a parent`)
      const p = byId.get(i.parent)
      if (!p) errors.push(`${file}: parent: unknown parent "${i.parent}"`)
      else if (!p.group) errors.push(`${file}: parent: "${i.parent}" is not a group`)
    }
  }

  function checkAliases(items: Hierarchical[]) {
    const owner = new Map<string, string>()
    for (const i of items) {
      for (const term of new Set([i.name, ...i.aliases].map((t) => t.toLowerCase()))) {
        const prev = owner.get(term)
        if (prev && prev !== i.id) {
          errors.push(`${fileOf.get(i)}: name/aliases: "${term}" already used by ${prev}`)
        } else owner.set(term, i.id)
      }
    }
  }

  const drugs = parseAll(raw.drugs, Drug)
  const foods = parseAll(raw.foods, Food)
  const mechanisms = parseAll(raw.mechanisms, Mechanism)
  const interactions = parseAll(raw.interactions, Interaction)

  checkHierarchy(drugs)
  checkHierarchy(foods)
  checkAliases(drugs)
  checkAliases(foods)

  const drugIds = new Set(drugs.map((d) => d.id))
  const foodIds = new Set(foods.map((f) => f.id))
  const mechanismIds = new Set(mechanisms.map((m) => m.id))
  for (const i of interactions) {
    const file = fileOf.get(i)
    const expected = `${i.food}--${i.drug}`
    if (i.id !== expected) errors.push(`${file}: id: must be "${expected}"`)
    if (!foodIds.has(i.food)) errors.push(`${file}: food: unknown food "${i.food}"`)
    if (!drugIds.has(i.drug)) errors.push(`${file}: drug: unknown drug "${i.drug}"`)
    for (const m of i.mechanisms) {
      if (!mechanismIds.has(m)) errors.push(`${file}: mechanisms: unknown mechanism "${m}"`)
    }
  }

  return errors.length ? { errors } : { dataset: { drugs, foods, mechanisms, interactions } }
}
