// @ts-check
import { parsePath } from './document-path.js'

/** A filled component, already located in a known comparison frame. The optional six SVG matrix
 * coefficients map its path coordinates into that frame.
 * @typedef {{d:string, frame:string, matrix?:number[], fillRule?:'nonzero'|'evenodd'}} Outline */
/** @typedef {Outline & {form:string, source:string}} OutlineWitness */
/** @typedef {{type:string, points:number[][]}} Edge */
/** @typedef {Edge[]} Ring */
/** @typedef {{frame:string, fill:string, rings:Ring[]}} Prepared */

const MAX_PATH = 128 * 1024
const MAX_SEGMENTS = 4096
const MAX_RINGS = 128

/** @param {Outline} outline @returns {Prepared} */
function prepare(outline) {
  if (!outline || typeof outline.frame !== 'string' || !outline.frame.trim()) throw new TypeError('A coordinate frame is required')
  if (typeof outline.d !== 'string' || outline.d.length > MAX_PATH || !/^\s*M/.test(outline.d) ||
      /,\s*,|,\s*(?:$|[MLQCZ])|[MLQCZ]\s*,/.test(outline.d)) throw new TypeError('Invalid SVG component path')
  const fill = outline.fillRule ?? 'nonzero'
  if (fill !== 'nonzero' && fill !== 'evenodd') throw new TypeError('Unsupported fill rule')
  if ('transform' in outline) throw new TypeError('Supply a numeric SVG matrix for a transformed path')
  const matrix = outline.matrix ?? [1, 0, 0, 1, 0, 0]
  if (!Array.isArray(matrix) || matrix.length !== 6 || !matrix.every(Number.isFinite)) throw new TypeError('Invalid component matrix')
  const [a, b, c, d, e, f] = matrix
  const determinant = a * d - b * c
  if (!determinant || !Number.isFinite(determinant)) throw new TypeError('Singular or unrepresentable component matrix')
  /** @param {number[]} p */
  function mapped(p) {
    const point = [a * p[0] + c * p[1] + e, b * p[0] + d * p[1] + f]
    if (!point.every(Number.isFinite)) throw new TypeError('Nonfinite component coordinate')
    return point
  }
  const { segments } = parsePath(outline.d)
  if (segments.length > MAX_SEGMENTS) throw new RangeError('Component path exceeds segment limit')
  /** @type {Ring[]} */
  const rings = []
  /** @type {Ring | undefined} */
  let ring
  /** @type {number[]} */
  let last = []
  /** @type {number[]} */
  let start = []
  for (const s of segments) {
    if (s.type === 'M') {
      if (ring) throw new TypeError('Expected a closed SVG contour')
      ring = []
      last = start = mapped(s.p)
      continue
    }
    if (!ring) throw new TypeError('Missing initial M in SVG contour')
    if (s.type === 'Z') {
      // Closing with an explicit line to the start and closing with Z have the same geometry.
      if (last[0] !== start[0] || last[1] !== start[1]) ring.push({ type: 'L', points: [last] })
      if (!ring.length) throw new TypeError('Empty SVG contour')
      rings.push(ring)
      if (rings.length > MAX_RINGS) throw new RangeError('Component path exceeds contour limit')
      ring = undefined
    } else if (s.type === 'L') {
      const end = mapped(s.p)
      if (end[0] !== last[0] || end[1] !== last[1]) ring.push({ type: 'L', points: [last] })
      last = end
    } else if (s.type === 'C' || s.type === 'Q') {
      ring.push({ type: s.type, points: s.type === 'C' ? [last, mapped(s.c1), mapped(s.c2)] : [last, mapped(s.c)] })
      last = mapped(s.end)
    }
  }
  if (ring || !rings.length) throw new TypeError('Expected one or more closed SVG contours')
  return { frame: outline.frame, fill, rings }
}

