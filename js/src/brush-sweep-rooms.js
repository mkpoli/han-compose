// @ts-nocheck
import { derived, mapped, partInk, partOf, placed } from './geometry.js'
import { hexOf } from './sha256.js'

// x coordinates use the donor's 1000-unit em. The indexed points run around the low
// hook and its returning stroke, whose right tip stays at full width as the body narrows.
const frames = {
  fangsong: {
    瓦: { digest: '16791b5addd333e64387ae6f95168245dd222cdad74afb50200f9dc006e285c8', scale: 0.52, left: 64, pivot: 595, tip: 937, contour: 0, range: [77, 111] },
    巴: { digest: '7b094ea2c516dd35dda099e75a0ccc9c4f28fc06323157702835d524abc018b9', scale: 0.54, left: 104, pivot: 282, tip: 950, contour: 0, range: [46, 84] },
    竜: { digest: 'e4b19e281efb1551db14b62c9cc96badbab08656a79a6a41e37832ee75284efe', scale: 0.48, left: 48, pivot: 510, tip: 946, contour: 1, range: [54, 88] },
    克: { digest: '1236951574257c20eb89f8e4b56c14ae3bdc79a06af64d95ca1cbee77d6b0684', scale: 0.46, left: 45, pivot: 573, tip: 953, contour: 0, range: [99, 138] },
  },
  'pen-writing': {
    竜: { digest: '2dd4122d824db3a01264bc18fb72c348ef21aca24744ff214eb19a6764f7a8ce', scale: 0.48, left: 53, pivot: 485, tip: 947, contour: 3, range: [41, 75] },
  },
}

// Bounds of the upper-right operands, based on 瓩/甅/瓧/瓲/瓸, 𠀧, 𥪞 and 兛.
const interiors = {
  瓦: { 千: [472, 145, 903, 773], 厘: [485, 263, 873, 794], 十: [469, 134, 904, 783],
    屯: [487, 261, 870, 788], 百: [506, 157, 881, 717] },
  巴: { 三: [508, 204, 875, 668] }, 竜: { 内: [539, 178, 846, 766] },
  克: { 千: [508, 94, 913, 738] },
}
export function brushSweepRoom(node, style) {
  if (!Array.isArray(node) || node.note || node[0] !== '⿺' || typeof node[1] !== 'string' || typeof node[2] !== 'string') return null
  return frames[style]?.[node[1]] && interiors[node[1]]?.[node[2]]
}

export function brushSweepParts(composer, node, region) {
  const inside = brushSweepRoom(node, composer.fontStyle)
  if (!inside) return null
  const [, outer, inner] = node
  if (composer.excluded(outer) || composer.excluded(inner)) return null
  const spec = frames[composer.fontStyle][outer], source = composer.glyphRecord(outer)
  const filling = composer.glyph(inner)
  if (!source || !filling || hexOf(JSON.stringify(source.p)) !== spec.digest) return null
  const glyph = partOf(source), [lo, , hi] = glyph.box
  const extra = spec.tip - (spec.left + spec.scale * (hi - lo))
  const narrow = (points, contour) => {
    const dest = points.slice()
    for (let j = 0; j < dest.length; j += 2) {
      const x = points[j], i = j / 2
      dest[j] = spec.left + spec.scale * (x - lo)
      if (contour === spec.contour && i >= spec.range[0] && i <= spec.range[1]) {
        dest[j] += extra * Math.max(0, (x - spec.pivot) / (hi - spec.pivot))
      }
    }
    return dest
  }
  const frame = derived(glyph, glyph.contours.map((c, i) => ({
    ...c, light: narrow(c.light, i), heavy: narrow(c.heavy, i),
  })))
  const place = (part, box, name) => ({ ...placed(part, part.box,
    mapped(box, [0, -120, 1000, 880], region), partInk(part), `glyph ${name}`), fixed: true })
  return [place(frame, frame.box, outer), place(filling, inside, inner)]
}
