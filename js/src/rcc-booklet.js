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

// Under the crossbar TW-Kai's 册 closes each left leg with a blunt upright.
// 月 has a left-falling stroke with two continuous curved edges and a fine point.
const kaiMoon = '1315ee40fd8ec6bfb83d5f87b057d6dc190e9d138e2cf5b37d6a821b794cec15'
function kaiFallingLeg(frame, index, sourceRuns, moon) {
  const original = frame.contours[0], last = original.ops.length - 1
  const [, start, end] = sourceRuns.at(-1)
  const seam = last - (end - start)
  const joins = contourSections([original], [0, seam, seam], [0, last, last])
  const donor = contourSections(moon.contours, [0, 46, 64])
  // Fit the two edges of the section from 月 to the two existing joints,
  // and its sharp foot to the marked position beside the hook.
  const tip = contourSections([donor], [0, 10, 10])
  const fit = (points, [xt, yt], to) => {
    const [x0, y0] = points.slice(0, 2), [x1, y1] = points.slice(-2)
    const [rx, ry, lx, ly] = to
    const [tx, ty] = index === 0 ? [20, 70] : [205, 68]
    const det = (x1 - x0) * (yt - y0) - (xt - x0) * (y1 - y0)
    const out = new Float64Array(points.length)
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i] - x0, y = points[i + 1] - y0
      const u = (x * (yt - y0) - y * (xt - x0)) / det
      const v = ((x1 - x0) * y - (y1 - y0) * x) / det
      out[i] = rx + u * (lx - rx) + v * (tx - rx)
      out[i + 1] = ry + u * (ly - ry) + v * (ty - ry)
    }
    return out
  }
  const leg = { ...donor, light: fit(donor.light, tip.light, joins.light), heavy: fit(donor.heavy, tip.heavy, joins.heavy) }
  return derived(frame, [contourSections([original, leg], [0, 0, seam - 1], [1, 0, leg.ops.length - 1])])
}

export function bookletParts(composer, region) {
  const cut = cuts[composer.fontStyle]
  if (!cut || [booklet, '⿻⺆⺆', '⺆', '一', '册'].some(c => composer.excluded(c))) return null
  const record = composer.glyphRecord('册')
  if (record?.v !== 1) return null
  const kai = composer.fontStyle === 'regular'
  const moon = kai && !composer.excluded('月') ? composer.glyphRecord('月') : null
  let cached = cache.get(record)
  if (cached?.cut !== cut || cached.moon !== moon) {
    if (hexOf(JSON.stringify(record.p)) !== cut.digest) return null
    const useMoon = moon?.v === 1 && hexOf(JSON.stringify(moon.p)) === kaiMoon
    const glyph = partOf(record)
    const pieces = cut.groups.map((group, i) => {
      const contours = group.map(item => Number.isInteger(item) ? glyph.contours[item] : contourSections(glyph.contours, ...item))
      const frame = fitStrokes(derived(glyph, contours), i, cut, glyph.box)
      return useMoon && i < 2 ? kaiFallingLeg(frame, i, group[0], partOf(moon)) : frame
    })
    cached = { cut, moon, useMoon, pieces }
    cache.set(record, cached)
  }
  const frame = mapped(cut.ink, unit, region)
  return cached.pieces.map((part, i) => ({
    ...placed(part, part.box, mapped(part.box, [0, 0, 1000, 1000], frame), partInk(part), (i === 2 ? '一 from 册' : cached.useMoon ? '⺆ from 册 and 月' : '⺆ from 册') + ', R+0756'),
    fixed: true, rccLeaf: i,
  }))
}
