#!/usr/bin/env bun
// Draw every parity row of an export again and compare it with the drawing the Python composer made.
//
//   bun tests/parity/run.js EXPORT_FOLDER [--worst N]
//
// Prints each set's mean IoU and the N rows (25 unless told) that agree least; exits 1 when the
// held-out set falls below the floor.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { iou, pathMask } from '../../src/geometry.js'
import { FLOOR, exportSource, measure, paritySets, summary } from './parity.js'

const arg = name => { const at = process.argv.indexOf(name); return at >= 0 ? process.argv[at + 1] : undefined }
const folder = process.argv[2]
const worst = Number(arg('--worst')) || 25
if (!folder || folder.startsWith('--')) {
  console.error('usage: bun tests/parity/run.js EXPORT_FOLDER [--worst N]')
  process.exit(2)
}
const sets = paritySets(folder)
if (!sets.length) {
  console.error(`${folder} holds no parity.json; write one with export-web --parity N --held-out M`)
  process.exit(2)
}
const source = exportSource(folder)
for (const [k, name] of sets.entries()) {
  const parity = JSON.parse(readFileSync(join(folder, name), 'utf8'))
  const scores = await measure(source, parity, { iou: (a, b, size) => iou(pathMask(a, size), pathMask(b, size)) })
  const mean = scores.reduce((sum, row) => sum + row.score, 0) / scores.length
  console.log(summary(name, scores))
  for (const row of scores.slice().sort((a, b) => a.score - b.score).slice(0, worst)) {
    console.log(`  ${row.score.toFixed(3)} ${row.c} ${row.s}  python: ${row.python.join(', ')}  engine: ${row.error ?? row.engine.join(', ')}`)
  }
  if (!k && mean < FLOOR) process.exitCode = 1
}
