import { derived, makePart, mapped, partInk, placed } from './geometry.js'
import { nativeAxisContours } from './recorded-axis.js'
import { strokeDonor } from './stroke-donors.js'

// Ink bounds are fractions of the printed character, measured left-to-right and top-to-bottom.
// Each entry cites the RCC sighting in which the placement can be checked.
/** @typedef {[string, number[]]} Member */
/** @type {Map<string, {source: number, members: Member[], operands: string[]}>} */
const forms = new Map([
  // 重校全補海篇直音 (1595), 音体. The short falling stroke joins the top of the hook.
  // https://rare.glyphatlas.org/en/entry/2603#sighting-2767
  ['⿰口#(丿乚)', { source: 2603, operands: ['#(丿乚)'], members: [
    ['口', [0, .26, .41, .83]], ['丿', [.47, 0, .82, .37]], ['乚', [.43, .31, 1, 1]],
  ] }],
  // 中华姓氏源流大辞典 p. 771 and 殷虚卜辞综述 p. 277. The upper short bar crosses
  // the center upright and joins the high left end of the right-hand step.
  // https://rare.glyphatlas.org/en/entry/2630#sighting-2794
  ['⿻[x_]#(㇄-𠃑)𠃊', { source: 2630, operands: ['#(㇄-𠃑)'], members: [
    ['㇄', [0, .10, .78, .43]], ['𠃑', [.72, .11, 1, 1]], ['𠃊', [.35, 0, 1, 1]],
  ] }],
  // Korean 龍龕手鑑, the headword beside 普奸切. The crossing is above the extended
  // hooked foot, with the bottom of 夂 at the height of the right-hand crossbar.
  // https://rare.glyphatlas.org/en/entry/2696#sighting-2860
  ['⿰夂⿻乚#(丿𠃊-丨)', { source: 2696, operands: ['#(丿𠃊-丨)'], members: [
    ['夂', [0, .08, .52, .74]], ['丿', [.49, 0, .78, .42]],
    ['𠃊', [.47, .37, .88, .72]], ['丨', [.85, .32, .94, .74]], ['乚', [.61, .22, 1, 1]],
  ] }],
  // Hanyo-Denshi TK01041310 (U+43DC U+E0101). The falling right stroke
  // starts in the open space between the two falling-left strokes.
  // https://rare.glyphatlas.org/en/entry/2755#sighting-2919
  ['⿰月⿻#(-丿㇋)乀', { source: 2755, operands: ['#(-丿㇋)'], members: [
    ['月', [0, .02, .39, 1]], ['丿', [.37, .01, .60, .99]],
    ['㇋', [.41, 0, .96, .99]], ['乀', [.60, .45, 1, .98]],
  ] }],
  // 笔削鳌头海篇心镜·九部第六, 二音囂聲也. 九 carries the whole upper-right group on its foot.
  // https://rare.glyphatlas.org/en/entry/2830#sighting-2994
  ['⿺九⿸⿻干#(-乛丿)亚', { source: 2830, operands: ['#(-乛丿)', '乛', '丿'], members: [
    ['九', [0, .02, 1, 1]], ['干', [.32, .02, .93, .54]],
    ['丿', [.245, .22, .40, .84]], ['亚', [.43, .45, .89, .82]],
  ] }],
  // 王荣艳 (2023), 〈古本戏曲丛刊〉俗字研究 p. 378, first head under nǎi. The center
  // 日 fits between the shoulders of the two upright 鼎 legs, below 乃.
  // https://rare.glyphatlas.org/en/entry/2903#sighting-3067
  ['⿱乃⿶⿰#(𠃑-一丨)#(丨-一𠃑)日', { source: 2903, operands: ['𠃑', '一', '丨', '亞'], members: [
    ['乃', [.02, 0, .85, .50]], ['#(𠃑-一丨)', [.14, .49, .37, 1]],
    ['#(丨-一𠃑)', [.65, .45, .97, .96]], ['日', [.35, .295, .575, .55]],
  ] }],
])

const stroke = new Set([...'丿乚㇄𠃑𠃊丨㇋乀'])

/** @param {string} key @param {string} style */
export function overlayContextDonors(key, style) {
  const form = forms.get(key)
  if (!form) return []
  if (form.source === 2630) return ['㇄', '𠃑', '𠃊', '丨', '一']
  return [...new Set(form.members.flatMap(([char]) => {
    if (char.startsWith('#(')) return ['亞']
    const donor = stroke.has(char) && strokeDonor(char, style)
    return donor ? [char, donor] : [char]
  }))]
}

// Centerline landmarks of the native ㇋ in the five format-7 exports. The
// two bends and the ending of the corresponding E0101 stroke are visible in
// the Hanyo-Denshi registration. The final sweep runs all the way to the foot.
/** @type {Record<string, number[]>} */
const folds = {
  sans: [.12, .77, .45, .94, .365, .04],
  serif: [.16, .735, .435, .902, .41, .02],
  regular: [.064, .81, .614, .90, .53, .692],
  fangsong: [.055, .817, .623, .918, .52, .704],
  'pen-writing': [.024, .627, .451, .941, .32, .02],
}

