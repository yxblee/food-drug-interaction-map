import { buildDb } from '../src/db/build.ts'

const [dataDir = 'data', out = 'dist/data.db'] = process.argv.slice(2)

try {
  const r = buildDb(dataDir, out)
  if ('errors' in r) {
    console.error(`Data validation failed (${r.errors.length} errors):`)
    for (const e of r.errors) console.error(`  - ${e}`)
    process.exit(1)
  }
  console.log(`Built ${out} (data version ${r.version})`)
} catch (e) {
  console.error((e as Error).message)
  process.exit(1)
}
