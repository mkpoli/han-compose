import { backwards, derived, partInk, partOf, pointsBox, segments } from './geometry.js'
import { hexOf } from './sha256.js'

// 統外字登記, row 579. The counter and lower bend are those of 巳.
// https://rare.glyphatlas.org/en/entry/3156
export const SI_CHAIN = '#(一-𠃍㇄)'

// Each cut is indexed by on-curve endpoint, with implied quadratic points resolved.
// The first pair brackets the hook of 巳. The second brackets the straight terminal
// of ㇄ (the bottom bar of 匚 in Zhuque Fangsong, whose export lacks a native ㇄).
/** @type {Record<string, {host: string, donor: string, contour: number, hook: number[], tip: number[]}>} */
const cuts = {
  sans: {
    host: 'de0b6d6134cde0e609ddf1a98f62a31050a49b56819903ad1790f1723c3b9faa',
    donor: '5d70127199af0b3ba631adc63c51dee9e7245ffeb8b49f7692a88a016fcd2ccf',
    contour: 2, hook: [10, 20], tip: [8, 15],
  },
  serif: {
    host: '51a7d11c05b489d0305acf48e85192eea2652ab9d1d3890c55d7fc268c10a828',
    donor: '76f1a37fad39ebae4b1c0ff892294832f39e38265f4bfdb1f6b58bf9636e750b',
    contour: 1, hook: [4, 19], tip: [6, 19],
  },
  fangsong: {
    host: '27bb947f9fdd19422d09e77a73cc3d32428c194b1ba2bd3df64ef08fd47f2905',
    donor: '1b5b0e859f281293ee942ca0474287ea9421a9789f613551802191df644705ef',
    contour: 0, hook: [38, 59], tip: [25, 36],
  },
  regular: {
    host: '8e72db43ae2788f9ed8084d8b2f61a64067e4d83002f6e093bb07f11e99dbef3',
    donor: '6309b7c9909c76dd95d91e562385f801c497825cc69fa557efbd5f24e8803e0c',
    contour: 0, hook: [18, 41], tip: [21, 35],
  },
  'pen-writing': {
    host: 'a160d275562817e739d6717abcbe8c2464d0990ac52ed945bcbbf7a55217d119',
    donor: '552ed11486c496b4d0f28ca96ee128fc6a0fc3df1ca029ad99be03c16fea9d26',
    contour: 0, hook: [36, 9], tip: [13, 21],
  },
}

export const siTerminal = (/** @type {string} */ style) => style === 'fangsong' ? '匚' : '㇄'

/** @typedef {[string, number[][]]} Segment */
/** @param {Segment} segment */
const end = ([, points]) => points[points.length - 1]

/** @param {import('./compose.js').Composer} composer */
export function siChainForm(composer) {
  const style = composer.fontStyle, terminal = siTerminal(style)
  if (!Object.hasOwn(cuts, style)) return null
  const cut = cuts[style]
  if ([SI_CHAIN, '巳', '一', '𠃍', '㇄', terminal].some(char => composer.excluded(char))) return null
  const host = composer.glyphRecord('巳'), stroke = composer.glyphRecord(terminal)
  if (host?.v !== 1 || stroke?.v !== 1 ||
      hexOf(JSON.stringify(host.p)) !== cut.host || hexOf(JSON.stringify(stroke.p)) !== cut.donor) return null

  const glyph = partOf(host), body = glyph.contours[cut.contour], foot = partOf(stroke).contours[0]
  const [hookStart, hookEnd] = cut.hook, [first, last] = cut.tip
  /** Keep the terminal's width and match its two edges to the host foot in each master.
   * @param {'light' | 'heavy'} master @returns {Segment[]} */
  const splice = master => {
    const path = /** @type {Segment[]} */ (segments(body.ops, body[master]))
    const donor = segments(foot.ops, foot[master])
    // The pen face winds 巳 the other way and starts its contour inside the hook.
    const tip = /** @type {Segment[]} */ (hookStart > hookEnd ? backwards(donor) : donor)
    const dx = pointsBox(body[master])[2] - pointsBox(foot[master])[2]
    const y = end(tip[first])[1], base = end(path[hookStart])[1]
    const sy = (end(path[hookEnd])[1] - base) / (end(tip[last])[1] - y)
    /** @param {number[]} point */
    const move = ([x, v]) => [x + dx, base + (v - y) * sy]
    /** @type {Segment[]} */
    const cap = [['L', [move(end(tip[first]))]]]
    for (const [op, points] of tip.slice(first + 1, last + 1)) cap.push([op, points.map(move)])
    cap.push(['L', [end(path[hookEnd])]])
    return hookStart > hookEnd ? [['M', [end(path[hookEnd])]], ...path.slice(hookEnd + 1, hookStart + 1), ...cap]
      : [...path.slice(0, hookStart + 1), ...cap, ...path.slice(hookEnd + 1)]
  }
  const light = splice('light'), heavy = splice('heavy')
  /** @param {Segment[]} path */
  const coordinates = path => Float64Array.from(path.flatMap(([, points]) => points.flat()))
  const joined = { ...body, ops: light.map(([op, points]) => [op, points.length, false]),
    light: coordinates(light), heavy: coordinates(heavy) }
  const contours = glyph.contours.slice()
  contours[cut.contour] = joined
  // Keep the host's weight calibration and positional metrics when fitting compounds.
  const part = { ...derived(glyph, contours, glyph.box), inkLength: partInk(glyph) }
  const { f, u, ink } = composer.rec('巳')
  return { part, f, u, ink, o: contours.length }
}