/** Smallest maximum displacement among cyclic alignments with the same oriented Bézier segments.
 * @param {Ring} one @param {Ring} two @param {number} tolerance @param {() => void} spend */
function ringDistance(one, two, tolerance, spend) {
  if (one.length !== two.length) return Infinity
  let best = Infinity
  for (let offset = 0; offset < two.length; offset++) {
    let error = 0
    for (let i = 0; i < one.length; i++) {
      spend()
      const a = one[i], b = two[(i + offset) % two.length]
      if (a.type !== b.type) { error = Infinity; break }
      for (let j = 0; j < a.points.length; j++) {
        error = Math.max(error, Math.hypot(a.points[j][0] - b.points[j][0], a.points[j][1] - b.points[j][1]))
      }
      if (error >= best || error > tolerance) break
    }
    if (error <= tolerance) best = Math.min(best, error)
    if (best === 0) break
  }
  return best
}

/** Every contour must have its own mate; take the least attainable maximum displacement across
 * these assignments. The threshold search handles close or coincident contours in either order.
 * @param {Prepared} one @param {Prepared} two @param {number} tolerance @param {() => void} spend */
function distance(one, two, tolerance, spend) {
  if (one.fill !== two.fill || one.rings.length !== two.rings.length) return Infinity
  const distances = one.rings.map(ring => two.rings.map(other => ringDistance(ring, other, tolerance, spend)))
  const thresholds = [...new Set(distances.flat().filter(Number.isFinite))].sort((a, b) => a - b)
  /** @param {number} limit */
  function fits(limit) {
    const paired = new Int16Array(two.rings.length).fill(-1)
    /** @param {number} i @param {Uint8Array} seen */
    function assign(i, seen) {
      for (let j = 0; j < paired.length; j++) {
        spend()
        if (seen[j] || distances[i][j] > limit) continue
        seen[j] = 1
        if (paired[j] < 0 || assign(paired[j], seen)) { paired[j] = i; return true }
      }
      return false
    }
    return one.rings.every((_, i) => assign(i, new Uint8Array(paired.length)))
  }
  let lo = 0, hi = thresholds.length
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (fits(thresholds[mid])) hi = mid
    else lo = mid + 1
  }
  return thresholds[lo] ?? Infinity
}

/** Match a located vector outline against observed shapes in the same coordinate frame. Distances
 * use frame units and include curve controls. A different winding or curve segmentation falls
 * outside this comparison. All matches within tolerance retain their source, including ties.
 * @param {Outline} observation @param {readonly OutlineWitness[]} witnesses @param {{tolerance?:number}} [options] */
export function recognizeVariationOutline(observation, witnesses, { tolerance = 0 } = {}) {
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new RangeError('Expected a nonnegative finite outline tolerance')
  if (!Array.isArray(witnesses) || witnesses.length > 512) throw new RangeError('At most 512 component witnesses per comparison')
  const observed = prepare(observation)
  let bytes = observation.d.length, remaining = 2_000_000
  const spend = () => { if (--remaining < 0) throw new RangeError('Outline comparison budget exceeded') }
  const candidates = []
  for (const witness of witnesses) {
    if (typeof witness?.form !== 'string' || !witness.form || typeof witness.source !== 'string' || !witness.source) {
      throw new TypeError('Each outline witness requires form and source identifiers')
    }
    bytes += witness.d?.length ?? 0
    if (bytes > 2 * 1024 * 1024) throw new RangeError('Outline data exceeds comparison limit')
    const reference = prepare(witness)
    if (reference.frame !== observed.frame) throw new RangeError('Outline frames differ')
    const error = distance(observed, reference, tolerance, spend)
    if (error <= tolerance) candidates.push({ form: witness.form, source: witness.source, distance: error })
  }
  candidates.sort((a, b) => a.distance - b.distance)
  const status = candidates.length === 0 ? 'unknown' : candidates.length === 1 ? 'matched' : 'ambiguous'
  return { status, candidates }
}
