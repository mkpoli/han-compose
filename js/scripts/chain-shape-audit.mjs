// Read the five public compose() outputs from audit-recorded-chains.mjs. Compare
// the visible components and enclosed counters with the chain's endpoint graph.
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { drawingChain } from '../src/chain-corrections.js'
import { historicalChainGraph } from '../src/historical-chains.js'
import { fill, pathRings, EM_BOX } from '../src/geometry.js'
import { parseChain, solveChain } from '../src/stroke-chain.js'
import { spellings } from './recorded-chain-corpus.mjs'

const [directory, prefix, output] = process.argv.slice(2)
if (!output) throw Error('Usage: bun js/scripts/chain-shape-audit.mjs AUDIT_DIR PREFIX OUTPUT.json')
const rows = {}
const styles = ['sans', 'serif', 'fangsong', 'regular', 'pen-writing']

function expected(raw) {
  const key = drawingChain(raw)
  const solved = solveChain(key)
  const graph = historicalChainGraph(key)
  const { strokes } = parseChain(key)
  const ends = new Set(solved.segments.flatMap(s => [solved.points.find(s.from), solved.points.find(s.to)]))
  const crossings = graph?.crossings ?? strokes.flatMap((s, i) => s.cross === null ? [] : [[i, s.cross]])
  const roots = new Map([...ends].map(id => [id, id]))
  const root = id => roots.get(id) === id ? id : root(roots.get(id))
  const merge = (a, b) => roots.set(root(b), root(a))
  for (const edge of solved.segments) merge(solved.points.find(edge.from), solved.points.find(edge.to))
  for (const [i, j] of crossings) merge(solved.points.find(solved.strokes[i].at[0]), solved.points.find(solved.strokes[j].at[0]))
  const parts = new Set([...ends].map(root)).size
  // Subdividing both edges at a crossing contributes one additional cycle.
  // Euler's formula counts bounded faces in the resulting planar graph.
  const uniqueCrossings = new Set(crossings.map(([i, j]) => i < j ? `${i},${j}` : `${j},${i}`))
  return { components: parts, counters: solved.segments.length - ends.size + parts + uniqueCrossings.size }
}

function readingMask(large, size, samples) {
  const small = new Uint8Array(size * size)
  // Include a pixel with at least 15% ink so antialiased hairlines remain
  // connected at reading size. Sample the same 192px mask used for inspection.
  const minimum = Math.ceil(samples * samples * 0.15)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let coverage = 0
    for (let dy = 0; dy < samples; dy++) {
      const row = (y * samples + dy) * size * samples + x * samples
      for (let dx = 0; dx < samples; dx++) coverage += large[row + dx]
    }
    small[y * size + x] = Number(coverage >= minimum)
  }
  return small
}

function measure(mask, size) {
  const seen = new Uint8Array(mask.length)
  const areas = [[], []], todo = new Uint32Array(mask.length)
  for (let p = 0; p < mask.length; p++) {
    if (seen[p]) continue
    const value = mask[p]
    todo[0] = p
    seen[p] = 1
    let first = 0, last = 1, edge = false
    while (first < last) {
      const i = todo[first++], x = i % size, y = (i - x) / size
      if (x === 0 || y === 0 || x === size - 1 || y === size - 1) edge = true
      // A diagonal ink contact joins two pixels. A counter can leak through a
      // shared edge, so its background uses the complementary four neighbors.
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || (!value && dx && dy)) continue
        const nx = x + dx, ny = y + dy, j = i + dx + dy * size
        if (nx < 0 || nx >= size || ny < 0 || ny >= size || seen[j] || mask[j] !== value) continue
        seen[j] = 1
        todo[last++] = j
      }
    }
    if (value || !edge) areas[value].push(last)
  }
  // Ignore detached specks and pinholes smaller than about 0.055% of the em
  // square. Raster counts flag candidates for comparison with a source glyph.
  const threshold = Math.max(1, Math.round(size ** 2 / 1800))
  return {
    components: areas[1].filter(area => area >= threshold).length,
    counters: areas[0].filter(area => area >= threshold).length,
    ink: Number((areas[1].reduce((sum, area) => sum + area, 0) / size ** 2).toFixed(3)),
  }
}

for (const style of styles) {
  const drawings = JSON.parse(await readFile(join(directory, `${prefix}-${style}.json`), 'utf8'))
  const cache = new Map()
  for (const raw of spellings) {
    const data = drawings[raw]
    if (!rows[raw]) rows[raw] = { expected: expected(raw), faces: {} }
    if (!data?.path || !data.ok) {
      rows[raw].faces[style] = null
      continue
    }
    if (!cache.has(data.path)) {
      const large = fill(pathRings(data.path, 10), 192, EM_BOX)
      cache.set(data.path, { 32: measure(readingMask(large, 32, 6), 32), 192: measure(large, 192) })
    }
    rows[raw].faces[style] = cache.get(data.path)
  }
}
await writeFile(output, JSON.stringify(rows))
