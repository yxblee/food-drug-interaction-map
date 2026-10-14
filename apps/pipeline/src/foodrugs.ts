// Reads the text-mined tables of the FooDrugs MySQL dump (Zenodo 6638469, FinalFooDrugs_v4.sql).
// mysqldump writes one multi-row `INSERT INTO `t` VALUES (...),(...);` per line, strings quoted with '
// and escaped with a backslash. Only `TM_interactions` and `texts` are parsed; every other table
// (notably the gene-expression ones) is skipped untouched.

type Cell = string | number | null

const ESCAPES: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
  b: '\b',
  '0': '\0',
  Z: '\x1a',
  '%': '\\%', // MySQL keeps the backslash for these two
  _: '\\_',
}
const QUOTE_OR_BACKSLASH = /['\\]/g
const BARE = /[^,)]+/y

// Rows of one INSERT line for `table`, or undefined when the line is anything else.
export function parseInsert(line: string, table: string): Cell[][] | undefined {
  const head = `INSERT INTO \`${table}\` VALUES `
  if (!line.startsWith(head)) return undefined
  const rows: Cell[][] = []
  let i = head.length
  while (line[i] === '(') {
    i++
    const row: Cell[] = []
    for (;;) {
      if (line[i] === "'") {
        let s = ''
        i++
        for (;;) {
          QUOTE_OR_BACKSLASH.lastIndex = i
          const m = QUOTE_OR_BACKSLASH.exec(line)
          if (!m) throw new Error(`unterminated string in ${table} INSERT`)
          s += line.slice(i, m.index)
          i = m.index
          if (line[i] === '\\') {
            const c = line[i + 1]
            s += ESCAPES[c] ?? c
            i += 2
          } else if (line[i + 1] === "'") {
            s += "'" // '' is also an escaped quote
            i += 2
          } else {
            i++
            break
          }
        }
        row.push(s)
      } else {
        BARE.lastIndex = i
        const raw = BARE.exec(line)?.[0]
        if (raw === undefined) throw new Error(`bad value in ${table} INSERT at ${i}`)
        row.push(raw === 'NULL' ? null : Number(raw))
        i += raw.length
      }
      if (line[i++] === ')') break // otherwise a ',' between cells
    }
    rows.push(row)
    if (line[i] === ',') i++
  }
  return rows
}

export interface TextMined {
  textId: number
  food: string
  drug: string
}

const PUBMED = /^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)\/?$/

// One pass over the dump. Keeps the TM_interactions rows whose food passes `isFood`, counts the rest by
// name, and maps each text id to its PMID when the document is from PubMed (other sources are dropped).
export async function readFooDrugs(
  lines: AsyncIterable<string>,
  isFood: (name: string) => boolean,
) {
  const records: TextMined[] = []
  const unmatched = new Map<string, number>()
  const pmids = new Map<number, string>()
  for await (const line of lines) {
    for (const [, textId, , , food, drug] of parseInsert(line, 'TM_interactions') ?? []) {
      if (typeof food !== 'string' || typeof drug !== 'string') continue
      if (isFood(food)) records.push({ textId: Number(textId), food, drug })
      else unmatched.set(food.toLowerCase(), (unmatched.get(food.toLowerCase()) ?? 0) + 1)
    }
    for (const [textId, , link] of parseInsert(line, 'texts') ?? []) {
      const pmid = typeof link === 'string' ? PUBMED.exec(link)?.[1] : undefined
      if (pmid) pmids.set(Number(textId), pmid)
    }
  }
  return { records, unmatched, pmids }
}
