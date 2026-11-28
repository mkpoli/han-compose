// @ts-check
import { derived, pointsBox } from './geometry.js'

// Positional 避讓 variant of 柬 beside 鳥 in Zhuque Fangsong: keeps 鶇's left-hand 東
// outer contour (including its shortened right 丶), merges the upper/lower 田 counter
// pairs into two tall openings, and places 柬's inner 丶/丿 dots inside those openings.
const LEFT_DOT_SLOT = [0.12, 0.19, 0.82, 0.79]
const RIGHT_DOT_SLOT = [0.11, 0.17, 0.85, 0.87]

/** @param {Float64Array} points @param {number[]} counterBox @param {number[]} slot */
function mapIntoCounter(points, counterBox, slot) {
  const [sx0, sy0, sx1, sy1] = pointsBox(points)
  const [cx0, cy0, cx1, cy1] = counterBox
  const tx0 = cx0 + slot[0] * (cx1 - cx0)
  const ty0 = cy0 + slot[1] * (cy1 - cy0)
  const tx1 = cx0 + slot[2] * (cx1 - cx0)
  const ty1 = cy0 + slot[3] * (cy1 - cy0)
  const sw = sx1 - sx0 || 1, sh = sy1 - sy0 || 1
  const out = new Float64Array(points.length)
  for (let i = 0; i < points.length; i += 2) {
    out[i] = tx0 + (points[i] - sx0) * (tx1 - tx0) / sw
    out[i + 1] = ty0 + (points[i + 1] - sy0) * (ty1 - ty0) / sh
  }
  return out
}

/** @param {any} dot @param {any} counter @param {number[]} slot */
function placeDot(dot, counter, slot) {
  return {
    ...dot,
    light: mapIntoCounter(dot.light, pointsBox(counter.light), slot),
    heavy: mapIntoCounter(dot.heavy, pointsBox(counter.heavy), slot),
  }
}

/** Merge the lower-left (index 2) and upper-left (index 3) 田 counters of 鶇's 東
 *  into one tall CCW opening by removing the middle horizontal crossbar.
 *  @param {any} lower @param {any} upper */
function mergeLeftCounter(lower, upper) {
  const last = lower.light.length - 2
  return {
    ...upper,
    ops: [['M', 1, false], ['L', 1, false], ['L', 1, false], ['L', 1, false]],
    light: new Float64Array([
      lower.light[0], lower.light[1],
      upper.light[2], upper.light[3],
      upper.light[4], upper.light[5],
      lower.light[last], lower.light[last + 1],
    ]),
    heavy: new Float64Array([
      lower.heavy[0], lower.heavy[1],
      upper.heavy[2], upper.heavy[3],
      upper.heavy[4], upper.heavy[5],
      lower.heavy[last], lower.heavy[last + 1],
    ]),
  }
}

/** Merge the lower-right (index 4) and upper-right (index 6) 田 counters of 鶇's 東
 *  into one tall CCW opening, keeping the curved bottom edge and right wall.
 *  @param {any} lower @param {any} upper */
function mergeRightCounter(lower, upper) {
  return {
    ...lower,
    ops: [['M', 1, false], ['L', 1, false], ['L', 1, false], ...lower.ops.slice(3)],
    light: new Float64Array([
      upper.light[0], upper.light[1],
      upper.light[2], upper.light[3],
      ...lower.light.slice(4),
    ]),
    heavy: new Float64Array([
      upper.heavy[0], upper.heavy[1],
      upper.heavy[2], upper.heavy[3],
      ...lower.heavy.slice(4),
    ]),
  }
}

/** Build the FangSong 避讓 柬 variant from verified Zhuque Fangsong 鶇 and 柬 parts.
 *  @param {any} dong @param {any} jian */
export function fangsongJianBirang(dong, jian) {
  const outer = dong.contours[0]
  const leftCounter = mergeLeftCounter(dong.contours[2], dong.contours[3])
  const rightCounter = mergeRightCounter(dong.contours[4], dong.contours[6])
  const leftDot = placeDot(jian.contours[2], leftCounter, LEFT_DOT_SLOT)
  const rightDot = placeDot(jian.contours[4], rightCounter, RIGHT_DOT_SLOT)
  return derived(dong, [outer, leftCounter, leftDot, rightCounter, rightDot])
}
