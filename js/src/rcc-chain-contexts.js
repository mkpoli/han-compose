import componentCuts from './rcc-component-cuts.json' with { type: 'json' }
import { derived, mapped, partInk, partOf, placed, rings, segments, union } from './geometry.js'
import { hexOf } from './sha256.js'

const water = '⿰氵⿱亠⿶#(𠃍-𠃊一)凵'
const speech = '⿰讠⿹⿸⿻#(-亅一)一犬丶'
const tiger = '⿱⺊⿸#(-乛丿)노'
const horse = '⿱⿷#(-一丨b𠃌)𰀁乙'

/** @typedef {[number, number, number]} Run */
/** @typedef {[string, number[][]]} Segment */

// R+06F3 describes its exterior as ㇯虍七. The native upper and side
// strokes of 虍 surround the Korean syllable in the photographed character.
// https://rare.glyphatlas.org/en/entry/1779#sighting-1857
/** @type {Map<string, {digest: string, head: (number | Run)[], cliff: (number | Run)[], removed: number[]}>} */
const tigerCuts = new Map([
  ['sans', { digest: 'b384e70877dd6886c56d027c80ad717ad1b27bd7c3708b2c32b94aed1d2d4cd4',
    head: [0, 2], cliff: [1, 5, 6], removed: [3, 4] }],
  ['serif', { digest: '1cf7532f70a87e2e425b9b6026c62f250339a690cc9806693624dffa366d307c',
    head: [4, 6], cliff: [2, 3, 5], removed: [0, 1] }],
  ['regular', { digest: '326bc25a5f31bc4f817fd3c199b8f65e944048975fcb8133403901f8a8241fc1',
    head: [[0, 0, 32]], cliff: [[0, 32, 0]], removed: [1] }],
  ['fangsong', { digest: '3b8fd4d245463e60cf88b2a35f714681b84af49a310d446aa7b76f443706f3d2',
    head: [[0, 13, 36]], cliff: [[0, 36, 13]], removed: [1] }],
  ['pen-writing', { digest: 'f838989212785c13290143cd877ea982a63feb9360ffc031a5cfa7a4d70f3492',
    head: [[0, 15, 34]], cliff: [[0, 34, 15]], removed: [1] }],
])

// R+07B4 gives ⿱㇯馬灬乙. The cut keeps the exterior and 𰀁 of 馬,
// partitioned along the joins between their strokes, with all four dots omitted.
// https://rare.glyphatlas.org/en/entry/1972#sighting-2072
// https://github.com/yi-bai/ids/blob/2597437b928e8d530b7ae09cf53fe5ec7868569c/ids_lv2.txt
/** @type {Map<string, {digest: string, outer: (number | Run)[], inner: (number | Run)[], removed: number[]}>} */
const horseCuts = new Map([
  ['sans', {
    digest: 'ad7319b40dc5b3cc8fd77149c8a10c231b9afe2d390d9a941a5fb13db62224b5',
    outer: [2, 3, 9], inner: [0, 1, 8], removed: [4, 5, 6, 7],
  }],
  ['serif', {
    digest: '20e002be87558b3701c769ea6c31884cc31615386f0a895aee0de57eb846d07d',
    outer: [0, 3, 4, 9], inner: [1, 2, 10], removed: [5, 6, 7, 8],
  }],
  ['pen-writing', {
    digest: '3d9c015a2ed603c84a951b5c19d4654b79a317b5c4151b56cc0f981b2ce7c97e',
    // The two bars meet the left stem along three enclosed counters.
    outer: [[0, 40, 20], [3, 1, 3], [2, 2, 3], [1, 2, 0]],
    inner: [[0, 20, 40], [1, 0, 2], [2, 3, 2], [3, 3, 1]], removed: [4, 5, 6, 7],
  }],
  ['fangsong', {
    digest: '997aafc290221658dc9ea3208cc7cd815a9b5069b651062f2080768792924be1',
    outer: [[0, 71, 47], [5, 15, 0]],
    inner: [[0, 47, 71], [5, 0, 15]], removed: [1, 2, 3, 4],
  }],
  ['regular', {
    digest: '9dbb41716e381d96f861222bfcbfe322b521b912873ad2fae37ebbe6ae95bd1c',
    outer: [[0, 29, 0], [3, 5, 0], [2, 4, 0], [1, 6, 0]],
    inner: [[0, 0, 29], [1, 0, 6], [2, 0, 4], [3, 0, 5]], removed: [4, 5, 6, 7],
  }],
])

