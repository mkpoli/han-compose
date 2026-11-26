import data from './recorded-arcs.json' with { type: 'json' }
import { fitted, makePart, mapped, partInk, placed, pointsBox, rings, union } from './geometry.js'
import { guideLoop } from './guide-loop.js'
import { parseChain } from './stroke-chain.js'

const chains = /** @type {Record<string, [string, string | null, string, number[][]]>} */ (/** @type {unknown} */ (data.entries))
const guideKey = '#(丨x4◞◟◜◝◞◝◞◝)'
const references = ['丨', '一']
const frame = [100, -20, 900, 790]

/** Glyphs whose light and heavy stem widths the reference drawing uses. @param {string} key @param {string} [_style] */
export function recordedArcDonors(key, _style) {
  return key === guideKey || Object.hasOwn(chains, key) ? references : []
}

/** Stem thickness at its midpoint, clear of a serif. @param {any} glyph @param {number} axis @param {boolean} heavy */
function thickness(glyph, axis, heavy) {
  /** @type {Float64Array[]} */
  const masters = glyph.contours.map((/** @type {{light: Float64Array, heavy: Float64Array}} */ c) => heavy ? c.heavy : c.light)
  const along = 1 - axis, box = union(masters.map(pointsBox))
  const middle = (box[along] + box[along + 2]) / 2
  const cuts = []
  for (const ring of rings(glyph.contours, masters)) {
    for (let i = 0; i < ring.length; i += 2) {
      const j = (i + 2) % ring.length, a = ring[i + along], b = ring[j + along]
      if ((a <= middle && middle < b) || (b <= middle && middle < a)) {
        cuts.push(ring[i + axis] + (ring[j + axis] - ring[i + axis]) * (middle - a) / (b - a))
      }
    }
  }
  return cuts.length === 2 ? Math.abs(cuts[1] - cuts[0]) : null
}

/** Outline a sampled KAGE centerline with the face's horizontal and vertical stem widths.
 * @param {number[]} line @param {number[]} radii */
function contour(line, radii) {
  const count = line.length / 2
  /** @param {number} i @param {number} cosine @param {number} sine */
  const offset = (i, cosine, sine = 0) => {
    const a = 2 * Math.max(0, i - 1), b = 2 * Math.min(count - 1, i + 1)
    const dx = line[b] - line[a], dy = line[b + 1] - line[a + 1]
    const length = Math.hypot(dx, dy) || 1
    return [
      line[2 * i] + radii[0] * (-dy * cosine + dx * sine) / length,
      line[2 * i + 1] + radii[1] * (dx * cosine + dy * sine) / length,
    ]
  }
  const points = Array.from({ length: count }, (_, i) => offset(i, 1)).flat()
  // Round the open tips while preserving the source join and crossing positions.
  for (let step = 1; step < 6; step++) {
    const angle = Math.PI * step / 6
    points.push(...offset(count - 1, Math.cos(angle), Math.sin(angle)))
  }
  for (let i = count - 1; i >= 0; i--) points.push(...offset(i, -1))
  for (let step = 1; step < 6; step++) {
    const angle = Math.PI * step / 6
    points.push(...offset(0, -Math.cos(angle), -Math.sin(angle)))
  }
  return Float64Array.from(points)
}

/** Draw a source-attested arc component using the selected face's stem widths.
 * @param {import('./compose.js').Composer} composer @param {string} key
 * @param {number[]} region @param {boolean} atRoot */
export function recordedArcParts(composer, key, region, atRoot) {
  const guide = key === guideKey
  if ((!guide && !Object.hasOwn(chains, key)) || composer.excluded(key)) return null
  const [host, variant, donor, lines] = guide ? ['𠆭', null, 'U+E00B', [guideLoop]] : chains[key]
  if (composer.excluded(host)) return null
  const chain = parseChain(key)
  if (!chain || chain.strokes.some(stroke => composer.excluded(stroke.char))) return null
  const stems = references.map(char => composer.excluded(char) ? null : composer.glyph(char))
  const radius = (/** @type {boolean} */ heavy) => stems.map((glyph, axis) => {
    const measured = glyph?.contours.length ? thickness(glyph, axis, heavy) : null
    const width = measured ?? composer.stem0[axis][Number(heavy)]
    // Curved strokes need less ink than the full straight stem at narrow crossings.
    return Math.max(12, Math.min(72, width * 0.42))
  })
  const light = radius(false)
  const heavy = radius(true).map((width, axis) => Math.min(width, light[axis] * 1.45))
  const box = union(lines.map(pointsBox))
  const limit = [Math.max(light[0], heavy[0]), Math.max(light[1], heavy[1])]
  const room = [frame[0] + limit[0], frame[1] + limit[1], frame[2] - limit[0], frame[3] - limit[1]]
  const target = fitted(box, room, 1)
  const contours = lines.map(line => {
    const path = line.flatMap((value, i) => {
      if (i % 2) return []
      return mapped([value, line[i + 1], value, line[i + 1]], box, target).slice(0, 2)
    })
    const lo = contour(path, light), hi = contour(path, heavy)
    const ops = Array.from({ length: lo.length / 2 }, (_, i) => [i ? 'L' : 'M', 1, false])
    return { ops, light: lo, heavy: hi, width: null }
  })
  const part = makePart(contours)
  const slot = atRoot ? mapped(part.box, composer.C.face, region) : fitted(part.box, region, composer.C.STRETCH)
  const source = guide ? `Bai IDS, guide ${donor}` : `GlyphWiki ${donor} (${host}${variant ? ` ${variant}` : ''})`
  return [placed(part, part.box, slot, partInk(part), `chain ${key}, ${source}`)]
}
