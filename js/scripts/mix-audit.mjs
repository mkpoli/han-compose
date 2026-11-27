#!/usr/bin/env node
// Rank font mixes by how far their outline strays from the faces it mixes.
//
//   bun scripts/mix-audit.mjs [--cache drawings.json] [--sheet worst.svg] [--json rows.json] [--top 40]
//                             [--shares 0.3,0.5,0.7] [--src other/src] <sequence | @file>...
//
// Every sequence is composed in each face of examples/font-mixer/exports.json and mixed
// pairwise. A mix is measured against its two faces on four counts an eye would catch:
// wiggles in the outline the faces do not have (bumps, wobbles), turning the mix lost (blobs),
// islands and counters outside the range the faces span, and ink away from the share-weighted
// mean. `--cache` keeps the composed drawings between runs; `--src` measures the mixer of
// another checkout against the same drawings; `--json` writes every mix with its outline, for
// comparing two runs.
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = new URL('..', import.meta.url)
const args = process.argv.slice(2)
const option = (/** @type {string} */ name, /** @type {string} */ fallback) => {
  const at = args.indexOf(name)
  return at < 0 ? fallback : args.splice(at, 2)[1]
}
const cachePath = option('--cache', '')
const sheetPath = option('--sheet', '')
const jsonPath = option('--json', '')
const top = Number(option('--top', '40'))
const shares = option('--shares', '0.3,0.5,0.7').split(',').map(Number)
const src = option('--src', '')
const sequences = (
  await Promise.all(
    args.map(async (arg) =>
      arg.startsWith('@') ? (await readFile(arg.slice(1), 'utf8')).split(/\s+/) : [arg]
    )
  )
)
  .flat()
  .filter(Boolean)
if (!sequences.length) {
  console.error('usage: mix-audit.mjs [--cache file] [--sheet file.svg] [--top n] <sequence | @file>...')
  process.exit(2)
}

const { FONT_STYLES, activeFaces } = await import(new URL('src/font-mix.js', root).href)
const { compose, sketch, fromUrl } = await import(new URL('src/loader.js', root).href)
const { pathRings } = await import(new URL('src/geometry.js', root).href)
const { inkPolygons } = await import(new URL('src/mix-outline.js', root).href)
const mixer = src
  ? pathToFileURL(resolve(src, 'mix-drawings.js')).href
  : new URL('src/mix-drawings.js', root).href
const { mixDrawings } = await import(mixer)

/** @type {Record<string, Record<string, { drawing: any, leaves: any }>>} */
let drawings = {}
if (cachePath) drawings = JSON.parse(await readFile(cachePath, 'utf8').catch(() => '{}'))
const bases = JSON.parse(await readFile(new URL('examples/font-mixer/exports.json', root), 'utf8'))
let composed = 0
await Promise.all(
  FONT_STYLES.map(async (/** @type {string} */ style) => {
    const source = fromUrl(bases[style])
    drawings[style] ??= {}
    for (const sequence of sequences) {
      if (drawings[style][sequence]) continue
      const config = { separate: true, fontStyle: style }
      try {
        drawings[style][sequence] = {
          drawing: await compose(source, sequence, config),
          leaves: await sketch(source, sequence, config)
        }
        composed++
      } catch (error) {
        console.error(`${style} ${sequence}: ${String(error).slice(0, 100)}`)
      }
    }
  })
)
if (cachePath && composed) await writeFile(cachePath, JSON.stringify(drawings))

/** Islands, counters, ink, and how much the outline turns when walked in even steps.
 * @param {string} d */
