import { derived, fitted, mapped, partInk, partOf, placed, union } from './geometry.js'
import { nativeStroke, strokeDonor } from './stroke-donors.js'
import { hexOf } from './sha256.js'

const key = '#(-㇝x1㇇)'

// The Korean form joins a short rising entry to the top bar of 又.
// GlyphWiki u53c8-k: (33,65)–(47,51)–(57,31) in a glyph spanning
// x=14..177, y=31..183. The fourth stroke is absent from neutral 又.
// https://glyphwiki.org/wiki/u53c8-k
// The join is measured on the top bar of each pinned font. In faces that
// leave the descending stroke open, lift its cap to meet the rising entry.
/** @typedef {{ range: number[], bottom: number, top: number, offset: number[] }} Lift */
/** @type {Record<string,{digest:string,join:number[],lift?:Lift}>} */
const faces = {
  sans: { digest: '5686253ee1f09e63ff8b7a8a716bb3ac656ce9c6b00520b7b66b95ad9ca2835f', join: [257, 703], lift: { range: [0, 12], bottom: 350, top: 643, offset: [8, 39] } },
  serif: { digest: 'ec907f9019c0626008b3a11d2604fe5d285322691542fb2c774932a939a71f8e', join: [265, 717] },
  fangsong: { digest: '0f6f9c63573331e58d3124b368a3b94772141fe7853d06665bc1b405cc7dd640', join: [359, 606], lift: { range: [0, 17], bottom: 305, top: 457, offset: [12, 132] } },
  regular: { digest: '65b4573a35ba92e969c9e471006c17459cda60330ce79765247303477950fa32', join: [268, 603] },
  'pen-writing': { digest: '5db681e1608e0cc088afaf27cac62f5e1bc6e3e2bea0b8242c33ec92b4a29a66', join: [313, 638], lift: { range: [4, 18], bottom: 320, top: 578, offset: [10, 41] } },
}

/** @param {string} chain @param {string} style */
export function youChainDonors(chain, style) {
  if (chain !== key || !Object.hasOwn(faces, style)) return []
  const donor = strokeDonor('㇀', style)
  return donor ? ['又', '㇀', donor] : ['又', '㇀']
}

/** @param {any} body @param {Lift} spec */
function raisedCap(body, spec) {
  const { range: [first, last], bottom, top, offset: [dx, dy] } = spec
  const c = body.contours[0]
  /** @param {Float64Array} points */
  const move = points => {
    const result = points.slice()
    for (let k = 2 * first; k < points.length && k <= 2 * last; k += 2) {
      const weight = Math.max(0, Math.min(1, (c.light[k + 1] - bottom) / (top - bottom)))
      result[k] += dx * weight
      result[k + 1] += dy * weight
    }
    return result
  }
  return derived(body, [{ ...c, light: move(c.light), heavy: move(c.heavy) }, ...body.contours.slice(1)])
}

/** @param {any} stroke @param {number[]} body @param {number[]} tip */
function risingEntry(stroke, body, tip) {
  const [left, bottom, right, top] = stroke.box
  const w = right - left, h = top - bottom, source = Math.hypot(w, h)
  const dx = 24 / 163 * (body[2] - body[0]), dy = 34 / 152 * (body[3] - body[1]), length = Math.hypot(dx, dy)
  if (!(w > 0 && h > 0 && length > 0)) return null
  const normal = Math.sqrt(length / source)
  /** @param {Float64Array} points */
  const fit = points => {
    const out = new Float64Array(points.length)
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i] - right, y = points[i + 1] - top
      const along = (x * w + y * h) / (source * source)
      const across = (y * w - x * h) / source * normal / length
      out[i] = tip[0] + dx * along - dy * across
      out[i + 1] = tip[1] + dy * along + dx * across
    }
    return out
  }
  return derived(stroke, stroke.contours.map((/** @type {any} */ c) => ({ ...c, light: fit(c.light), heavy: fit(c.heavy) })))
}

/** @param {import('./compose.js').Composer} composer @param {string} chain @param {number[]} region @param {boolean} atRoot */
export function youChainParts(composer, chain, region, atRoot) {
  if (chain !== key || [key, '又', '㇀', '㇝', '㇇'].some(char => composer.excluded(char))) return null
  const face = faces[composer.fontStyle], record = composer.glyphRecord('又')
  if (!face || record?.v !== 1 || hexOf(JSON.stringify(record.p)) !== face.digest) return null
  const direct = composer.glyphRecord('㇀'), donor = strokeDonor('㇀', composer.fontStyle)
  const stroke = direct?.v === 1 ? partOf(direct) : donor && !composer.excluded(donor)
    ? nativeStroke('㇀', composer.fontStyle, char => composer.glyphRecord(char)) : null
  if (!stroke) return null
  const glyph = partOf(record)
  const body = face.lift ? raisedCap(glyph, face.lift) : glyph
  const entry = risingEntry(stroke, glyph.box, face.join)
  if (!entry) return null
  const frame = union([body.box, entry.box]), target = atRoot ? mapped(frame, composer.C.face, region) : fitted(frame, region, composer.C.STRETCH)
  return [body, entry].map(part => ({
    ...placed(part, part.box, mapped(part.box, frame, target), partInk(part), 'chain ' + key + ', native 又 and 提, GlyphWiki u53c8-k (又 K)'),
    fixed: atRoot,
  }))
}