/** Connect exact runs of the donor contours with straight chords at the stroke
 * junctions. Paired cuts cross every chord in opposite directions.
 * @param {any} glyph @param {Run[]} runs */
function outlineThrough(glyph, runs) {
  /** @param {'light' | 'heavy'} master */
  const assemble = master => {
    /** @type {Segment[]} */
    const path = []
    for (const [index, start, end] of runs) {
      const contour = glyph.contours[index]
      const source = /** @type {Segment[]} */ (segments(contour.ops, contour[master]))
      path.push([path.length ? 'L' : 'M', source[start][1].slice(-1)])
      for (let i = start; i !== end;) {
        i = (i + 1) % source.length
        path.push(i ? source[i] : ['L', source[0][1]])
      }
    }
    return path
  }
  const light = assemble('light'), heavy = assemble('heavy')
  /** @param {Segment[]} path */
  const coordinates = path => Float64Array.from(path.flatMap(([, points]) => points.flat()))
  return derived(glyph, [{
    ops: light.map(([op, points]) => [op, points.length, false]),
    light: coordinates(light), heavy: coordinates(heavy), width: glyph.contours[0].width,
  }], undefined)
}

/** @param {import('./compose.js').Composer} composer @param {string} char @param {string} [digest] */
function native(composer, char, digest) {
  const record = composer.glyphRecord(char)
  if (record?.v !== 1 || (digest && hexOf(JSON.stringify(record.p)) !== digest)) return null
  return partOf(record)
}

/** The left radicals in 讨 and 汴 and the compact right-hand 犬 in 狀.
 * Their contour indices belong to the pinned primary-face glyph records.
 * https://github.com/yi-bai/ids/blob/2597437b928e8d530b7ae09cf53fe5ec7868569c/ids_lv0.txt
 * @type {Record<string, Record<string, [string, number[]]>>} */
const sides = /** @type {any} */ (componentCuts)

/** @param {import('./compose.js').Composer} composer @param {string} host @param {string} fallback */
function sideGlyph(composer, host, fallback) {
  const cut = sides[host]?.[composer.fontStyle]
  const glyph = cut && native(composer, host, cut[0])
  return glyph ? { ...derived(glyph, cut[1].map(i => glyph.contours[i])), sourceHost: host } : native(composer, fallback)
}

/** @param {number[]} box @param {number[]} fractions */
const subBox = (box, fractions) => mapped(fractions, [0, 0, 1, 1], box)

const tigerSubtraction = '⿸㇯虍七노'
const horseSubtraction = '⿱㇯馬灬乙'
const design = new Map([[water, water], [speech, speech], [tiger, tiger], [tigerSubtraction, tiger],
  [horse, horse], [horseSubtraction, horse]])

/** @param {string} key @param {string} style */
export function rccChainDonors(key, style) {
  switch (design.get(key)) {
  case water: return ['氵', '亠', '凵', '汴']
  case speech: return ['讠', '亅', '一', '丶', '犬', '讨', '狀', ...(style === 'fangsong' ? ['小'] : [])]
  case tiger: return style === 'fangsong' ? ['虍', '凵', '丄'] : ['虍', 'ㄴ', 'ㅗ']
  case horse: return ['馬', '乙']
  default: return []
  }
}

const operands = new Map([
  [water, ['#(𠃍-𠃊一)', '𠃍', '𠃊', '一']],
  [speech, ['#(-亅一)']],
  [tiger, ['⺊', '#(-乛丿)', '乛', '丿', '노', '七']],
  [horse, ['#(-一丨b𠃌)', '一', '丨', '𠃌', '𰀁', '灬']],
])