function measure(d) {
  const polygons = inkPolygons(pathRings(d, 12))
  let counters = 0,
    ink = 0,
    turning = 0
  /** Where the outline wiggles. @type {number[][]} */
  const wiggles = []
  for (const island of polygons)
    for (const [k, ring] of island.entries()) {
      if (k) counters++
      let twice = 0
      for (let i = 0; i + 1 < ring.length; i++)
        twice += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
      ink += (k ? -1 : 1) * Math.abs(twice / 2)
      // Even steps of 6 units: finer detail than a stroke's edge can carry is not counted.
      const step = 6
      /** @type {number[][]} */
      const walked = []
      let left = 0
      for (let i = 0; i + 1 < ring.length; i++) {
        const [ax, ay] = ring[i],
          [bx, by] = ring[i + 1]
        const length = Math.hypot(bx - ax, by - ay)
        let at = left
        for (; at < length; at += step)
          walked.push([ax + ((bx - ax) * at) / length, ay + ((by - ay) * at) / length])
        left = at - length
      }
      if (walked.length < 4) {
        turning += 2 * Math.PI
        continue
      }
      /** @type {number[]} */
      const turns = []
      for (let i = 0; i < walked.length; i++) {
        const a = walked[i],
          b = walked[(i + 1) % walked.length],
          c = walked[(i + 2) % walked.length]
        const ux = b[0] - a[0],
          uy = b[1] - a[1],
          vx = c[0] - b[0],
          vy = c[1] - b[1]
        turns.push(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy))
      }
      for (const angle of turns) turning += Math.abs(angle)
      // A wiggle is a short run that turns one way and back: over 48 units it turns far
      // more in all than it ends up turned. A corner or a stroke's end turns one way only.
      const span = 8
      // Every window of the ring is tried, and windows that hit within a span of each other
      // are one wiggle, so the count does not depend on where the ring starts.
      const n = turns.length
      if (n < 2 * span) continue
      const hit = turns.map((_, i) => {
        let net = 0,
          gross = 0
        for (let k = 0; k < span; k++) {
          net += turns[(i + k) % n]
          gross += Math.abs(turns[(i + k) % n])
        }
        return gross - Math.abs(net) > 1.2
      })
      const near = hit.map((_, i) => {
        for (let k = 0; k < span; k++) if (hit[(i - k + n) % n]) return true
        return false
      })
      const starts = near.flatMap((on, i) => (on && !near[(i - 1 + n) % n] ? [i] : []))
      if (!starts.length && near[0]) starts.push(0)
      for (const i of starts) wiggles.push(walked[(i + span / 2) % n])
    }
  return { islands: polygons.length, counters, ink, turning, wiggles }
}

const outside = (/** @type {number} */ v, /** @type {number} */ a, /** @type {number} */ b) =>
  Math.max(0, Math.min(a, b) - v, v - Math.max(a, b))
const pathOf = (/** @type {any} */ drawing) => drawing.d
const turn = 2 * Math.PI

/** @type {{ sequence: string, a: string, b: string, share: number, score: number, bumps: number, lost: number, islands: number, counters: number, ink: number, d: string, marks: number[][] }[]} */
const rows = []
/** @type {Map<string, ReturnType<typeof measure>>} */
const faces = new Map()
/** Sequences left out. @type {Set<string>} */
const skipped = new Set()
for (const sequence of sequences)
  for (const [i, a] of FONT_STYLES.entries())
    for (const b of FONT_STYLES.slice(i + 1)) {
      const pair = [a, b].map((style) => drawings[style]?.[sequence])
      if (pair.some((entry) => !entry)) continue
      // A subtraction mask takes ink away; these measures only add outlines up.
      if (pair.some((entry) => entry.drawing.cut)) {
        skipped.add(sequence)
        continue
      }
      const [ma, mb] = [a, b].map((style, k) => {
        const key = `${style} ${sequence}`
        if (!faces.has(key)) faces.set(key, measure(pathOf(pair[k].drawing)))
        return /** @type {ReturnType<typeof measure>} */ (faces.get(key))
      })
      if (!ma.ink || !mb.ink) {
        skipped.add(sequence)
        continue
      }
      for (const share of shares) {
        const active = activeFaces({ shares: { [a]: 1 - share, [b]: share }, weight: 1 })
        const used = active.map((/** @type {{ style: string }} */ face) => drawings[face.style][sequence])
        let d = ''
        try {
          d = pathOf(
            mixDrawings(
              used.map((entry) => entry.drawing),
              active.map((/** @type {{ share: number }} */ face) => face.share),
              1,
              used.map((entry) => entry.leaves)
            )
          )
        } catch (error) {
          console.error(`${sequence} ${a}/${b} ${share}: ${String(error).slice(0, 100)}`)
          continue
        }
        const m = measure(d)
        const bumps = Math.max(0, m.wiggles.length - Math.max(ma.wiggles.length, mb.wiggles.length))
        const lost = Math.max(0, Math.min(ma.turning, mb.turning) - m.turning) / turn
        const islands = outside(m.islands, ma.islands, mb.islands)
        const counters = outside(m.counters, ma.counters, mb.counters)
        const ink = m.ink / ((1 - share) * ma.ink + share * mb.ink) - 1
        const score = bumps + lost / 2 + islands + 2 * counters + 20 * Math.max(0, Math.abs(ink) - 0.06)
        rows.push({ sequence, a, b, share, score, bumps, lost, islands, counters, ink, d, marks: m.wiggles })
      }
    }

