import { contourSections, derived, mapped, partInk, partOf, placed, pointsBox, rings } from './geometry.js'
import { recordedNativeGlyph } from './recorded-native.js'
import { reconnectStroke } from './stroke-donors.js'
import { hexOf } from './sha256.js'
import { parseChain } from './stroke-chain.js'
import { leaves, parseDescription } from './tree.js'

const five = '#(丿◝x4◞◟◜)'
const seven = '⿱丄一'
const triangle = '#(-𠃋丶z)'
const sequences = new Map([
  ['⿰' + five + '日', 'weekday'],
  ['⿱⿰〧〥△', 'sevenFive'], ['⿱⿰' + seven + five + triangle, 'sevenFive'],
  ['⿱⿰〥〤元', 'fiveFour'], ['⿱⿰' + five + '乂元', 'fiveFour'],
  ['⿺是？', 'question'], ['⿺是⿱#(◜◝◞-◜)丶', 'question'],
  ['⿵巾２', 'exerciseTwo'], ['⿵巾#(◜◝𠃋)', 'exerciseTwo'],
  ['⿵巾１', 'exercise'], ['⿵巾⿱#(㇀丨)一', 'exercise'],
])

const operands = new Map([...sequences.keys()].map(key => [key,
  leaves(parseDescription(key)).flatMap(({ leaf }) => typeof leaf === 'string' ? [leaf] : [])]))

/** @type {Record<string, string>} */
const donors = { weekday: '〥日', sevenFive: '〧〥△', fiveFour: '〥〤元', question: '題？', exercise: '冂１丨', exerciseTwo: '冂丨２' }

/** @param {string} key @param {string} style */
export function numeralDonors(key, style) {
  const form = sequences.get(key)
  if (!form) return []
  let chars = donors[form]
  if (style === 'fangsong') chars = chars.replace('〥', '〇丿一').replace('〧', '丄㇀刁').replace('〤', '乂').replace('１', '1').replace('２', '2')
  if (style === 'pen-writing' && form === 'exercise') chars += '一'
  return [...new Set(chars)]
}

/** Normalized ink boxes measured within the printed character, y upwards. */
const unit = [0, 0, 1, 1]
/** @param {any} part @param {number[]} region @param {number[]} box @param {string} origin @param {number} rccLeaf */
function place(part, region, box, origin, rccLeaf) {
  return { ...placed(part, part.box, mapped(box, unit, region), partInk(part), origin), fixed: true, rccLeaf }
}

/** The footprint of 是 in 題 preserves its left-hand 日 and the foot beneath its neighbor.
 * The FangSong outline connects the left foot of 頁 to the final sweep.
 * @type {Record<string, [string, number[]]>} */
const shi = {
  sans: ['60196ce3677c4af2e1ae4591e02907c1eb81eb6eb9605d1a34318839af4ecdee', [0, 1, 2, 3, 5, 6, 13, 14]],
  serif: ['15c486279231c2b42bb8b1a1de42e1c1ba00ec47deda61167cf25973c37914bf', [0, 1, 2, 3, 4, 5, 6, 7, 17]],
  regular: ['062b5b14afea66854b96fc3f08ca91298a838a751a98925501fddcd169f54eed', [0, 5, 6, 7]],
  fangsong: ['3a751fa9778257252420e4f5f0607634c779df3c3b6dca6e87f34da7371d8da6', [1, 3]],
  'pen-writing': ['be6365b6ed6e9ae9cbbb73dfeec4c6441a64d3d095dbedd76999982a4471e80b', [1, 2, 3, 6]],
}

/** 《復興日報》, 1948-05-31, 《想像中的「代辭字」》. The mark sits beside the 日 of 是.
 * https://rare.glyphatlas.org/en/entry/2910#sighting-3074
 * @param {any} composer @param {number[]} region @param {any} mark @param {boolean} historic */
