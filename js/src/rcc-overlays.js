import { booklet, bookletParts } from './rcc-booklet.js'
import { derived, makePart, mapped, partInk, placed, pointsBox } from './geometry.js'
import { walkingYou, walkingYouDonors, walkingYouParts } from './rcc-walking-you.js'
import { nativeAxisContours } from './recorded-axis.js'
import { strokeDonor } from './stroke-donors.js'

// Ink bounds are fractions of the printed character, measured left-to-right and top-to-bottom.
// Each entry cites the RCC sighting in which the placement can be checked.
/** @typedef {[string, number[]]} Member */
/** @type {Map<string, {source: number, style?: string, leaves: number[], members: Member[], operands: string[]}>} */
const forms = new Map([
  // 重校全補海篇直音 (1595), 音体. The short falling stroke joins the top of the hook.
  // https://rare.glyphatlas.org/en/entry/2603#sighting-2767
  ['⿰口#(丿乚)', { source: 2603, leaves: [0, 1, 1], operands: ['#(丿乚)', '口', '丿'], members: [
    ['叱', [0, .27, .405, .81]], ['彳', [.44, 0, .82, .365]], ['乚', [.43, .31, 1, 1]],
  ] }],
  // 中华姓氏源流大辞典 p. 771 and 殷虚卜辞综述 p. 277. The upper short bar crosses
  // the center upright and joins the high left end of the right-hand step.
  // https://rare.glyphatlas.org/en/entry/2630#sighting-2794
  ['⿻[x_]#(㇄-𠃑)𠃊', { source: 2630, leaves: [0, 0, 1], operands: ['#(㇄-𠃑)'], members: [
    ['㇄', [0, .10, .78, .43]], ['𠃑', [.72, .11, 1, 1]], ['𠃊', [.35, 0, 1, 1]],
  ] }],
  // Korean 龍龕手鑑, the headword beside 普奸切. The crossing is above the extended
  // hooked foot, with the bottom of 夂 at the height of the right-hand crossbar.
  // https://rare.glyphatlas.org/en/entry/2696#sighting-2860
  ['⿰夂⿻乚#(丿𠃊-丨)', { source: 2696, leaves: [0, 2, 2, 2, 1], operands: ['#(丿𠃊-丨)', '丿'], members: [
    ['夂', [0, .08, .52, .74]], ['彳', [.475, .018, .79, .405]],
    ['𠃊', [.47, .37, .88, .72]], ['丨', [.85, .32, .94, .74]], ['乚', [.61, .22, 1, 1]],
  ] }],
  // The right-hand Hanyo-Denshi IVS in the RCC sighting. The falling right stroke
  // starts in the open space between the two falling-left strokes.
  // https://rare.glyphatlas.org/en/entry/2755#sighting-2919
  ['⿰月⿻#(-丿㇋)乀', { source: 2755, leaves: [0, 1, 1, 2], operands: ['#(-丿㇋)', '乀'], members: [
    ['月', [0, .02, .39, 1]], ['丿', [.37, .01, .60, .99]],
    ['㇋', [.41, 0, .96, .99]], ['八', [.60, .49, 1, .98]],
  ] }],
  // 笔削鳌头海篇心镜·九部第六, the first of the two forms glossed 囂. 九 carries the whole upper-right group on its foot.
  // https://rare.glyphatlas.org/en/entry/2830#sighting-2994
  ['⿺九⿸⿻干#(-乛丿)亚', { source: 2830, leaves: [0, 1, 2, 2, 3], operands: ['九', '#(-乛丿)', '乛', '丿'], members: [
    ['旭', [0, .02, 1, 1]], ['干', [.475, .02, .875, .53]],
    ['乛', [.40, .155, .94, .33]], ['丿', [.305, .18, .465, .78]], ['亚', [.455, .48, .88, .835]],
  ] }],
  // 王荣艳 (2023), 〈古本戏曲丛刊〉俗字研究 p. 378, first head under nǎi. The center
  // 日 nestles inside 乃, above the shoulders of the two upright 鼎 legs.
  // https://rare.glyphatlas.org/en/entry/2903#sighting-3067
  ['⿱乃⿶⿰#(𠃑-一丨)#(丨-一𠃑)日', { source: 2903, leaves: [0, 1, 2, 3], operands: ['𠃑', '一', '丨', '亞'], members: [
    ['乃', [0, 0, .89, .575]], ['#(𠃑-一丨)', [.15, .405, .43, 1]],
    ['#(丨-一𠃑)', [.60, .42, 1, .97]], ['日', [.32, .17, .635, .49]],
  ] }],
])

