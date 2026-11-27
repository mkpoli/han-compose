// @ts-nocheck
import { directionalDonorCut } from './directional-donor-cuts.js'
import { crossings, derived, fill, fitted, groupRings, grown, mapped, partOf, placed, pointsBox, shrunk, union } from './geometry.js'

// Each reference encloses a rectangular body in this orientation. A face
// supplies its own outline and the contour labels for both components.
const references = new Map([
  ['⿵門', [['間', '日']]],
  ['⿹勹', [['旬', '日'], ['甸', '田'], ['匈', '凶']]],
  ['⿸广', [['庙', '由']]],
  ['⿸尸', [['届', '由']]],
  ['⿷匚', [['匣', '甲']]],
  ['⿴囗', [['固', '古'], ['回', '口']]],
])
const boxed = new Set('口日目自白百田由首')

export function directionalReferences(node) {
  if (!Array.isArray(node) || node.note || !boxed.has(node[2])) return null
  return typeof node[1] === 'string' ? references.get(node[0] + node[1]) : null
}

function nativeParts(record, outer, inner, host) {
  if (record?.v !== 1) return null
  let frame = record.ls?.[outer], content = record.ls?.[inner]
  if (!frame?.length || !content?.length || frame.length + content.length !== record.p.length ||
      !record.p.every((_, i) => frame.includes(i) !== content.includes(i))) {
    const cut = directionalDonorCut(record, host)
    if (!cut) return null
    frame = cut.frame
    content = cut.contents
  }
  const glyph = partOf(record)
  return [derived(glyph, frame.map(i => glyph.contours[i])), derived(glyph, content.map(i => glyph.contours[i]))]
}

// Measure upright and level strokes away from terminal flares and intersections.
function stemWidths(part) {
  const rings = groupRings([part], 12), box = union(rings.map(pointsBox))
  return [0, 1].map(axis => {
    const lengths = [], across = 1 - axis
    for (const at of [0.26, 0.35, 0.43, 0.57, 0.65, 0.74]) {
      const edges = crossings(rings, across, box[across] + at * (box[across + 2] - box[across]))
      for (let i = 1; i < edges.length; i += 2) {
        const length = edges[i] - edges[i - 1]
        if (length > 0 && length < (box[axis + 2] - box[axis]) / 3) lengths.push(length)
      }
    }
    lengths.sort((a, b) => a - b)
    return lengths[Math.floor(lengths.length / 2)]
  })
}

function matchStems(content, reference) {
  const native = stemWidths(placed(reference, reference.box, reference.box, 0, ''))
  const light = stemWidths(content), heavy = stemWidths({ ...content, weight: [1, 1] })
  return light.map((width, axis) => {
    const delta = heavy[axis] - width
    if (!(native[axis] > width) || !Number.isFinite(delta) || Math.abs(delta) < 1) return 0
    return Math.max(-0.8, Math.min(1, (native[axis] - width) / delta))
  })
}

export function directionalParts(composer, node, region, atRoot, cells = false) {
  const donors = directionalReferences(node)
  if (!donors || composer.measuringEnclosureInk) return null
  const [op, outer, inner] = node, sequence = op + outer + inner
  if (composer.bySequence(sequence) || composer.spelled.has(sequence) || donors.some(([, ch]) => ch === inner) ||
      [outer, inner, sequence].some(ch => composer.excluded(ch) || composer.forced(ch)) || !composer.own(inner)) return null
  const glyph = composer.glyph(inner)
  const ink = union(glyph.contours.map(c => pointsBox(c.light)))
  for (const [host, held] of donors) {
    if ([host, held].some(ch => composer.excluded(ch) || composer.forced(ch))) continue
    const cut = nativeParts(composer.glyphRecord(host), outer, held, host)
    if (!cut) continue
    const [outerPart, reference] = cut
    const frame = { ...placed(outerPart, outerPart.box, outerPart.box, composer.ink(host), `host ${host}`), fixed: true }
    const seat = fitted(ink, reference.box, 1.2)
    const content = { ...placed(glyph, ink, seat, composer.ink(inner), `glyph ${inner}`), fixed: true }
    // A projecting hook can enter an empty corner of the native component's
    // bounding box. Check the replacement's ink before accepting that seat.
    const size = 128, bounds = union([outerPart.box, reference.box])
    const blocked = grown(fill(groupRings([frame]), size, bounds), size, 1)
    for (const scale of [1, 0.94, 0.88]) {
      const opening = scale === 1 ? seat : shrunk(seat, scale)
      content.target = opening
      content.source = ink
      content.weight = [0, 0]
      content.weight = matchStems(content, reference)
      const weightedInk = union(groupRings([content], 32).map(pointsBox))
      content.source = mapped(weightedInk, opening, ink)
      const mask = fill(groupRings([content]), size, bounds)
      if (mask.some((value, i) => value && blocked[i])) continue
      const parts = [frame, content]
      const source = union(groupRings(parts, 32).map(pointsBox))
      const mode = cells ? 'cells' : atRoot ? 'directional' : 'nested'
      const target = composer.enclosureInkBounds(node, mode, region) ?? region
      for (const p of parts) p.target = mapped(p.target, source, target)
      return parts
    }
  }
  return null
}