/** @param {any} glyph @param {(number | Run)[]} cut */
function piece(glyph, cut) {
  const runs = cut.filter((/** @type {any} */ index) => Array.isArray(index))
  return runs.length ? outlineThrough(glyph, /** @type {Run[]} */ (runs))
    : derived(glyph, cut.map(index => glyph.contours[/** @type {number} */ (index)]))
}

/** Intersections with x or y fixed, in alternating ink and clear spans.
 * @param {number[][]} lines @param {number} axis @param {number} station */
function intersections(lines, axis, station) {
  const hit = [], across = 1 - axis
  for (const ring of lines) for (let i = 0; i < ring.length; i += 2) {
    const j = (i + 2) % ring.length, a = ring[i + axis], b = ring[j + axis]
    if ((a <= station && station < b) || (b <= station && station < a)) {
      hit.push(ring[i + across] + (station - a) / (b - a) * (ring[j + across] - ring[i + across]))
    }
  }
  return hit.sort((a, b) => a - b)
}

/** Preserve native pen widths when reducing a broad U or jamo to a narrow
 * interior. Sample through its upright(s) and across its lower bar, then
 * shorten the clear intervals between their contours.
 * @param {number} lo @param {number} hi @param {number} left @param {number} right
 * @param {number[]} hits @param {number} pen */
function spanMap(lo, hi, left, right, hits, pen) {
  const linear = (/** @type {number} */ x) => left + (x - lo) * (right - left) / (hi - lo)
  if (!hits.length || hits.length % 2) return linear
  const bounds = [lo, ...hits.map(x => Math.min(hi, Math.max(lo, x))), hi]
  const ink = hits.reduce((sum, x, i) => i % 2 ? sum + x - hits[i - 1] : sum, 0)
  const clear = hi - lo - ink
  if (clear < 1) return linear
  const inScale = Math.min(pen, (right - left) * 0.72 / Math.max(1, ink))
  const clearScale = (right - left - ink * inScale) / clear
  return (/** @type {number} */ x) => {
    let out = left
    for (let i = 1; i < bounds.length; i++) {
      const scale = i % 2 ? clearScale : inScale
      if (x <= bounds[i] || i === bounds.length - 1) return out + (x - bounds[i - 1]) * scale
      out += (bounds[i] - bounds[i - 1]) * scale
    }
    return right
  }
}

/** @param {any} glyph @param {number[]} target @param {number} pen
 * @param {((x: number) => number | null) | null} ceiling @param {number} height */
function narrow(glyph, target, pen, ceiling = null, height = 0.57) {
  const [l, b, r, t] = glyph.box, [x0, y0, x1, y1] = target
  const lines = /** @type {number[][]} */ (rings(glyph.contours, glyph.contours.map((/** @type {any} */ c) => c.light), 12))
  const upright = intersections(lines, 1, b + height * (t - b))
  const foot = intersections(lines, 0, l + 0.71 * (r - l))
  const mapX = spanMap(l, r, x0, x1, upright, pen)
  const mapY = spanMap(b, t, y0, y1, foot, pen)
  const mid = (l + r) / 2
  // The two suspended uprights end at different heights in Kai. Each meets
  // the sloping underside of 亠 at its own position.
  const lift = [0, 0]
  if (ceiling && upright.length === 4) {
    for (const side of [0, 1]) {
      const x = mapX((upright[2 * side] + upright[2 * side + 1]) / 2), roof = ceiling(x)
      const tops = lines.flatMap(ring => ring.filter((_, i) => i % 2 && (side ? ring[i - 1] > mid : ring[i - 1] < mid)))
      if (roof !== null && tops.length) lift[side] = roof + 7 * pen - mapY(Math.max(...tops))
    }
  }
  /** @param {Float64Array} points */
  const fit = points => {
    const out = points.slice()
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i], y = points[i + 1]
      out[i] = mapX(x)
      out[i + 1] = mapY(y) + lift[Number(x > mid)] * Math.max(0, Math.min(1, (y - b) / (t - b)))
    }
    return out
  }
  return derived(glyph, glyph.contours.map((/** @type {any} */ c) => ({ ...c, light: fit(c.light), heavy: fit(c.heavy) })))
}

