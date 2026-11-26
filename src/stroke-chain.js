// @ts-check
// A zi.tools stroke chain (`#(-𠃌㇉)`, 白式 IDS §5) drawn from the face's own strokes. The chain says
// which stroke ends meet; `solveChain` finds a drawing of it on a grid, and `chainForm` carries each
// stroke's glyph onto that grid, its bars moved rigidly and the room between them stretched.
// Notation: NightFurySL2001, （白式）IDS 延展语法导论, <https://nightfurySl2001.github.io/bai-ids/>, §5.
import { derived, fill, partInk, rings, union } from './geometry.js'
import { guideLoopTurns } from './guide-loop.js'
import { drawingChain } from './chain-corrections.js'
import { historicalChainGraph } from './historical-chains.js'
import landmarks from './chain-landmarks.json' with { type: 'json' }
import { STROKE_CHAINS, customAt } from './tree.js'

/**
 * The segments each stroke is written with: H rightward, S downward, P down-left, N down-right,
 * T up-right, and the clockwise quarter arcs a–d. A hook ends a stroke without moving its end.
 * @type {Readonly<Record<string, string>>}
 */
const SEGMENTS = {
  一: 'H', 丨: 'S', 丿: 'P', 乀: 'N', 丶: 'N', '㇀': 'T', '㇂': 'N', '㇄': 'SH', '㇅': 'HSH', '㇇': 'HP',
  '㇈': 'HSH', '㇉': 'SHS', '㇊': 'HST', '㇌': 'HPN', '㇘': 'SL', '㇢': 'P', '㇁': 'N', '㇋': 'HPHP', '㇍': 'HSH', '㇎': 'HSHS', '㇝': 'PN', 乁: 'HN', 乙: 'HPH', 乚: 'SH',
  乛: 'H', 亅: 'S', 𠃊: 'SH', 𠃋: 'PH', 𠃌: 'HS', 𠃍: 'HS', 𠃑: 'SHS', 𠄌: 'ST', 𠄎: 'HSHS', '⺄': 'HN',
  '◝': 'a', '◞': 'b', '◟': 'c', '◜': 'd',
}
/** A segment's direction, x then y, y up. @type {Record<string, [number, number]>} */
const STEP = { L: [-1, 0], H: [1, 0], S: [0, -1], P: [-1, -1], N: [1, -1], T: [1, 1], a: [1, -1], b: [-1, -1], c: [-1, 1], d: [1, 1] }
/** How many orderings of one axis are tried. */
const MOST_ORDERS = 400
/** Directed vertex measurements from independent zi.tools drawings, keyed by
 * the raw chain. See js/scripts/measure-chain-landmarks.mjs.
 * @type {Record<string, number[]>} */
const measured = landmarks
/** The room between two grid lines: full where strokes stand across it, less where they only pass. */
const OPEN = 1, PASS = 0.45, OFFSET = 0.28
/** The em box a chain's strokes fill, in font units. */
const BOX = [100, -20, 900, 790]

/** @typedef {{ char: string, reversed: boolean, cross: number | null, at: number[] }} ChainStroke */
/** @typedef {{ stroke: number, from: number, to: number, kind: string }} Segment */

/**
 * The strokes of a chain, or null where it names one this module has no segments for. Letters are
 * read as the character they spell, longest first.
 * @param {string} text @returns {{ strokes: ChainStroke[], closed: boolean } | null}
 */
