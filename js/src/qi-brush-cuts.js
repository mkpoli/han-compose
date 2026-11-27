// @ts-nocheck
import { derived, segments } from './geometry.js'

// Zhuque FangSong's 器 joins the upper-left and both lower mouths to 大 in
// one contour. Each pair names the endpoints of an arc between brush joins.
const fangQi = '55a5d33fbfbf1429221130ec6ad65b5b234fac564199a1e09777970805092f77'

function cutArcs(contour, arcs) {
  function trace(points) {
    const source = segments(contour.ops, points)
    const result = []
    for (const [start, end] of arcs) {
      result.push([result.length ? 'L' : 'M', [source[start][1].at(-1)]])
      result.push(...source.slice(start + 1, end + 1))
    }
    return result
  }
  const light = trace(contour.light), heavy = trace(contour.heavy)
  const coordinates = path => Float64Array.from(path.flatMap(([, points]) => points.flat()))
  return { ...contour, ops: light.map(([op, points]) => [op, points.length, false]),
    light: coordinates(light), heavy: coordinates(heavy) }
}

export function brushQiRows(glyph, digest) {
  if (digest !== fangQi) return null
  const [joined, lowerLeftHole, lowerRightHole, upperLeftHole, dot, upperRight, upperRightHole] = glyph.contours
  const upperLeft = cutArcs(joined, [[0, 29], [132, 133]])
  const lowerRight = cutArcs(joined, [[61, 84]])
  const lowerLeft = cutArcs(joined, [[87, 112], [117, 120]])
  const body = cutArcs(joined, [[29, 61], [84, 87], [112, 117], [120, 132]])
  return {
    upper: derived(glyph, [upperLeft, upperLeftHole, upperRight, upperRightHole]),
    body: derived(glyph, [body]),
    lower: derived(glyph, [lowerLeft, lowerLeftHole, lowerRight, lowerRightHole]),
    dot: derived(glyph, [dot]),
  }
}
