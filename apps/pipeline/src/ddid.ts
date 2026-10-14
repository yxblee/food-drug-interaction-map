// DDID Interaction CSV reader. Only the pair (drug, food) and the PMID of the study are used (ADR 0004).

// RFC 4180: quoted fields may hold commas, newlines and "" quotes; rows end in LF or CRLF.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c !== '"') field += c
      else if (text[i + 1] === '"') field += text[i++]
      else quoted = false
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) rows.push([...row, field])
  return rows
}

export interface DdidRow {
  food: string
  drug: string
  pmid?: string // undefined when the row has no usable PMID
}

const GRADED = /^(harmful|negative)$/i
const PMID = /^\d{1,9}$/

// Rows graded harmful or negative whose food passes `isFood`; other foods are counted by name. The
// grade only filters; nothing else of the record is kept.
export function readDdid(text: string, isFood: (name: string) => boolean) {
  const [header, ...body] = parseCsv(text)
  const col = (name: string) => {
    const i = header.indexOf(name)
    if (i < 0) throw new Error(`DDID CSV has no ${name} column`)
    return i
  }
  const [effect, food, drug, pmid] = ['Effect', 'Food_Herb_Name', 'Drug_Name', 'PMID'].map(col)
  const records: DdidRow[] = []
  const unmatched = new Map<string, number>()
  let graded = 0
  for (const r of body) {
    if (!GRADED.test(r[effect] ?? '')) continue
    graded++
    const f = r[food]?.trim()
    const d = r[drug]?.trim()
    if (!f || !d) continue
    if (!isFood(f)) unmatched.set(f.toLowerCase(), (unmatched.get(f.toLowerCase()) ?? 0) + 1)
    else {
      const p = r[pmid]?.trim() ?? ''
      records.push({ food: f, drug: d, pmid: PMID.test(p) ? p : undefined })
    }
  }
  return { records, unmatched, rows: body.length, graded }
}