function questionParts(composer, region, mark, historic) {
  const entry = shi[composer.fontStyle], record = composer.glyphRecord('題')
  if (!entry || record?.v !== 1 || hexOf(JSON.stringify(record.p)) !== entry[0]) return null
  const title = partOf(record), contours = entry[1].map(i => title.contours[i])
  if (composer.fontStyle === 'fangsong') contours.push(reconnectStroke(title.contours, [[0, 0, 44], [0, 110, 127]]))
  const body = derived(title, contours)
  const punctuation = place(mark, region, [0.56, 0.18, 0.97, 0.98], 'glyph ？', 1)
  const pieces = historic ? splitLower(punctuation, 'question hook', 'question dot') : [punctuation]
  if (!pieces && composer.separate) return null
  return [place(body, region, unit, '是 from 題', 0), ...(pieces ?? [punctuation])]
}

/** The junction of the printed digit’s stem and base, in original pen commands.
 * Serif already has one contour for each. Other faces share a contour.
 * @type {Record<string, [string, number[][], number[][]]>} */
const digitCuts = {
  sans: ['0ef2896e05679ef7e8a75d4b994fc8912550b7b4a86978f578a8e1d42f2e3132', [[0, 2, 8]], [[0, 8, 10], [0, 0, 2]]],
  serif: ['d2129db167a828f9669ca9fdc5d05646db07ff142d1a6cdbde0534d58161cc32', [[1]], [[0]]],
  regular: ['6f508f5a9c5f1736252e22c027087561fa844a3ab5c1e5fda2de4789b008cdd3', [[0, 10, 17], [0, 0, 2]], [[0, 2, 10]]],
  fangsong: ['bbbb0bb6289ca25fbf4998b8ecb64a01419b3739d3ce24ff4ee2d5a9338f958f', [[0, 0, 10]], [[0, 10, 18]]],
}

/** 笹原宏之，《日本的汉字》，2019，頁161. The numeral's staff projects above the 巾 frame.
 * https://rare.glyphatlas.org/en/entry/3119#sighting-3283
 * @param {any} composer @param {any} glyphs @param {number[]} region @param {boolean} historic */
function exerciseParts(composer, glyphs, region, historic) {
  const digitKey = glyphs['１'] ? '１' : '1'
  const digit = glyphs[digitKey]
  const frame = [0, 0, 1, 0.80], box = [0.34, 0.12, 0.69, 0.68]
  // Find the upright at half the digit's height, clear of its flag and foot.
  const [x0, y0, x1, y1] = digit.box, y = (y1 + y0) / 2, xs = []
  const outlines = rings(digit.contours, digit.contours.map((/** @type {any} */ c) => c.light))
  for (const coords of outlines) {
    for (let i = 0; i < coords.length; i += 2) {
      const j = (i + 2) % coords.length
      if ((coords[i + 1] <= y) === (coords[j + 1] <= y)) continue
      xs.push(coords[i] + (coords[j] - coords[i]) * (y - coords[i + 1]) / (coords[j + 1] - coords[i + 1]))
    }
  }
  if (!xs.length) return null
  const lo = Math.min(...xs), hi = Math.max(...xs), sx = (box[2] - box[0]) / (x1 - x0)
  const left = box[0] + (lo - x0) * sx, right = box[0] + (hi - x0) * sx
  const parts = [place(glyphs.冂, region, frame, 'glyph 冂', 0),
    place(glyphs.丨, region, [left, 0.53, right, 1], 'upper staff of 巾 from 丨', 0)]
  const drawing = place(digit, region, box, 'glyph ' + digitKey, 1)
  if (historic && !glyphs.一) {
    const cuts = digitCuts[composer.fontStyle], record = composer.glyphRecord(digitKey)
    if (cuts && record?.v === 1 && hexOf(JSON.stringify(record.p)) === cuts[0]) {
      for (const [i, sections] of [cuts[1], cuts[2]].entries()) {
        const contour = sections[0].length === 1 ? digit.contours[sections[0][0]] : contourSections(digit.contours, ...sections)
        parts.push(cutPlacement(drawing, [contour], i ? 'base' : 'staff', 1 + i))
      }
      return parts
    }
    if (composer.separate) return null
  }
  parts.push(drawing)
  if (glyphs.一) parts.push(place(glyphs.一, region, [0.36, 0.10, 0.68, 0.15], 'base of １ from 一', historic ? 2 : 1))
  return parts
}