export function parseChain(text) {
  text = drawingChain(text)
  const historic = historicalChainGraph(text)
  if (historic && historic.strokes.every(char => Object.hasOwn(SEGMENTS, char))) {
    return { strokes: historic.strokes.map(char => ({ char, reversed: false, cross: null, at: [] })), closed: false }
  }
  const chars = [...text], custom = customAt(chars)
  if (custom?.kind !== 'chain' || custom.end !== chars.length) return null
  const body = chars.slice(2, -1)
  const closed = body.at(-1) === 'z'
  if (closed) body.pop()
  /** @type {ChainStroke[]} */
  const strokes = []
  for (let at = 0; at < body.length;) {
    const reversed = body[at] === '-'
    if (reversed) at++
    let char = body[at], end = at + 1
    if (/[A-Z]/.test(char ?? '')) {
      let stop = at
      while (/[A-Za-z]/.test(body[stop] ?? '')) stop++
      for (; stop > at; stop--) {
        const named = STROKE_CHAINS[body.slice(at, stop).join('')]
        if (named && SEGMENTS[named]) { char = named; end = stop; break }
      }
    }
    if (!char || !SEGMENTS[char]) return null
    at = end
    let cross = null
    if (body[at] === 'x') {
      let digits = ''
      while (/[0-9]/.test(body[++at] ?? '')) digits += body[at]
      if (!digits) return null
      cross = Number(digits)
    } else if (body[at] === 'b') at++
    strokes.push({ char, reversed, cross, at: [] })
  }
  return strokes.length ? { strokes, closed } : null
}

/** @param {number} n */
function classes(n) {
  const up = Array.from({ length: n }, (_, i) => i)
  /** @param {number} i @returns {number} */
  const find = i => up[i] === i ? i : (up[i] = find(up[i]))
  /** @param {number} a @param {number} b */
  const join = (a, b) => { up[find(a)] = find(b) }
  return { find, join }
}

/**
 * The orderings of `ids` that keep every `before` pair strictly apart, as levels, ties allowed.
 * @param {number[]} ids @param {[number, number][]} before @returns {Map<number, number>[]}
 */
function orders(ids, before) {
  /** @type {Map<number, number>[]} */
  const out = []
  /** @param {number[]} left @param {Map<number, number>} levels @param {number} level */
  const walk = (left, levels, level) => {
    if (out.length >= MOST_ORDERS) return
    if (!left.length) { out.push(new Map(levels)); return }
    const free = left.filter(id => !before.some(([a, b]) => b === id && left.includes(a)))
    if (!free.length) return
    // Earlier written lines first, alone before together.
    const subsets = 1 << Math.min(free.length, 5)
    for (let bits = 1; bits < subsets; bits++) {
      const taken = free.filter((_, i) => bits >> i & 1)
      for (const id of taken) levels.set(id, level)
      walk(left.filter(id => !taken.includes(id)), levels, level + 1)
      for (const id of taken) levels.delete(id)
    }
  }
  walk(ids, new Map(), 0)
  return out
}

/** Whether two straight segments share a point, and whether they cross inside both.
 *  @param {number[]} a @param {number[]} b */
function meeting(a, b) {
  const side = (/** @type {number[]} */ s, /** @type {number} */ x, /** @type {number} */ y) =>
    Math.sign((s[2] - s[0]) * (y - s[1]) - (s[3] - s[1]) * (x - s[0]))
  const on = (/** @type {number[]} */ s, /** @type {number} */ x, /** @type {number} */ y) =>
    side(s, x, y) === 0 && x >= Math.min(s[0], s[2]) && x <= Math.max(s[0], s[2]) && y >= Math.min(s[1], s[3]) && y <= Math.max(s[1], s[3])
  const a0 = side(b, a[0], a[1]), a1 = side(b, a[2], a[3]), b0 = side(a, b[0], b[1]), b1 = side(a, b[2], b[3])
  if (a0 * a1 < 0 && b0 * b1 < 0) return 'cross'
  return on(b, a[0], a[1]) || on(b, a[2], a[3]) || on(a, b[0], b[1]) || on(a, b[2], b[3]) ? 'touch' : null
}

/**
 * A drawing of a chain on a grid: each vertex's x and y line and each line's place, 0 to 1, or null
 * where the joins contradict each other.
 * @param {string} text
 */
export function solveChain(text) {
  text = drawingChain(text)
  if (!solved.has(text)) {
    if (solved.size >= MOST_SOLVED) solved.clear()
    solved.set(text, solve(text))
  }
  return solved.get(text) ?? null
}
/** Each chain's drawing, solved once however many composers ask. @type {Map<string, ReturnType<typeof solve>>} */
const solved = new Map()
const MOST_SOLVED = 500

