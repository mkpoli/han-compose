// @ts-check
// The path data of a drawing part, read into segments and split into closed contours. The document
// source needs both: one piece per contour, and a polygon to decide which contours cut and which are
// cut, under the fill rule the drawing is drawn with.
/** @typedef {[number, number]} Point */
/** @typedef {{ type: 'M' | 'L', p: Point } | { type: 'Q', p: Point, c: Point, end: Point } | { type: 'C', p: Point, c1: Point, c2: Point, end: Point } | { type: 'Z', p: Point, start: Point }} Segment */
/** @typedef {{ segments: Segment[], points: Point[] }} Path */

/** A path the source cannot read as the absolute M, L, Q, C, Z subset a drawing uses. */
export class PathError extends Error { name = 'PathError' }

/** Whether the text is that subset at all, without reading it. @param {string} d */
export const isPath = (/** @type {string} */ d) => /[MLQCZ]/i.test(d) && !/[^MLQCZmlqcz0-9.,eE+\-\s]/.test(d)

/** Parse the absolute M, L, Q, C and Z subset a document geometry uses. @param {string} d @returns {Path} */
export function parsePath(d) {
  /** @type {Segment[]} */
  const segments = []
  /** @type {Point[]} */
  const points = []
  let current = /** @type {Point} */ ([0, 0])
  let start = /** @type {Point} */ ([0, 0])
  let command = ''
  /** @type {number[]} */
  let values = []
  let at = 0
  const process = () => {
    if (!command) return
    if (command === 'Z') {
      if (values.length) throw new PathError('Z takes no numbers')
      segments.push({ type: 'Z', p: current, start }); current = start; command = ''; values = []; return
    }
    if (command === 'M' || command === 'L') {
      if (values.length < 2 || values.length % 2) throw new PathError(`${command} needs coordinate pairs`)
      for (let i = 0; i < values.length; i += 2) {
        const point = /** @type {Point} */ ([values[i], values[i + 1]])
        if (command === 'M' && i === 0) { start = point; segments.push({ type: 'M', p: point }) }
        else segments.push({ type: 'L', p: point })
        points.push(point); current = point
      }
    } else {
      const size = command === 'Q' ? 4 : 6
      if (!values.length || values.length % size) throw new PathError(`${command} needs ${size} numbers`)
      for (let i = 0; i < values.length; i += size) {
        if (command === 'Q') {
          const c = /** @type {Point} */ ([values[i], values[i + 1]]), end = /** @type {Point} */ ([values[i + 2], values[i + 3]])
          segments.push({ type: 'Q', p: current, c, end }); points.push(c, end); current = end
        } else {
          const c1 = /** @type {Point} */ ([values[i], values[i + 1]]), c2 = /** @type {Point} */ ([values[i + 2], values[i + 3]]), end = /** @type {Point} */ ([values[i + 4], values[i + 5]])
          segments.push({ type: 'C', p: current, c1, c2, end }); points.push(c1, c2, end); current = end
        }
      }
    }
    command = ''; values = []
  }
  while (at < d.length) {
    const char = d[at]
    if (/[\s,]/.test(char)) { at++; continue }
    if (/[A-Za-z]/.test(char)) {
      process()
      if (!'MLQCZ'.includes(char)) throw new PathError(`unsupported path command ${char}`)
      command = char; at++
      continue
    }
    if (!command) throw new PathError('path data starts with a number')
    const match = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(at))
    if (!match) throw new PathError(`unreadable path data at ${at}`)
    values.push(Number(match[0])); at += match[0].length
  }
  process()
  return { segments, points }
}

/** The closed subpaths of a piece, each starting at M. @param {string} d @returns {string[]} */
export const splitSubpaths = (/** @type {string} */ d) => d.match(/M[^M]*/g) ?? []

const CURVE_STEPS = 16

/** The polygon a closed subpath traces, with each curve sampled. @param {string} d @returns {Point[]} */
export function flatten(d) {
  /** @type {Point[]} */
  const points = []
  for (const segment of parsePath(d).segments) {
    if (segment.type === 'Z') continue
    if (segment.type === 'M' || segment.type === 'L') { points.push(segment.p); continue }
    for (let step = 1; step <= CURVE_STEPS; step++) {
      const t = step / CURVE_STEPS, u = 1 - t
      if (segment.type === 'Q') {
        const { p, c, end } = segment
        points.push(/** @type {Point} */ ([0, 1].map(k => u * u * p[k] + 2 * u * t * c[k] + t * t * end[k])))
      } else if (segment.type === 'C') {
        const { p, c1, c2, end } = segment
        points.push(/** @type {Point} */ ([0, 1].map(k => u * u * u * p[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * end[k])))
      }
    }
  }
  return points
}

/** The signed area of a polygon. @param {Point[]} points */
export function signedAreaOf(points) {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    area += a[0] * b[1] - b[0] * a[1]
  }
  return area / 2
}

/** Whether `point` lies inside the polygon through `points`, by the even-odd rule.
 * @param {Point} point @param {Point[]} points */
export function inside(point, points) {
  let hit = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j]
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit
  }
  return hit
}

/** Whether segment ab properly crosses segment cd. @param {Point} a @param {Point} b @param {Point} c @param {Point} d */
function crosses(a, b, c, d) {
  const side = (/** @type {Point} */ p, /** @type {Point} */ q, /** @type {Point} */ r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0
}

/** Whether any edge of one polygon properly crosses an edge of the other. @param {Point[]} one @param {Point[]} other */
export function edgesCross(one, other) {
  for (let i = 0; i < one.length; i++) {
    for (let j = 0; j < other.length; j++) {
      if (crosses(one[i], one[(i + 1) % one.length], other[j], other[(j + 1) % other.length])) return true
    }
  }
  return false
}

/** Whether `inner` lies wholly inside `outer`: every vertex is inside and no edge crosses.
 * @param {Point[]} outer @param {Point[]} inner */
export function contains(outer, inner) {
  return inner.every(point => inside(point, outer)) && !edgesCross(outer, inner)
}
