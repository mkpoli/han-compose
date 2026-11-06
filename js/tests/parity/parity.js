// The browser engine against han-compose's own drawings, from one export: `export-web OUT --parity N
// --held-out M` writes `parity.json`, a set whose hosts the export holds, and
// `parity-held-out.json`, a set it does not. Each row is drawn again here from the same export, both
// drawings rasterised at the size the file names (96 px) and compared by IoU.
//
//   bun tests/parity/run.js EXPORT_FOLDER [--worst N]     # the exported export, run now
//
// `tests/parity.test.js` runs it under `bun test` when `COMPOSER_EXPORT` names a folder.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compose, createSource } from '../../src/loader.js'

/** Mean agreement below which the engine has drifted from the composer. */
export const FLOOR = 0.95

/** The one set the floor gates: the sequences the composer never saw while it was tuned. */
export const GATED = 'parity-held-out.json'

/** The parity sets an export holds, in the order to run them. */
export const paritySets = folder => ['parity-held-out.json', 'parity.json'].filter(name => existsSync(join(folder, name)))

/** A source over the export's files as a static host serves them: a missing shard is empty. */
export const exportSource = folder => createSource(async name => {
  const file = join(folder, name)
  if (!existsSync(file)) return null
  const bytes = readFileSync(file)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
})

/**
 * Every row of a parity set drawn again, with `{ c, s, score, python, engine, error }`: the character,
 * the sequence, the overlap of the two drawings, and where each put its parts. `limit` draws only
 * the first rows.
 * @param {ReturnType<typeof exportSource>} source
 * @param {{ size: number, rows: any[] }} parity
 * @param {{ limit?: number, iou: (a: string, b: string, size: number) => number }} drawing
 */
export async function measure(source, parity, { limit, iou }) {
  const rows = parity.rows.filter(row => row.d).slice(0, limit || undefined)
  // An export's own face decides what the engine may draw: the rows are drawn in it.
  await source.ready()
  const fontStyle = source.manifest.style
  const scores = []
  for (const row of rows) {
    let score = 0, engine = [], error = null
    try {
      const drawn = await compose(source, row.s, { exclude: row.x, face: row.face ?? null, fontStyle })
      engine = drawn.origins
      score = iou(drawn.d, row.d, parity.size)
    } catch (failure) { error = String(failure.message ?? failure) }
    scores.push({ c: row.c, s: row.s, score, python: row.origins, engine, error })
  }
  return scores
}

/** The one-line summary every run prints. */
export const summary = (name, scores) => {
  const mean = scores.reduce((sum, row) => sum + row.score, 0) / scores.length
  return `${name}: ${scores.length} sequences, mean IoU ${mean.toFixed(4)}, `
    + `${scores.filter(row => row.score >= 0.99).length} at ≥ 0.99, ${scores.filter(row => row.score < 0.9).length} below 0.9`
}