/** @param {string} text */
function solve(text) {
  const chain = parseChain(text)
  if (!chain) return null
  const { strokes, closed } = chain
  let count = 0
  /** @type {Segment[]} */
  const segments = []
  strokes.forEach((stroke, i) => {
    const kinds = [...SEGMENTS[stroke.char]]
    stroke.at = Array.from({ length: kinds.length + 1 }, () => count++)
    kinds.forEach((kind, k) => segments.push({ stroke: i, from: stroke.at[k], to: stroke.at[k + 1], kind }))
  })
  const first = (/** @type {ChainStroke} */ s) => s.reversed ? s.at[s.at.length - 1] : s.at[0]
  const last = (/** @type {ChainStroke} */ s) => s.reversed ? s.at[0] : s.at[s.at.length - 1]
  const xs = classes(count), ys = classes(count), points = classes(count)
  /** @param {number} a @param {number} b */
  const meet = (a, b) => { xs.join(a, b); ys.join(a, b); points.join(a, b) }
  const graph = historicalChainGraph(text)
  if (graph) {
    // Early editions specify pairs of stroke endpoints. Some paths branch or share
    // two ends, so adjacent strokes need not be joined in their listed order.
    const endpoint = (/** @type {number[]} */ [i, end]) => end ? last(strokes[i]) : first(strokes[i])
    for (const [left, right] of graph.joins) meet(endpoint(left), endpoint(right))
  } else {
    for (let i = 1; i < strokes.length; i++) meet(last(strokes[i - 1]), first(strokes[i]))
    if (closed) meet(last(strokes[strokes.length - 1]), first(strokes[0]))
  }
  const crossings = new Set((graph?.crossings ?? strokes.flatMap((s, i) => s.cross === null ? [] : [[i, s.cross]]))
    .map(([a, b]) => a < b ? `${a},${b}` : `${b},${a}`))
  for (const s of segments) {
    if (STEP[s.kind][0] === 0) xs.join(s.from, s.to)
    if (STEP[s.kind][1] === 0) ys.join(s.from, s.to)
  }
  /** @param {{ find: (i: number) => number }} axis @param {0 | 1} d @returns {[number, number][]} */
  const order = (axis, d) => segments.filter(s => STEP[s.kind][d]).map(s => {
    const a = axis.find(s.from), b = axis.find(s.to)
    // Down is later, so both axes run the way they are written.
    return (d === 0 ? STEP[s.kind][0] > 0 : STEP[s.kind][1] < 0) ? [a, b] : [b, a]
  })
  // The guide illustrates the loop beneath 人 and 二 in 𠆭. Its turns have
  // unequal radii and the tail overshoots the loop. Keep those extrema when
  // placing each face's strokes. Coordinates are measured in the guide font.
  // NightFurySL2001, 白式 IDS §5, example.woff2 U+E00B, revision 104501af.
  if (text === '#(丨x4◞◟◜◝◞◝◞◝)') {
    const ends = guideLoopTurns
    const x = new Map(), y = new Map()
    strokes.forEach((s, i) => s.at.forEach((v, k) => {
      x.set(xs.find(v), (ends[i + k][0] - 174) / (873 - 174))
      y.set(ys.find(v), (803 - ends[i + k][1]) / (803 + 18))
    }))
    return { strokes, segments, xs, ys, points, x, y, broken: 0 }
  }
  const bx = order(xs, 0), by = order(ys, 1)
  if ([...bx, ...by].some(([a, b]) => a === b)) return null
  // An axis's lines, in the order the strokes reach them.
  const idsOf = (/** @type {{ find: (i: number) => number }} */ axis) => [...new Set(Array.from({ length: count }, (_, i) => axis.find(i)))]
  const ox = orders(idsOf(xs), bx), oy = orders(idsOf(ys), by)
  if (!ox.length || !oy.length) return null
  const bandX = new Set(segments.filter(s => s.kind === 'S').map(s => xs.find(s.from)))
  const bandY = new Set(segments.filter(s => STEP[s.kind][1] === 0).map(s => ys.find(s.from)))
  // Strokes written one after another are laid out left to right and top to bottom; bars keep lines
  // of their own, while loose ends line up.
  const cost = (/** @type {Map<number, number>} */ levels, /** @type {Set<number>} */ bands, /** @type {{ find: (i: number) => number }} */ axis) => {
    let sum = 0
    const ids = idsOf(axis)
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = levels.get(ids[i]) ?? 0, b = levels.get(ids[j]) ?? 0
      const bars = bands.has(ids[i]) && bands.has(ids[j])
      sum += a > b ? 3 : a === b ? (bars ? 1 : 0) : bars ? 0 : 0.5
    }
    return sum
  }
  const cx = ox.map(o => cost(o, bandX, xs)), cy = oy.map(o => cost(o, bandY, ys))
  const ringOf = (/** @type {Segment} */ s, /** @type {Map<number, number>} */ lx, /** @type {Map<number, number>} */ ly) =>
    [lx.get(xs.find(s.from)) ?? 0, -(ly.get(ys.find(s.from)) ?? 0), lx.get(xs.find(s.to)) ?? 0, -(ly.get(ys.find(s.to)) ?? 0)]
  const joined = (/** @type {Segment} */ a, /** @type {Segment} */ b) =>
    [a.from, a.to].some(p => [b.from, b.to].some(q => points.find(p) === points.find(q)))
  /** How many joins and crossings a drawing breaks, its segments as `[x0, y0, x1, y1]`;
   *  counting stops past `most`. @param {number[][]} rings @param {number} [most] */
  const breaks = (rings, most = Infinity) => {
    let sum = 0
    const crossed = new Set()
    for (let a = 0; a < segments.length && sum <= most; a++) for (let b = a + 1; b < segments.length; b++) {
      const sa = segments[a], sb = segments[b]
      if (sa.stroke === sb.stroke && b === a + 1) continue
      const how = meeting(rings[a], rings[b])
      if (!how) continue
      const declared = crossings.has(`${sa.stroke},${sb.stroke}`)
      if (how === 'cross' && declared) { crossed.add(`${sa.stroke},${sb.stroke}`); continue }
      if (joined(sa, sb) && how === 'touch' && (sa.stroke !== sb.stroke)) {
        // Ends that meet may touch there; lying along each other is an overlap.
        const along = (rings[a][0] === rings[a][2] && rings[b][0] === rings[b][2]) || (rings[a][1] === rings[a][3] && rings[b][1] === rings[b][3])
        if (!along) continue
        const axis = rings[a][0] === rings[a][2] ? 1 : 0
        const lap = Math.min(Math.max(rings[a][axis], rings[a][axis + 2]), Math.max(rings[b][axis], rings[b][axis + 2]))
          - Math.max(Math.min(rings[a][axis], rings[a][axis + 2]), Math.min(rings[b][axis], rings[b][axis + 2]))
        if (lap <= 0) continue
      }
      sum++
    }
    for (const pair of crossings) if (!crossed.has(pair)) sum++
    return sum
  }
  let best = null, broken = Infinity, least = Infinity
  ox.forEach((lx, i) => oy.forEach((ly, j) => {
    const sum = cx[i] + cy[j]
    if (broken === 0 && sum >= least) return
    const count = breaks(segments.map(s => ringOf(s, lx, ly)), broken)
    if (count < broken || (count === broken && sum < least)) { broken = count; least = sum; best = { lx, ly } }
  }))
  if (!best) return null
  const { lx, ly } = /** @type {{ lx: Map<number, number>, ly: Map<number, number> }} */ (best)
  /** Where each line stands, 0 to 1, after the room its neighbours need.
   *  @param {Map<number, number>} levels @param {0 | 1} d @param {boolean} [even] Equal steps. */
  const spread = (levels, d, even = false) => {
    const most = Math.max(...levels.values())
    if (even) return new Map([...levels].map(([id, level]) => [id, most ? level / most : 0.5]))
    const rings = segments.map(s => ringOf(s, lx, ly).map((v, i) => i % 2 ? -v : v))
    const o = 1 - d
    const spans = (/** @type {number} */ level) => rings.filter((r, i) => STEP[segments[i].kind][d] === 0 && r[d] === level)
      .map(r => [Math.min(r[o], r[o + 2]), Math.max(r[o], r[o + 2])])
    const at = [0]
    for (let k = 0; k < most; k++) {
      const a = spans(k), b = spans(k + 1)
      const facing = a.some(p => b.some(q => Math.min(p[1], q[1]) > Math.max(p[0], q[0])))
      const joins = rings.some(r => Math.min(r[d], r[d + 2]) === k && Math.max(r[d], r[d + 2]) === k + 1)
      at.push(at[k] + (facing || joins && !(a.length && b.length) ? OPEN : a.length && b.length ? OFFSET : PASS))
    }
    return new Map([...levels].map(([id, level]) => [id, most ? at[level] / at[most] : 0.5]))
  }
  // Retain proportions from the reference only if every endpoint, turn, and
  // crossing still holds after horizontal and vertical bars have been aligned.
  const source = measured[text]
  if (source && source.length === count * 2) {
    const coords = (/** @type {typeof xs} */ axis, /** @type {number} */ d) => {
      const sums = new Map(), counts = new Map()
      for (let i = 0; i < count; i++) {
        const id = axis.find(i)
        sums.set(id, (sums.get(id) ?? 0) + source[2 * i + d])
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      const values = [...sums].map(([id, sum]) => [id, sum / counts.get(id)])
      const lo = Math.min(...values.map(v => v[1])), hi = Math.max(...values.map(v => v[1]))
      return new Map(values.map(([id, value]) => [id, hi === lo ? 0.5 : (value - lo) / (hi - lo)]))
    }
    const x = coords(xs, 0), y = coords(ys, 1)
    if (bx.every(([a, b]) => (x.get(a) ?? Infinity) < (x.get(b) ?? -Infinity)) && by.every(([a, b]) => (y.get(a) ?? Infinity) < (y.get(b) ?? -Infinity)) &&
        breaks(segments.map(s => ringOf(s, x, y))) === 0) {
      return { strokes, segments, xs, ys, points, x, y, broken: 0 }
    }
  }
  // Uneven steps turn a diagonal, and may carry it over another stroke: such a chain keeps even ones.
  const [x, y] = [spread(lx, 0), spread(ly, 1)]
  const kept = breaks(segments.map(s => ringOf(s, x, y))) <= broken
  return { strokes, segments, xs, ys, points, x: kept ? x : spread(lx, 0, true), y: kept ? y : spread(ly, 1, true), broken }
}

