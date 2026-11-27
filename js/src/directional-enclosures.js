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
    const frame = bounds([outer])
    const siblings = parts.filter(p => p !== outer && p !== inner && !p.cut && p.empty === undefined)
    if (['glyph 百', 'cells 百'].includes(inner.origin) && refineBai(composer, outer, inner, siblings, footprint)) continue
    if (composer.collide([outer], [inner], footprint, 256) < 0.01) continue
    let target = hookSeat(composer, inner, [outer, ...siblings], footprint, frame, [1, 0.975, 0.95])
    if (!target && composer.fontStyle === 'fangsong' && ['glyph 百', 'cells 百'].includes(inner.origin)) {
      const hook = baiReference(composer, outer, frame)?.hook
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

function hookSeat(composer, inner, obstacles, footprint, frame, scales, aim = null, margin = 1) {
  const body = bounds([inner]), n = 160
  const sx = (footprint[2] - footprint[0]) / n, sy = (footprint[3] - footprint[1]) / n
  // Grow the hook and adjacent ink before testing each candidate position.
  const blocked = grown(fill(groupRings(obstacles), n, footprint), n, margin)
  const reach = aim ? 32 : 16
  const candidates = []
  for (const scale of scales) {
    const seat = shrunk(body, scale)
    const probe = { ...inner, target: mapped(inner.target, body, seat) }
    const mask = fill(groupRings([probe]), n, footprint)
    const ink = []
    mask.forEach((value, index) => { if (value) ink.push(index) })
    for (let x = -reach; x <= reach; x++) for (let y = -reach; y <= reach; y++) {
      const dx = x * sx, dy = y * sy
      const shifted = [seat[0] + dx, seat[1] + dy, seat[2] + dx, seat[3] + dy]
      const moved = union([frame, shifted])
      if (moved.some((edge, j) => Math.abs(edge - footprint[j]) > 0.1)) continue
      const shrink = (aim ? 1.1 : 2) * (1 - scale) * Math.max(body[2] - body[0], body[3] - body[1])
      const ax = aim ? (shifted[0] + shifted[2]) / 2 - aim[0] : dx
      const ay = aim ? (shifted[1] + shifted[3]) / 2 - aim[1] : dy
      candidates.push({ score: ax * ax + ay * ay + shrink * shrink, offset: x - n * y, ink, shifted })
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

// 匍 encloses a wide, upright 甫; 訇 provides the corresponding Fangsong
// reference. The open left edge and the upturned terminal constrain 百's bar.
function refineBai(composer, outer, inner, siblings, footprint) {
  const style = composer.fontStyle
  const frame = style === 'regular' ? footprint : bounds([outer])
  const body = bounds([inner]), [l, b, r, t] = frame
  const cx = (body[0] + body[2]) / 2, cy = (body[1] + body[3]) / 2
  const near = grown(fill(groupRings([outer]), 160, footprint), 160, 4)
  const cramped = fill(groupRings([inner]), 160, footprint).some((v, i) => v && near[i])
  if (!cramped && !(style === 'regular' && cx < l + 0.38 * (r - l)) &&
      !(style === 'fangsong' && cy < b + 0.37 * (t - b))) return false
  const reference = baiReference(composer, outer, frame)
  if (!reference) return false
  const { hook, aim } = reference
  // TW-Kai 匂 has the rightmost inner centre among the ten native 勹 references.
  if (style === 'regular') aim[0] = l + 0.4159 * (r - l)
  // Lift Kureedo's body away from the return at the foot of 勹.
  if (style === 'pen-writing') aim[1] += 0.035 * (t - b)
  if (siblings.length && composer.collide(siblings, [hook], footprint, 256) > 0) return false
  const scales = style === 'fangsong' ? [1, 0.975, 0.95] : [1, 0.975, 0.95, 0.925, 0.90]
  const target = hookSeat(composer, inner, [hook, ...siblings], footprint, frame, scales, aim,
    style === 'fangsong' ? 4 : 7)
  if (!target) return false
  Object.assign(outer, hook, { clearedHook: true })
  Object.assign(inner, { target, clearedHook: true })
  return true
}

// These outline masters and their labeled contour sets are the five cuts whose
// clearance and optical positions were measured for 百.
const baiHooks = new Map([
  ['sans', ['37d0cc42699c5db8c2fb7e5664e863c486173ec98770caf738bd41bfa5c0764b', [0, 4, 5]]],
  ['serif', ['ad632123fd975f0833d2c98930d97bef0bb4e2a6afccfe1561e7046c5621c5d7', [7, 8, 9]]],
  ['fangsong', ['c838b0fe144da47c0842495746e9bd37c93911df1586a6a792ef825ce73e04ac', [0]]],
  ['regular', ['ad669b23065a2cba3e91abe492bb953772eddefe45d14ef4ef2cceda26c80a51', [4]]],
  ['pen-writing', ['3c59efb4ca6cb568b309a43c1ebb67567617b68db01363333583e8fdaa4ad998', [0]]],
])

function baiReference(composer, outer, frame) {
  const fang = composer.fontStyle === 'fangsong', host = fang ? '訇' : '匍'
  const verified = baiHooks.get(composer.fontStyle)
  if (!verified || [host, fang ? '言' : '甫'].some(ch => composer.excluded(ch) || composer.forced(ch))) return null
  const [digest, indices] = verified, record = composer.glyphRecord(host)
  if (record?.v !== 1 || hexOf(JSON.stringify(record.p)) !== digest) return null
  // Fangsong leaves 訇 unlabelled. The other exports also label 勹 and 甫.
  const held = record.p.map((_, i) => i).filter(i => !indices.includes(i))
  if (!fang && ![[indices, record.ls?.勹], [held, record.ls?.甫]]
    .every(([expected, actual]) => actual?.length === expected.length && expected.every(i => actual.includes(i)))) return null
  const glyph = partOf(record), cut = cutContours(glyph, indices), content = cutContours(glyph, held)
  const native = placed(cut, cut.box, cut.box, outer.native, `host ${host}`, outer.weight)
  const reference = placed(content, content.box, content.box, outer.native, '', outer.weight)
  const source = bounds([native]), seat = mapped(bounds([reference]), source, frame)
  return { hook: { ...outer, ...native, source, target: frame },
    aim: [(seat[0] + seat[2]) / 2, (seat[1] + seat[3]) / 2] }
}