/** @param {ReturnType<typeof place>} drawing @param {any[]} contours @param {string} name @param {number} rccLeaf */
function cutPlacement(drawing, contours, name, rccLeaf) {
  const cut = derived(drawing.part, contours)
  return { ...drawing, part: cut, source: cut.box, target: mapped(cut.box, drawing.source, drawing.target),
    origin: name + ' from ' + drawing.origin, rccLeaf }
}

/** Split a separate bottom stroke at a clear horizontal gap in the native ink.
 * Both pieces keep the original placement and the spelling's operand order.
 * @param {ReturnType<typeof place>} drawing @param {string} upperName @param {string} lowerName */
function splitLower(drawing, upperName, lowerName) {
  const contours = drawing.part.contours
  if (contours.length < 2) return null
  const boxes = contours.map((/** @type {any} */ c) => pointsBox(c.light))
  let low = 0
  for (let i = 1; i < boxes.length; i++) if (boxes[i][3] < boxes[low][3]) low = i
  if (boxes.some((/** @type {number[]} */ box, /** @type {number} */ i) => i !== low && box[1] <= boxes[low][3])) return null
  const upper = contours.filter((/** @type {any} */ _, /** @type {number} */ i) => i !== low)
  return [cutPlacement(drawing, upper, upperName, drawing.rccLeaf),
    cutPlacement(drawing, [contours[low]], lowerName, drawing.rccLeaf + 1)]
}

/** The lower stroke of the seven rises toward the five in the facsimile.
 * @param {any} glyph */
function risingSeven(glyph) {
  const boxes = glyph.contours.map((/** @type {any} */ c) => pointsBox(c.light))
  let bottom = 0
  for (let i = 1; i < boxes.length; i++) {
    if (boxes[i][3] < boxes[bottom][3]) bottom = i
  }
  const [lo, , hi] = boxes[bottom]
  if (!(hi > lo)) return glyph
  const slope = 0.23 * (glyph.box[3] - glyph.box[1]) / (hi - lo)
  const tilted = (/** @type {Float64Array} */ p) => p.map((v, i) => i % 2 ? v + (p[i - 1] - lo) * slope : v)
  return derived(glyph, glyph.contours.map((/** @type {any} */ c, /** @type {number} */ i) =>
    i === bottom ? { ...c, light: tilted(c.light), heavy: tilted(c.heavy) } : c))
}

/** Keep the small printed signs’ counters legible in the abridged character.
 * @param {any} glyph @param {number} fraction @param {number} centerY */
function smallCounter(glyph, fraction, centerY) {
  const [left, bottom, right, top] = glyph.box
  return derived(glyph, glyph.contours.map((/** @type {any} */ c) => {
    const box = pointsBox(c.light), width = box[2] - box[0]
    if (width >= 0.95 * (right - left) || width <= 0) return c
    const factor = Math.min(1, fraction * (right - left) / width)
    const center = [(left + right) / 2, bottom + (top - bottom) * centerY]
    const fit = (/** @type {Float64Array} */ p) => p.map((v, i) => center[i % 2] + (v - center[i % 2]) * factor)
    return { ...c, light: fit(c.light), heavy: fit(c.heavy) }
  }))
}