rows.sort((p, q) => q.score - p.score)
if (jsonPath) await writeFile(jsonPath, JSON.stringify(rows))
// One line per sequence and pair, at its worst share.
const seen = new Set()
const worst = rows.filter((row) => {
  const key = `${row.sequence} ${row.a} ${row.b}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})
const total = rows.reduce((sum, row) => sum + row.score, 0)
console.log(
  `${rows.length} mixes, total score ${total.toFixed(1)}, ${rows.filter((row) => row.score >= 1).length} at 1 or more`
)
if (skipped.size) console.log(`left out (subtraction mask or an empty face): ${[...skipped].join(' ')}`)
console.log('score  bumps  lost  isl  ctr   ink   share  mix')
for (const row of worst.slice(0, top))
  console.log(
    [
      row.score.toFixed(2).padStart(5),
      String(row.bumps).padStart(6),
      row.lost.toFixed(2).padStart(5),
      String(row.islands).padStart(4),
      String(row.counters).padStart(4),
      ((row.ink >= 0 ? '+' : '') + (100 * row.ink).toFixed(0) + '%').padStart(6),
      row.share.toFixed(2).padStart(6),
      ` ${row.sequence} ${row.a}/${row.b}`
    ].join(' ')
  )

if (sheetPath) {
  const cell = 220,
    columns = 4,
    shown = worst.slice(0, top)
  const glyph = (
    /** @type {string} */ d,
    /** @type {number} */ x,
    /** @type {number} */ y,
    /** @type {number} */ size,
    /** @type {number[][]} */ marks = []
  ) =>
    `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 1000 1000"><path d="${d}" fill="#111"/>` +
    marks
      .map(
        ([cx, cy]) =>
          `<circle cx="${cx.toFixed(0)}" cy="${(880 - cy).toFixed(0)}" r="34" fill="none" stroke="#e0245e" stroke-width="7"/>`
      )
      .join('') +
    '</svg>'
  const body = shown
    .map((row, n) => {
      const x = (n % columns) * (cell * 1.6),
        y = Math.floor(n / columns) * (cell + 24)
      return (
        `<text x="${x + 4}" y="${y + 14}" font-family="sans-serif" font-size="12" fill="#b3261e">` +
        `${row.score.toFixed(1)} ${row.sequence} ${row.a}/${row.b} ${row.share}</text>` +
        glyph(row.d, x, y + 18, cell, row.marks) +
        glyph(pathOf(drawings[row.a][row.sequence].drawing), x + cell, y + 18, cell * 0.3) +
        glyph(pathOf(drawings[row.b][row.sequence].drawing), x + cell, y + 18 + cell * 0.5, cell * 0.3)
      )
    })
    .join('')
  const height = Math.ceil(shown.length / columns) * (cell + 24)
  await writeFile(
    sheetPath,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${columns * cell * 1.6}" height="${height}">` +
      `<rect width="100%" height="100%" fill="#fff"/>${body}</svg>`
  )
}
