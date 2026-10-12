import { exportStatic } from '../src/exportStatic.ts'
import { loadStore } from '../src/store.ts'

const [db = 'dist/data.db', out = 'apps/web/public'] = process.argv.slice(2)

exportStatic(loadStore(db), out)
console.log(`Exported static API to ${out}/api`)
