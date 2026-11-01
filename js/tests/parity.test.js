// The engine against han-compose's own drawings. `COMPOSER_EXPORT` names a folder `export-web
// --parity N --held-out M` wrote; without it this runs nothing. The held-out set gates: the engine
// must agree with the Python composer to `FLOOR` on it.
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { iou, pathMask } from '../src/geometry.js'
import { FLOOR, exportSource, measure, paritySets, summary } from './parity/parity.js'

const folder = process.env.COMPOSER_EXPORT
const sets = folder ? paritySets(folder) : []
if (!folder) console.log('parity skipped: set COMPOSER_EXPORT to a han-compose export-web folder')

describe.skipIf(!sets.length)('the engine and the Python composer', () => {
  const source = exportSource(folder ?? '')
  for (const [k, name] of sets.entries()) {
    it(`draws ${name} as the Python composer does${k ? '' : ` (mean IoU ≥ ${FLOOR})`}`, async () => {
      const parity = JSON.parse(readFileSync(join(folder ?? '', name), 'utf8'))
      const scores = await measure(source, parity, {
        limit: Number(process.env.COMPOSER_PARITY_LIMIT) || undefined,
        iou: (a, b, size) => iou(pathMask(a, size), pathMask(b, size)),
      })
      const mean = scores.reduce((sum, row) => sum + row.score, 0) / scores.length
      console.log(summary(name, scores))
      for (const row of scores.slice().sort((a, b) => a.score - b.score).slice(0, Number(process.env.COMPOSER_PARITY_WORST) || 25)) {
        console.log(`  ${row.score.toFixed(3)} ${row.c} ${row.s}  python: ${row.python.join(', ')}  engine: ${row.error ?? row.engine.join(', ')}`)
      }
      if (!k) expect(mean).toBeGreaterThanOrEqual(FLOOR)
    }, 900_000)
  }
})