const RASTER = 240

/** The bars of a stroke's glyph along one axis: each line's `[lo, hi]` in font units, in the order
 *  the axis runs (right, up); a line with no bar is a point (`lo === hi`).
 *  @param {any} part @param {0 | 1} d @param {boolean[]} bars Whether each line, low to high, is a bar. */
function linesOf(part, d, bars) {
  const [lo, hi] = [part.box[d], part.box[d + 2]]
  const ink = fill(rings(part.contours, part.contours.map((/** @type {any} */ c) => c.light), 4), RASTER, part.box)
  // The longest run of ink along each row (d = 1) or column, low to high; row 0 is the top.
  const runs = Array.from({ length: RASTER }, (_, k) => {
    let best = 0, run = 0
    for (let i = 0; i < RASTER; i++) {
      run = ink[d ? (RASTER - 1 - k) * RASTER + i : i * RASTER + k] ? run + 1 : 0
      if (run > best) best = run
    }
    return best
  })
  const unit = (hi - lo) / RASTER
  /** The bar round the longest run within rows `from`..`to`. @param {number} from @param {number} to */
  const bar = (from, to) => {
    let peak = from
    for (let k = from; k < to; k++) if (runs[k] > runs[peak]) peak = k
    let a = peak, b = peak
    while (a > from && runs[a - 1] > runs[peak] * 0.55) a--
    while (b < to - 1 && runs[b + 1] > runs[peak] * 0.55) b++
    return [lo + a * unit, lo + (b + 1) * unit]
  }
  const n = bars.length
  return bars.map((isBar, i) => {
    const at = n === 1 ? 0.5 : i / (n - 1)
    if (!isBar) return [lo + (hi - lo) * at, lo + (hi - lo) * at]
    if (n === 1) return bar(0, RASTER)
    const near = Math.floor(RASTER * 0.3)
    if (i === 0) return bar(0, near)
    if (i === n - 1) return bar(RASTER - near, RASTER)
    const mid = Math.round(RASTER * at), reach = Math.round(RASTER / n)
    return bar(Math.max(0, mid - reach), Math.min(RASTER, mid + reach))
  })
}