/** The manuscript's 乙 has a short rising entry under the body of 馬.
 * Carry the upper part of the native stroke inward, leaving the broad foot.
 * @param {any} glyph */
function horseFoot(glyph) {
  const [left, bottom, right, top] = glyph.box, h = top - bottom, w = right - left
  /** @param {Float64Array} points */
  const curve = points => {
    const out = points.slice()
    for (let i = 0; i < points.length; i += 2) {
      const x = (points[i] - left) / w, y = (points[i + 1] - bottom) / h
      const upper = Math.max(0, Math.min(1, (y - 0.38) / 0.56))
      out[i] -= w * 0.31 * x * upper
      out[i + 1] -= h * 0.22 * (1 - x) * upper
    }
    return out
  }
  return derived(glyph, glyph.contours.map((/** @type {any} */ c) => ({ ...c, light: curve(c.light), heavy: curve(c.heavy) })))
}

/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export function rccChainContextParts(composer, key, region) {
  const id = design.get(key)
  if (!id) return null
  const donors = rccChainDonors(key, composer.fontStyle)
  if ([key, ...donors, ...(operands.get(id) ?? [])].some(char => composer.excluded(char))) return null
  /** @param {any} part @param {number[]} target @param {string} origin @param {number} rccLeaf */
  const draw = (part, target, origin, rccLeaf) => ({ ...placed(part, part.box, target, partInk(part), origin), fixed: true, rccLeaf })
  /** @param {any} part @param {number[]} at @param {string} origin @param {number} leaf */
  const set = (part, at, origin, leaf) => draw(part, subBox(region, at), origin, leaf)

  /** The document renderer scopes ㇯ to its two operands. Restore the removed
   * strokes to the left operand and give the right operand the matching shapes.
   * Their cancellation is already reflected in the visible cut-host outlines.
   * @param {any[]} kept @param {any} glyph @param {number[]} removed @param {number[]} frame
   * @param {number[]} target @param {string} char @param {string} subtract */
  const subtraction = (kept, glyph, removed, frame, target, char, subtract) => {
    const take = piece(glyph, removed), box = mapped(take.box, frame, target)
    return [...kept.map(p => ({ ...p, rccLeaf: 0 })),
      { ...draw(take, box, `${subtract} of ${char}`, 0), operandOnly: true },
      { ...draw(take, box, `${subtract} from ${char}`, 1), operandOnly: true }]
  }

  if (id === water) {
    // 饶秉才, 兴宁客家话词典 (2017), p. 103, index p. 71. The inner U
    // hangs directly from 亠; the outer U rises beside it from the baseline.
    // https://rare.glyphatlas.org/en/entry/444#sighting-449
    const drops = sideGlyph(composer, '汴', '氵'), lid = native(composer, '亠'), cup = native(composer, '凵')
    if (!drops || !lid || !cup) return null
    const roof = subBox(region, [0.27, 0.77, 1, 0.99])
    const lines = /** @type {number[][]} */ (rings(lid.contours, lid.contours.map((/** @type {any} */ c) => c.light), 12))
    const ceiling = (/** @type {number} */ x) => {
      const nativeX = lid.box[0] + (x - roof[0]) / (roof[2] - roof[0]) * (lid.box[2] - lid.box[0])
      const [y] = intersections(lines, 0, nativeX)
      return y === undefined ? null : roof[1] + (y - lid.box[1]) / (lid.box[3] - lid.box[1]) * (roof[3] - roof[1])
    }
    const pen = (region[2] - region[0]) / 1000
    const inner = narrow(cup, subBox(region, [0.46, 0.23, 0.84, 0.80]), pen, ceiling)
    const outer = narrow(cup, subBox(region, [0.31, 0.01, 0.99, 0.63]), pen)
    return [set(drops, [0, 0, 0.31, 1], drops.sourceHost ? '氵 from 汴' : 'glyph 氵', 0), draw(lid, roof, 'glyph 亠', 1),
      draw(inner, inner.box, 'inner 凵', 3), draw(outer, outer.box, 'outer 凵', 2)]
  }

  if (id === speech) {
    // The photographed 讨厌 ligature shares its long vertical hook. A short
    // horizontal crosses the upright below the roof; the dot lies on its left.
    // https://rare.glyphatlas.org/en/entry/2120#sighting-2240
    const radical = sideGlyph(composer, '讨', '讠'), hook = composer.chainStroke('亅'), bar = native(composer, '一')
    const dot = composer.chainStroke('丶'), dog = sideGlyph(composer, '狀', '犬')
    if (!radical || !hook || !bar || !dot || !dog) return null
    const pen = (region[2] - region[0]) / 1000
    const left = narrow(radical, subBox(region, [0, 0, 0.27, 1]), pen, null, 0.35)
    const upright = narrow(hook, subBox(region, [0.29, 0.01, 0.51, 0.96]), pen)
    return [draw(left, left.box, radical.sourceHost ? '讠 from 讨' : 'glyph 讠', 0), draw(upright, upright.box, 'vertical 亅', 1),
      set(bar, [0.45, 0.91, 1, 0.98], 'roof 一', 1), set(bar, [0.20, 0.71, 0.55, 0.79], 'crossing 一', 2),
      set(dog, [0.47, 0, 1, 0.84], dog.sourceHost ? '犬 from 狀' : 'glyph 犬', 3), set(dot, [0.23, 0.35, 0.39, 0.62], 'glyph 丶', 4)]
  }

  if (id === tiger) {
    const cut = tigerCuts.get(composer.fontStyle)
    if (!cut) return null
    const glyph = native(composer, '虍', cut.digest)
    if (!glyph) return null
    const fang = composer.fontStyle === 'fangsong'
    const consonant = fang ? composer.chainStroke('𠃊') : native(composer, 'ㄴ')
    const vowel = native(composer, fang ? '丄' : 'ㅗ')
    if (!consonant || !vowel) return null
    const head = piece(glyph, cut.head), cliff = piece(glyph, cut.cliff)
    const frame = union([head.box, cliff.box])
    const pen = (region[2] - region[0]) / 1000 * 0.85
    const initial = narrow(consonant, subBox(region, [0.35, 0.29, 0.69, 0.58]), pen)
    const final = narrow(vowel, subBox(region, [0.19, 0.025, 0.80, 0.35]), pen)
    const kept = [draw(head, mapped(head.box, frame, region), '⺊ from 虍', 0),
      draw(cliff, mapped(cliff.box, frame, region), '#(-乛丿) from 虍', 1)]
    const exterior = composer.separate && key === tigerSubtraction
      ? subtraction(kept, glyph, cut.removed, frame, region, '虍', '七') : kept
    return [...exterior, draw(initial, initial.box, 'ㄴ of 노', 2), draw(final, final.box, 'ㅗ of 노', 2)]
  }

  const cut = horseCuts.get(composer.fontStyle)
  if (!cut) return null
  const glyph = native(composer, '馬', cut.digest)
  if (!glyph) return null
  const foot = native(composer, '乙')
  if (!foot) return null
  const body = piece(glyph, cut.outer), inner = piece(glyph, cut.inner)
  const box = union([body.box, inner.box])
  const target = subBox(region, [0.16, 0.28, 0.88, 1])
  const kept = [draw(body, mapped(body.box, box, target), '#(-一丨b𠃌) from 馬', 0),
    draw(inner, mapped(inner.box, box, target), '𰀁 from 馬', 1)]
  const exterior = composer.separate && key === horseSubtraction
    ? subtraction(kept, glyph, cut.removed, box, target, '馬', '灬') : kept
  return [...exterior, set(horseFoot(foot), [0, 0, 1, 0.43], '乙 beneath 馬', 2)]
}
