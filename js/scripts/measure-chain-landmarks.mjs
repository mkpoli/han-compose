// Read a local snapshot of zi.tools /api/ids/zu/{chain}. Save only measured
// vertex proportions for drawings whose complete directed graph matches the IDS.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { solveChain } from '../src/stroke-chain.js'

const directory = process.argv[2]
const records = readdirSync(directory).filter(name => name.endsWith('.json'))
  .map(name => JSON.parse(readFileSync(join(directory, name))))
  .filter(row => row.reference?.kage)
const frequencies = new Map()
for (const { reference } of records) frequencies.set(reference.kage, (frequencies.get(reference.kage) ?? 0) + 1)

function segments(program) {
  const output = []
  for (const instruction of program.split('$')) {
    const [type, , , ...values] = instruction.split(':').map(Number)
    const a = values.slice(0, 2), b = values.slice(2, 4), c = values.slice(4, 6), d = values.slice(6, 8)
    // Types 2 and 6 are quadratic and cubic sweeps. Types 3, 4 and 7
    // contain an explicit turn. Component references require another drawing.
    if (type === 1) output.push([a, b])
    else if (type === 2) output.push([a, c])
    else if (type === 6) output.push([a, d])
    else if (type === 3 || type === 4) output.push([a, b], [b, c])
    else if (type === 7) output.push([a, b], [b, d])
    else return []
  }
  return output
}

function direction([a, b]) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  if (Math.abs(dy) < Math.abs(dx) * 0.19) return dx > 0 ? 'H' : 'L'
  if (Math.abs(dx) < Math.abs(dy) * 0.19) return dy > 0 ? 'S' : ''
  return dy > 0 ? (dx > 0 ? 'N' : 'P') : dx > 0 ? 'T' : ''
}

function measure(solved, lines) {
  const segments = solved.segments
  if (segments.length !== lines.length || segments.length < 3) return null
  const found = [], used = new Set(), matches = []
  function search(i) {
    if (matches.length > 1) return
    if (i === segments.length) {
      matches.push(found.map(line => line.slice()))
      return
    }
    const segment = segments[i]
    for (const [index, line] of lines.entries()) {
      if (used.has(index) || direction(line) !== segment.kind) continue
      // Reject ambiguous stroke programs, interior intersections implied as
      // joins, and any endpoint conflicting with an already placed vertex.
      const valid = found.every((other, j) => [segment.from, segment.to].every((v, k) =>
        [segments[j].from, segments[j].to].every((w, h) => {
          const gap = Math.hypot(line[k][0] - other[h][0], line[k][1] - other[h][1])
          return solved.points.find(v) === solved.points.find(w) ? gap <= 5 : gap > 3
        })))
      if (!valid) continue
      found.push(line)
      used.add(index)
      search(i + 1)
      used.delete(index)
      found.pop()
    }
  }
  search(0)
  if (matches.length !== 1) return null
  const points = []
  matches[0].forEach((line, i) => {
    points[segments[i].from] = line[0]
    points[segments[i].to] = line[1]
  })
  return points.flat()
}

const landmarks = {}
for (const { chain, reference } of records.sort((a, b) => a.chain < b.chain ? -1 : 1)) {
  if (frequencies.get(reference.kage) !== 1) continue
  const solved = solveChain(chain)
  if (!solved || solved.broken || solved.strokes.length < 2) continue
  const measured = measure(solved, segments(reference.kage))
  if (measured) landmarks[chain] = measured
}
console.log(JSON.stringify(landmarks, null, 0))