/** R+09D2: 胡懷琛《簡易字表》 (1928), p. 102.
 * R+09D4 and R+09D6: 「圕」新字之商榷（第三次）.
 * https://rare.glyphatlas.org/en/entry/2514#sighting-2678
 * https://rare.glyphatlas.org/en/entry/2516#sighting-2680
 * https://rare.glyphatlas.org/en/entry/2518#sighting-2682
 * @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export function numeralParts(composer, key, region) {
  const form = sequences.get(key)
  if (!form || composer.excluded(key)) return null
  const historic = key.includes('#(')
  const source = numeralDonors(key, composer.fontStyle).filter(char => char !== '刁')
  const usesExcluded = operands.get(key)?.some(leaf => composer.excluded(leaf) ||
    (leaf.startsWith('#(') && parseChain(leaf)?.strokes.some(stroke => composer.excluded(stroke.char))))
  if (usesExcluded || source.some(c => composer.excluded(c))) return null
  /** @type {Record<string, any>} */
  const glyphs = {}
  for (const char of source) {
    const record = composer.glyphRecord(char)
    if (char === '㇀' && record?.v !== 1 && composer.excluded('刁')) return null
    const glyph = record?.v === 1 ? partOf(record) : recordedNativeGlyph(composer.fontStyle, char) ??
      ((char === '㇀' || char === '〇') ? composer.chainStroke(char) : null)
    if (!glyph) return null
    glyphs[char] = glyph
  }
  if (form === 'question') return questionParts(composer, region, glyphs['？'], historic)
  // Sasahara, p. 161: the top of 2 meets the projecting staff of 巾.
  // https://rare.glyphatlas.org/en/entry/3120#sighting-3284
  if (form === 'exerciseTwo') return [
    place(glyphs.冂, region, [0, 0, 1, 0.80], 'glyph 冂', 0),
    place(glyphs.丨, region, [0.44, 0.57, 0.52, 1], 'upper staff of 巾 from 丨', 0),
    place(glyphs['２'] ?? glyphs['2'], region, [0.27, 0.11, 0.72, 0.61], glyphs['２'] ? 'glyph ２' : 'glyph 2', 1),
  ]
  if (form === 'exercise') return exerciseParts(composer, glyphs, region, historic)
  const fiveRoom = form === 'weekday' ? [0, 0, 0.49, 1] : form === 'sevenFive' ? [0.53, 0.38, 1, 1] : [0, 0.48, 0.46, 1]
  const target = mapped(fiveRoom, unit, region)
  const fiveLeaf = form === 'sevenFive' ? (historic ? 2 : 1) : 0
  const numeral = glyphs['〥'] ? [place(glyphs['〥'], target, unit, 'Suzhou numeral 〥', fiveLeaf)] : [
    place(smallCounter(glyphs.〇, 0.72, 0.5), target, [0.05, 0, 0.98, 0.55], 'loop of 〥 from 〇', fiveLeaf),
    place(glyphs.丿, target, [0.24, 0.49, 0.97, 1], 'main stroke of 〥 from 丿', fiveLeaf),
    place(glyphs.丿, target, [0.01, 0.51, 0.47, 0.98], 'short stroke of 〥 from 丿', fiveLeaf),
    place(glyphs.一, target, [0.01, 0.48, 0.46, 0.55], 'shoulder of 〥 from 一', fiveLeaf),
  ]
  if (form === 'weekday') return [...numeral, place(glyphs.日, region, [0.49, 0, 1, 0.96], 'glyph 日', 1)]
  if (form === 'fiveFour') return [...numeral, place(glyphs['〤'] ?? glyphs.乂, region, [0.49, 0.48, 1, 1],
    glyphs['〤'] ? 'Suzhou numeral 〤' : '〤 from 乂', 1), place(glyphs.元, region, [0.01, 0, 1, 0.46], 'glyph 元', 2)]
  let sevenParts
  if (glyphs['〧']) {
    const whole = place(risingSeven(glyphs['〧']), region, [0, 0.29, 0.55, 1], 'Suzhou numeral 〧', 0)
    sevenParts = historic ? splitLower(whole, '丄', '一') : [whole]
    if (!sevenParts && composer.separate) return null
    sevenParts ??= [whole]
  } else {
    sevenParts = [place(glyphs.丄, region, [0, 0.59, 0.54, 1], 'upper strokes of 〧 from 丄', 0),
      place(glyphs['㇀'], region, [0.01, 0.30, 0.53, 0.55], 'lower stroke of 〧 from ㇀', historic ? 1 : 0)]
  }
  return [...sevenParts, ...numeral, place(smallCounter(glyphs['△'], 0.55, 1 / 3), region,
    [0.11, 0, 0.58, 0.31], 'glyph △', fiveLeaf + 1)]
}
