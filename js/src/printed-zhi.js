// @ts-nocheck
import { derived, mapped, partInk, placed, pointsBox, tightBox } from './geometry.js'

// Per-face drawing space calibrated against the visible outline of the IDS on main.
const frames = {
  sans: [0.0108, -0.01903, 0.9743, 0.97638],
  serif: [-0.04853, -0.02597, 1.01891, 1.00128],
  fangsong: [0.06648, -0.01511, 0.92751, 0.99588],
  regular: [0.01978, 0.01182, 0.98428, 0.9952],
  'pen-writing': [0.03007, -0.0148, 0.96989, 0.98706],
}

export const isPrintedZhi = node => node[0] === '⿱' && node[1] === '罒' &&
  node[2]?.[0] === '⿱' && node[2][1] === '十' && node[2][2]?.[0] === '⿺' &&
  node[2][2][1] === '丄' && node[2][2][2]?.[0] === '⿵' &&
  node[2][2][2][1] === '冂' && node[2][2][2][2] === '三' &&
  !node.note && !node[2].note && !node[2][2].note && !node[2][2][2].note

/** 置 in 広恵済急方, crop 1jeg0012. The separate upright stands to the left
 * of the three-bar enclosure, and both feet land on the same baseline. */
export function printedZhiParts(composer, node, region) {
  const frame = frames[composer.fontStyle]
  if (!frame || !isPrintedZhi(node)) return null
  const leaves = ['罒', '十', '丄', '冂', '三']
  if (leaves.some(ch => composer.excluded(ch))) return null
  const glyphs = leaves.map(ch => ch === '罒' && composer.fontStyle === 'fangsong'
    ? composer.fangsongNet() : composer.glyph(ch))
  if (glyphs.some(g => !g || !g.contours.length)) return null
  const hasArea = ([l, b, r, t]) => r > l && t > b
  if (!glyphs.every(g => hasArea(tightBox(g)))) return null

  // The narrow 十 still has full strokes where its two arms cross.
  const reshape = (glyph, fn) => {
    const box = tightBox(glyph), [l, b, r, t] = box, w = r - l, h = t - b
    const warp = points => {
      const out = points.slice()
      for (let i = 0; i < out.length; i += 2) {
        const [x, y] = fn((out[i] - l) / w, (out[i + 1] - b) / h)
        out[i] = l + x * w
        out[i + 1] = b + y * h
      }
      return out
    }
    return derived(glyph, glyph.contours.map(c => ({
      ...c, light: warp(c.light), heavy: warp(c.heavy ?? c.light),
    })), box)
  }
  const broaden = x => x + (x - 0.5) * 0.65 * Math.max(0, 1 - 2 * Math.abs(x - 0.5))
  glyphs[1] = reshape(glyphs[1], (x, y) => [broaden(x), broaden(y)])
  // Narrow the left upright while keeping both ends of its baseline.
  glyphs[2] = reshape(glyphs[2], (x, y) => [
    x < 0.36 ? x * 0.61 : x < 0.66 ? 0.2196 + (x - 0.36) * 0.58 : 1 - (1 - x) * 1.784,
    y,
  ])
  // Tuck the 冂 hook into the baseline so the third bar stays distinct.
  glyphs[3] = reshape(glyphs[3], (x, y) => [
    x > 0.4 ? x + Math.max(0, 0.89 - x) * Math.max(0, Math.min(1, (0.4 - y) / 0.14)) : x, y,
  ])
  // Seat the three native bars against the left wall. The lowest reaches furthest right.
  const bars = glyphs[4]
  if (bars.contours.length !== 3 || !bars.contours.every(c => hasArea(pointsBox(c.light)))) return null
  const ordered = [...bars.contours].sort((a, b) => pointsBox(b.light)[1] - pointsBox(a.light)[1])
  const levels = [0.9, 0.5, 0.1], reaches = [0.88, 0.83, 1]
  const [barLeft, , barRight] = tightBox(bars)
  glyphs[4] = derived(bars, ordered.map((c, i) => {
    const [l, b, r, t] = pointsBox(c.light)
    const thickness = 1.45 * (t - b) / (barRight - barLeft)
    const place = points => points.map((v, k) => k % 2
      ? 1000 * (levels[i] + ((v - b) / (t - b) - 0.5) * thickness)
      : 1000 * (v - l) / (r - l) * reaches[i])
    return { ...c, light: place(c.light), heavy: place(c.heavy ?? c.light) }
  }))
  const seats = [
    [0.16, 0.73, 0.86, 0.985], [0.29, 0.45, 0.64, 0.795],
    [0.045, 0.015, 0.96, 0.49], [0.445, 0.016, 0.79, 0.505],
    [0.455, 0.15, 0.735, 0.415],
  ]
  const drawing = mapped(frame, [0, 0, 1, 1], region)
  return glyphs.map((g, i) => ({
    ...placed(g, tightBox(g), mapped(seats[i], [0, 0, 1, 1], drawing), partInk(g), `printed 置: ${leaves[i]}`),
    fixed: true,
  }))
}
