// @ts-nocheck
import { hexOf } from './sha256.js'
import { cutContours, fill, groupRings, grown, mapped, partOf, placed, pointsBox, shrunk, union } from './geometry.js'

const bodies = new Set(['白', '百', '首'])
export const checkedHook = node => Array.isArray(node) && !node.note && node[0] === '⿹' && node[1] === '勹' && bodies.has(node[2])

// Keep the two editable operands identifiable through their parent's spacing
// and weight passes, which can create or remove contact with the hook.
export function markHook(composer, node, parts) {
  if (!checkedHook(node) || parts.length !== 2 || !['glyph ' + node[2], 'cells ' + node[2]].includes(parts[1].origin)) return
  const key = node.join(''), encoded = composer.bySequence(key)
  if (composer.spelled.has(key) || (encoded && (composer.glyph(encoded) || composer.excluded(encoded))) ||
      [key, ...node.slice(1)].some(ch => composer.excluded(ch) || composer.forced(ch))) return
  const group = Symbol()
  for (const p of parts) p.hookPair = group
}

const bounds = parts => union(groupRings(parts, 32).map(pointsBox))

export function clearHookContacts(composer, parts) {
  if (composer.partial) return
  for (let i = 1; i < parts.length; i++) {
    const inner = parts[i], outer = parts[i - 1]
    if (!inner.hookPair || inner.hookPair !== outer.hookPair || inner.flips || outer.flips || inner.cut || outer.cut) continue
    const pair = [outer, inner], footprint = bounds(pair)
    if (composer.collide([outer], [inner], footprint, 256) < 0.01) continue
    const frame = bounds([outer])
    const siblings = parts.filter(p => p !== outer && p !== inner && !p.cut && p.empty === undefined)
    let target = hookSeat(composer, inner, [outer, ...siblings], footprint, frame, [1, 0.975, 0.95])
    if (!target && composer.fontStyle === 'fangsong' && ['glyph 百', 'cells 百'].includes(inner.origin)) {
      const hook = fangsongHook(composer, outer, frame)
      if (hook && (!siblings.length || composer.collide(siblings, [hook], footprint, 256) === 0)) {
        target = hookSeat(composer, inner, [hook, ...siblings], footprint, frame, [1])
        if (target) Object.assign(outer, hook, { clearedHook: true })
      }
    }
    if (target) {
      inner.target = target
      inner.clearedHook = true
    }
  }
}

function hookSeat(composer, inner, obstacles, footprint, frame, scales) {
  const body = bounds([inner]), n = 160
  const sx = (footprint[2] - footprint[0]) / n, sy = (footprint[3] - footprint[1]) / n
  // Count the hook and all adjacent ink as obstacles. One pixel of margin
  // gives roughly six font units of clearance in a full-size character.
  const blocked = grown(fill(groupRings(obstacles), n, footprint), n, 1)
  const candidates = []
  for (const scale of scales) {
    const seat = shrunk(body, scale)
    const probe = { ...inner, target: mapped(inner.target, body, seat) }
    const mask = fill(groupRings([probe]), n, footprint)
    const ink = []
    mask.forEach((value, index) => { if (value) ink.push(index) })
    for (let x = -16; x <= 16; x++) for (let y = -16; y <= 16; y++) {
      const dx = x * sx, dy = y * sy
      const shifted = [seat[0] + dx, seat[1] + dy, seat[2] + dx, seat[3] + dy]
      const moved = union([frame, shifted])
      if (moved.some((edge, j) => Math.abs(edge - footprint[j]) > 0.1)) continue
      const shrink = 2 * (1 - scale) * Math.max(body[2] - body[0], body[3] - body[1])
      candidates.push({ score: dx * dx + dy * dy + shrink * shrink, offset: x - n * y, ink, shifted })
    }
  }
  candidates.sort((a, b) => a.score - b.score)
  for (const candidate of candidates) {
    if (candidate.ink.some(index => blocked[index + candidate.offset])) continue
    const probe = { ...inner, target: mapped(inner.target, body, candidate.shifted) }
    if (composer.collide(obstacles, [probe], footprint, 256) > 0) continue
    return probe.target
  }
  return null
}

// 訇 encloses the long header of 言. This export merges the arm and terminal
// of 勹 into its first contour; the other six belong to 言.
function fangsongHook(composer, outer, frame) {
  if (composer.excluded('訇') || composer.forced('訇')) return null
  const record = composer.glyphRecord('訇')
  if (record?.v !== 1 || hexOf(JSON.stringify(record.p)) !==
      'c838b0fe144da47c0842495746e9bd37c93911df1586a6a792ef825ce73e04ac') return null
  const glyph = partOf(record), cut = cutContours(glyph, [0])
  const native = placed(cut, cut.box, cut.box, outer.native, 'host 訇', outer.weight)
  return { ...outer, ...native, source: bounds([native]), target: frame }
}
