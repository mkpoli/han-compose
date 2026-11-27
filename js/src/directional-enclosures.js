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
    // Uprights flank the lower rectangular body under the crowns of 自, 百 and 首.
    const stations = axis === 0 ? [0.17, 0.23, 0.28, 0.34, 0.39, 0.45, 0.51]
      : [0.27, 0.31, 0.34, 0.37, 0.63, 0.66, 0.69, 0.73]
    for (const at of stations) {
      const edges = crossings(rings, across, box[across] + at * (box[across + 2] - box[across]))
      if (edges.length < 4) continue
      for (let i = 1; i < edges.length; i += 2) {
        if (axis === 0 && i !== 1 && i !== edges.length - 1) continue
        const length = edges[i] - edges[i - 1]
        if (length > 0.005 * (box[axis + 2] - box[axis]) && length < 0.21 * (box[axis + 2] - box[axis])) lengths.push(length)
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
  if (!donors || composer.measuringDirectionalInk) return null
  const [op, outer, inner] = node, sequence = op + outer + inner
  const encoded = composer.bySequence(sequence)
  if ((encoded && (composer.drawnGlyph(encoded, !atRoot) || composer.excluded(encoded) || composer.forced(encoded))) || composer.spelled.has(sequence) || donors.some(([, ch]) => ch === inner) ||
      [outer, inner, sequence].some(ch => composer.excluded(ch) || composer.forced(ch)) || !composer.own(inner)) return null
  // The donor fit lives in font coordinates. Layout probes may ask for this
  // sequence in several regions during a single synchronous loader pass.
  const cache = composer.directionalFitCache ??= new Map()
  if (!cache.has(sequence)) cache.set(sequence, fitNativeOpening(composer, donors, outer, inner))
  const fit = cache.get(sequence)
  if (!fit) return null
  const target = atRoot ? composer.enclosureInkBounds(node, cells ? 'cells' : 'directional', region) : region
  if (!target) return null
  const parts = fit.parts.map(part => ({ ...part, weight: [...part.weight], target: mapped(part.target, fit.source, target) }))
  if (!atRoot) {
    const group = Symbol()
    for (const part of parts) part.directionalGroup = group
  }
  return parts
}

function fitNativeOpening(composer, donors, outer, inner) {
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
      return { parts, source }
    }
  }
  return null
}