/** A coordinate carried through matching anchors, straight between them. @param {number[][]} anchors */
const through = anchors => (/** @type {number} */ v) => {
  if (anchors.length === 1) return v + anchors[0][1] - anchors[0][0]
  let k = 0
  while (k < anchors.length - 2 && v > anchors[k + 1][0]) k++
  const [a, b] = [anchors[k], anchors[k + 1]]
  // Ink outside the outermost lines (a serif, a hook's tip) keeps its size.
  if (v < a[0] && k === 0) return v + a[1] - a[0]
  if (v > b[0]) return v + b[1] - b[0]
  return a[1] + (v - a[0]) * (b[1] - a[1]) / Math.max(b[0] - a[0], 1e-6)
}

/**
 * A chain as a component form: its strokes' glyphs joined, or null where the chain has no drawing or
 * a stroke no glyph. @param {string} text @param {(char: string) => any} glyphOf
 * @returns {{ parts: any[], frame: number[], ink: number, solved: any } | null}
 */
export function chainForm(text, glyphOf) {
  const solved = solveChain(text)
  // A solution that breaks a join or a declared crossing is no drawing of the chain.
  if (!solved || solved.broken) return null
  const glyphs = solved.strokes.map(s => glyphOf(s.char))
  if (glyphs.some(g => !g)) return null
  /** Each stroke's lines along x and y: the axis lines it stands on, low to high, and their bars. */
  const strokes = solved.strokes.map((stroke, i) => {
    const own = solved.segments.filter(s => s.stroke === i)
    return [0, 1].map(d => {
      const axis = d ? solved.ys : solved.xs, place = d ? solved.y : solved.x
      const at = (/** @type {number} */ id) => (d ? 1 - (place.get(id) ?? 0) : place.get(id) ?? 0)
      const ids = [...new Set(stroke.at.map(v => axis.find(v)))].sort((a, b) => at(a) - at(b))
      const bars = ids.map(id => own.some(s => STEP[s.kind][d] === 0 && axis.find(s.from) === id))
      return { ids, bars, lines: linesOf(glyphs[i], /** @type {0 | 1} */ (d), bars), at }
    })
  })
  const half = [new Map(), new Map()]
  for (const axes of strokes) axes.forEach(({ ids, bars, lines }, d) => ids.forEach((id, k) => {
    if (bars[k]) half[d].set(id, Math.max(half[d].get(id) ?? 0, (lines[k][1] - lines[k][0]) / 2))
  }))
  const parts = strokes.map((axes, i) => {
    const maps = axes.map(({ ids, bars, lines, at }, d) => {
      const anchors = ids.flatMap((id, k) => {
        const centre = BOX[d] + (BOX[d + 2] - BOX[d]) * at(id), [lo, hi] = lines[k]
        if (bars[k]) return [[lo, centre - (hi - lo) / 2], [hi, centre + (hi - lo) / 2]]
        // A loose end meets the far edge of the bar it joins, so the corner is whole.
        const edge = half[d].get(id) ?? 0
        return [[lo, centre + (ids.length === 1 ? 0 : k === 0 ? -edge : k === ids.length - 1 ? edge : 0)]]
      })
      // Two bars too close to stretch between keep their order.
      for (let k = 1; k < anchors.length; k++) anchors[k][1] = Math.max(anchors[k][1], anchors[k - 1][1] + 1)
      return through(anchors)
    })
    const contours = glyphs[i].contours.map((/** @type {any} */ c) => {
      const light = new Float64Array(c.light.length), heavy = new Float64Array(c.light.length)
      for (let k = 0; k < light.length; k++) {
        light[k] = maps[k % 2](c.light[k])
        heavy[k] = light[k] + c.heavy[k] - c.light[k]
      }
      return { ...c, light, heavy }
    })
    return derived(glyphs[i], contours)
  })
  return { parts, frame: union(parts.map(p => p.box)), ink: parts.reduce((n, p) => n + partInk(p), 0), solved }
}