/** @param {any} glyph @param {(x: number, y: number) => number[]} transform */
function remap(glyph, transform) {
  const [l, b, r, t] = glyph.box
  /** @param {Float64Array} coords */
  const move = coords => {
    const out = coords.slice()
    for (let i = 0; i < out.length; i += 2) {
      const [x, y] = transform((coords[i] - l) / (r - l), (t - coords[i + 1]) / (t - b))
      out[i] = l + x * (r - l)
      out[i + 1] = t - y * (t - b)
    }
    return out
  }
  return derived(glyph, glyph.contours.map((/** @type {any} */ c) => ({ ...c, light: move(c.light), heavy: move(c.heavy) })))
}

/** @param {any} glyph @param {number[]} landmarks */
function foldedSweep(glyph, [start, elbow, middle, tip, bendY, tail]) {
  return remap(glyph, (x, y) => {
    const high = .25 + (x - start) * .51 / (elbow - start)
    const shoulder = .55 + (x - middle) * .43 / (tip - middle)
    const bottom = .025 + (x - tail) * .9
    if (y <= bendY) {
      const t = y / bendY
      return [high + (shoulder - high) * t, .39 * t]
    }
    const t = (y - bendY) / (1 - bendY)
    return [shoulder + (bottom - shoulder) * t, .39 + .61 * t]
  })
}

/** Draw the seven native stem segments as three editable elbows; width comes
 * from the selected face even on the shallow, wide crossing bar.
 * @param {import('./compose.js').Composer} composer @param {number[]} region */
function surname(composer, region) {
  const stems = ['丨', '一'].map(char => composer.chainStroke(char))
  if (stems.some(s => !s)) return null
  const widths = (/** @type {number} */ master) => composer.stem0.map((/** @type {number[]} */ w) => w[master] * .38)
  const light = widths(0), heavy = widths(1)
  const paths = [
    [[32, 880], [32, 615], [735, 615]],
    [[735, 880], [735, 355], [958, 355], [958, 38]],
    [[380, 975], [380, 38], [958, 38]],
  ]
  const parts = []
  for (const [j, path] of paths.entries()) {
    const contours = []
    for (let i = 1; i < path.length; i++) {
      const native = nativeAxisContours([...path[i - 1], ...path[i]], stems, light, heavy, [i > 1, true])
      if (!native) return null
      contours.push(...native)
    }
    const glyph = makePart(contours)
    const room = mapped(glyph.box, [0, 0, 1000, 1000], region)
    parts.push({ ...placed(glyph, glyph.box, room, partInk(glyph), `R+0A46 ${['㇄', '𠃑', '𠃊'][j]}`), fixed: true })
  }
  return parts
}

/** Narrow the interior stems of 九 while letting its turned foot extend to the right.
 * @param {any} glyph */
function enclosingNine(glyph) {
  const [lo, , hi] = glyph.box
  const widths = [0, .26, .38, .59, .76, .89, 1]
  const target = [0, .065, .16, .185, .32, .89, 1]
  /** @param {Float64Array} points */
  const move = points => points.map((v, i) => {
    if (i % 2) return v
    const t = (v - lo) / (hi - lo)
    const a = Math.max(0, widths.findIndex((end, j) => j > 0 && t <= end) - 1)
    const k = t > 1 ? widths.length - 2 : a
    return lo + (hi - lo) * (target[k] + (target[k + 1] - target[k]) * (t - widths[k]) / (widths[k + 1] - widths[k]))
  })
  return derived(glyph, glyph.contours.map((/** @type {any} */ c) => ({ ...c, light: move(c.light), heavy: move(c.heavy) })))
}

/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export function overlayContextParts(composer, key, region) {
  const form = forms.get(key)
  if (!form || composer.excluded(key)) return null
  const donors = overlayContextDonors(key, composer.fontStyle)
  if ([...form.operands, ...donors].some(char => composer.excluded(char))) return null
  if (form.source === 2630) return surname(composer, region)
  const parts = []
  for (const [char, [left, top, right, bottom]] of form.members) {
    const room = mapped([left, 1 - bottom, right, 1 - top], [0, 0, 1, 1], region)
    if (char.startsWith('#(')) {
      if (composer.excluded(char)) return null
      const cut = composer.chainParts(char, room)
      if (!cut?.length) return null
      parts.push(...cut.map((/** @type {any} */ p) => ({ ...p, fixed: true })))
    } else {
      let glyph = stroke.has(char) ? composer.chainStroke(char) : composer.drawnGlyph(char)
      if (!glyph) return null
      if (char === '九') glyph = enclosingNine(glyph)
      if (char === '㇋' && folds[composer.fontStyle]) glyph = foldedSweep(glyph, folds[composer.fontStyle])
      if (char === '丿' && (form.source === 2603 || form.source === 2696)) {
        glyph = remap(glyph, (x, y) => [.46 * x + .54 * (1 - y), y])
      }
      parts.push({ ...placed(glyph, glyph.box, room, partInk(glyph), `glyph ${char}, R+${form.source.toString(16).toUpperCase().padStart(4, '0')}`), fixed: true })
    }
  }
  return parts
}