const stroke = new Set('乛丿乚㇄𠃑𠃊丨㇋乀')

/** @param {string} key @param {string} style */
export function overlayContextDonors(key, style) {
  if (key === walkingYou) return walkingYouDonors(style)
  if (key === booklet) return ['册']
  const form = forms.get(key)
  if (!form || (form.style && form.style !== style)) return []
  if (form.source === 2630) return ['㇄', '𠃑', '𠃊', '丨', '一']
  const extra = form.source === 2696 ? ['丨', '一'] : []
  return [...new Set(extra.concat(form.members.flatMap(([char]) => {
    if (char.startsWith('#(')) return ['亞']
    const donor = stroke.has(char) && strokeDonor(char, style)
    return donor ? [char, donor] : [char]
  })))]
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
 * from the selected face even on a shallow, wide crossing bar.
 * @param {import('./compose.js').Composer} composer @param {number[]} region
 * @param {number[][]} path @param {string} origin @param {number} rccLeaf */
function axialPart(composer, region, path, origin, rccLeaf) {
  const stems = ['丨', '一'].map(char => composer.chainStroke(char))
  if (stems.some(s => !s)) return null
  const widths = (/** @type {number} */ master) => composer.stem0.map((/** @type {number[]} */ w) => w[master] * .38)
  const light = widths(0), heavy = widths(1)
  const contours = []
  for (let i = 1; i < path.length; i++) {
    const native = nativeAxisContours([...path[i - 1], ...path[i]], stems, light, heavy, [i > 1, true])
    if (!native) return null
    contours.push(...native)
  }
  const glyph = makePart(contours)
  const room = mapped(glyph.box, [0, 0, 1000, 1000], region)
  return { ...placed(glyph, glyph.box, room, partInk(glyph), origin), rccLeaf, fixed: true }
}

/** Use the interior of 乚 to absorb the compression of its component box so the
 * trunk and upturned terminal retain their face's pen width.
 * @param {any} glyph @param {number[]} room */
function narrowHook(glyph, room) {
  const [l, b, r, t] = glyph.box
  const factor = Math.max(1, Math.min(1.8, (r - l) / (t - b) * (room[3] - room[1]) / (room[2] - room[0])))
  return remap(glyph, (x, y) => [
    x <= .22 ? x * factor : x >= .83 ? 1 - (1 - x) * factor :
      .22 * factor + (x - .22) * (1 - .39 * factor) / .61, y,
  ])
}

/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export function overlayContextParts(composer, key, region) {
  if (key === walkingYou) return walkingYouParts(composer, region)
  if (key === booklet) return bookletParts(composer, region)
  const form = forms.get(key)
  if (!form || (form.style && form.style !== composer.fontStyle) || composer.excluded(key)) return null
  const donors = overlayContextDonors(key, composer.fontStyle)
  if ([...form.operands, ...donors].some(char => composer.excluded(char))) return null
  const parts = []
  for (const [i, [char, [left, top, right, bottom]]] of form.members.entries()) {
    const rccLeaf = form.leaves[i]
    const donorLabel = { '旭': '九 from 旭', '叱': '口 from 叱', '彳': '丿 from 彳', '八': '乀 from 八' }[char] ?? `glyph ${char}`
    const origin = `${donorLabel}, R+${form.source.toString(16).toUpperCase().padStart(4, '0')}`
    let path
    // R+0A46 has three uprights and two crossbars: ㇄ meets 𠃑
    // halfway down its left edge, and 𠃊 closes the bottom at its right edge.
    if (form.source === 2630) path = [
      [[32, 880], [32, 615], [735, 615]],
      [[735, 880], [735, 355], [958, 355], [958, 38]],
      [[380, 975], [380, 38], [958, 38]],
    ][i]
    if (form.source === 2696 && char === '𠃊') path = [[490, 625], [490, 305], [868, 305]]
    if (form.source === 2696 && char === '丨') path = [[868, 668], [868, 305]]
    if (path) {
      const stem = axialPart(composer, region, path, origin, rccLeaf)
      if (!stem) return null
      parts.push(stem)
      continue
    }
    // The long 丿 springs from the first bar of ㇋ in the E0101 registration.
    const lip = form.source === 2755 && char === '丿' && ['regular', 'fangsong'].includes(composer.fontStyle) ? .065 : top
    const room = mapped([left, 1 - bottom, right, 1 - lip], [0, 0, 1, 1], region)
    if (char.startsWith('#(')) {
      if (composer.excluded(char)) return null
      const cut = composer.chainParts(char, room)
      if (!cut?.length) return null
      for (const p of cut) {
        // The upper return of the right leg meets 乃 inside the outer
        // upright of the foot (the first example on p. 378).
        const shape = char === '#(丨-一𠃑)' ? remap(p.part, (x, y) => [
          x - .45 * Math.max(0, Math.min(1, (x - .2) / .55)) * Math.max(0, Math.min(1, (.57 - y) / .18)), y,
        ]) : p.part
        parts.push({ ...p, part: shape, rccLeaf, fixed: true })
      }
    } else {
      let glyph = stroke.has(char) ? composer.chainStroke(char) : composer.drawnGlyph(char)
      if (!glyph) return null
      if (form.source === 1878 && char === '冂') {
        // Both left legs slope away from the joint. The inner hook of the
        // higher box ends at the crossing, above the long terminal on the right.
        glyph = remap(glyph, (x, y) => [
          .10 + .90 * x - .10 * y,
          i === 0 ? y * (1 - .44 * x) : y * (.80 + .20 * x) + .18 * x * (1 - y),
        ])
      }
      if (char === '乚') glyph = narrowHook(glyph, room)
      if (char === '干') {
        // The second bar is below the shelf of 乛, with a clear gap between them.
        glyph = remap(glyph, (x, y) => [x, y + .115 * Math.max(0, Math.min(1, (y - .12) / .15, (.85 - y) / .3))])
      }
      if (['旭', '八', '叱', '彳'].includes(char) && !composer.own(char)) return null
      if (char === '旭') {
        // 旭 already has the long carrying foot. Its inner 日 starts beyond
        // the center in each face, clear of all the 九 contours at the left.
        const center = (glyph.box[0] + glyph.box[2]) / 2
        const left = glyph.contours.filter((/** @type {any} */ c) => pointsBox(c.light)[0] < center)
        if (!left.length || left.length === glyph.contours.length) return null
        glyph = derived(glyph, left)
      }
      if (char === '八') {
        const contours = glyph.contours
        if (contours.length < 2) return null
        const right = contours.reduce((/** @type {any} */ a, /** @type {any} */ b) =>
          pointsBox(a.light)[2] > pointsBox(b.light)[2] ? a : b)
        glyph = derived(glyph, [right])
      }
      if (char === '㇋' && folds[composer.fontStyle]) glyph = foldedSweep(glyph, folds[composer.fontStyle])
      if (char === '叱') {
        // The mouth is already drawn for the left side of a character.
        const middle = (glyph.box[0] + glyph.box[2]) / 2
        const contours = glyph.contours.filter((/** @type {any} */ c) => pointsBox(c.light)[2] < middle)
        if (!contours.length) return null
        glyph = derived(glyph, contours)
      }
      if (char === '彳') {
        // Its isolated upper 撇 has the breadth and the entry of a short
        // falling stroke. The initial vertical of a full-length 丿 is absent.
        const top = glyph.contours.reduce((/** @type {any} */ a, /** @type {any} */ b) =>
          pointsBox(a.light)[1] > pointsBox(b.light)[1] ? a : b)
        if (pointsBox(top.light)[1] < (glyph.box[1] + glyph.box[3]) / 2) return null
        // A short 撇 in these heads has a broad brush entry. Weight this
        // cut inside its measured ink box, retaining the face's own taper.
        const amount = composer.fontStyle === 'pen-writing' ? 0 : form.source === 2603 ? .60 : .35
        const light = top.light.map((/** @type {number} */ v, /** @type {number} */ j) => v + (top.heavy[j] - v) * amount)
        glyph = derived(glyph, [{ ...top, light }])
      }
      parts.push({ ...placed(glyph, glyph.box, room, partInk(glyph), origin), rccLeaf, fixed: true })
    }
  }
  return parts
}
