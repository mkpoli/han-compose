// @ts-nocheck
import cuts from './rcc-booklet-cuts.json' with { type: 'json' }
import { contourSections, derived, groupRings, mapped, partInk, partOf, placed, pointsBox, union } from './geometry.js'
import { hexOf } from './sha256.js'

export const booklet = '⿻⿻⺆⺆一'
const unit = [0, 0, 1, 1]
// 1935 新式花邊様本, the 册 in 註册商標, RCC 1878, sighting 1957.
// Centers of the four uprights at one third of the tagged glyph's ink height.
// https://rare.glyphatlas.org/zh-Hans/entry/1878#sighting-1957
const posts = [[.255, .62], [.445, .815]]
const cache = new WeakMap()
const clamp = v => Math.max(0, Math.min(1, v))

function outlineBox(part) {
  return union(groupRings([placed(part, part.box, part.box, 0, '')], 64).map(pointsBox))
}

function fitStrokes(part, index, cut, donorBox) {
  const [l, b, r, t] = outlineBox(part)
  const width = donorBox[2] - donorBox[0], height = donorBox[3] - donorBox[1]
  const project = (x, y) => {
    if (index === 2) return [(x - l) / (r - l), .55 + (y - (b + t) / 2) / height]
    const [low, high] = index === 0 ? [.066, 1] : [0, .855]
    const h = low + (y - b) / (t - b) * (high - low)
    const [left, right] = cut.posts[index]
    // Move the two posts independently so widening the space under the roof
    // preserves the original pen width. Let the falling left leg reach its
    // printed foot while the third upright ends straight above the baseline.
    const across = clamp(((x - left) / (right - left) - .28) / .44)
    const below = clamp((.55 - h) / .46)
    const seat = posts[index][0] + (x - left) / width
    const foot = (index === 0 ? .02 : .205) + (x - l) / width
    const falling = seat + (foot - seat) * below * below
    return [falling + (posts[index][1] + (x - right) / width - falling) * across, h]
  }
  const move = points => {
    const out = new Float64Array(points.length)
    for (let i = 0; i < points.length; i += 2) {
      const [x, y] = project(points[i], points[i + 1])
      out[i] = 1000 * x; out[i + 1] = 1000 * y
    }
    return out
  }
  return derived(part, part.contours.map(c => ({ ...c, light: move(c.light), heavy: move(c.heavy) })))
}

export function bookletParts(composer, region) {
  const cut = cuts[composer.fontStyle]
  if (!cut || [booklet, '⿻⺆⺆', '⺆', '一', '册'].some(c => composer.excluded(c))) return null
  const record = composer.glyphRecord('册')
  if (record?.v !== 1) return null
  let cached = cache.get(record)
  if (cached?.cut !== cut) {
    if (hexOf(JSON.stringify(record.p)) !== cut.digest) return null
    const glyph = partOf(record)
    const pieces = cut.groups.map((group, i) => {
      const contours = group.map(item => Number.isInteger(item) ? glyph.contours[item] : contourSections(glyph.contours, ...item))
      return fitStrokes(derived(glyph, contours), i, cut, glyph.box)
    })
    cached = { cut, pieces }
    cache.set(record, cached)
  }
  const frame = mapped(cut.ink, unit, region)
  return cached.pieces.map((part, i) => ({
    ...placed(part, part.box, mapped(part.box, [0, 0, 1000, 1000], frame), partInk(part), (i === 2 ? '一' : '⺆') + ' from 册, R+0756'),
    fixed: true, rccLeaf: i,
  }))
}