/** Whether a component is a stroke chain no character is read for. @param {any} text */
export const isChain = text => typeof text === 'string' && text.startsWith('#(') && customAt([...text])?.kind === 'chain'

/** How much of a required wall a room must have. */
const LEAST_WALL = 0.3

/**
 * The box an enclosure's inner part goes into: the grid cells of a chain with ink on the sides the
 * operator closes and, as far as it can be, none on the others. `taken` are boxes other parts hold.
 * Boxes are in the chain's own em units, or null where no cell qualifies.
 * @param {any} solved @param {string} sides The closed sides, of `LRBT`. @param {number[][]} [taken]
 * @returns {number[] | null}
 */
export function chainRoom(solved, sides, taken = []) {
  const X = (/** @type {number} */ v) => BOX[0] + (BOX[2] - BOX[0]) * solved.x.get(solved.xs.find(v))
  const Y = (/** @type {number} */ v) => BOX[3] - (BOX[3] - BOX[1]) * solved.y.get(solved.ys.find(v))
  /** @type {number[][]} */
  const walls = solved.segments.map((/** @type {Segment} */ s) => [X(s.from), Y(s.from), X(s.to), Y(s.to)])
  const lines = (/** @type {0 | 1} */ d) => [...new Set([BOX[d], BOX[d + 2], ...walls.flatMap(w => [w[d], w[d + 2]])].map(v => Math.round(v)))].sort((a, b) => a - b)
  const xs = lines(0), ys = lines(1)
  /** The share of the edge at `at` from `lo` to `hi` that bars along axis `d` cover. */
  const wall = (/** @type {0 | 1} */ d, /** @type {number} */ at, /** @type {number} */ lo, /** @type {number} */ hi) => {
    const o = 1 - d
    let sum = 0
    for (const w of walls) {
      if (Math.abs(w[o] - at) > 1 || Math.abs(w[o + 2] - at) > 1) continue
      sum += Math.max(0, Math.min(hi, Math.max(w[d], w[d + 2])) - Math.max(lo, Math.min(w[d], w[d + 2])))
    }
    return Math.min(1, sum / (hi - lo))
  }
  const clear = (/** @type {number[]} */ b) => walls.every(w => {
    for (let k = 0; k <= 24; k++) {
      const x = w[0] + (w[2] - w[0]) * k / 24, y = w[1] + (w[3] - w[1]) * k / 24
      if (x > b[0] + 2 && x < b[2] - 2 && y > b[1] + 2 && y < b[3] - 2) return false
    }
    return true
  })
  let best = null, most = -Infinity
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++)
    for (let k = 0; k < ys.length; k++) for (let l = k + 1; l < ys.length; l++) {
      const b = [xs[i], ys[k], xs[j], ys[l]]
      if (taken.some(t => Math.min(t[2], b[2]) - Math.max(t[0], b[0]) > 2 && Math.min(t[3], b[3]) - Math.max(t[1], b[1]) > 2) || !clear(b)) continue
      const cover = { L: wall(1, b[0], b[1], b[3]), R: wall(1, b[2], b[1], b[3]), B: wall(0, b[1], b[0], b[2]), T: wall(0, b[3], b[0], b[2]) }
      const closed = Object.entries(cover).filter(([side]) => sides.includes(side)).map(([, c]) => c)
      if (Math.min(...closed) < LEAST_WALL) continue
      const open = Object.entries(cover).filter(([side]) => !sides.includes(side)).map(([, c]) => 1 - c)
      const score = closed.reduce((n, c) => n + c, 0) + open.reduce((n, c) => n + c, 0)
        + (b[2] - b[0]) * (b[3] - b[1]) / ((BOX[2] - BOX[0]) * (BOX[3] - BOX[1]))
      if (score > most) { most = score; best = b }
    }
  return best
}
