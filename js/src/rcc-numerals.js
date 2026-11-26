import { derived, mapped, partInk, partOf, placed, pointsBox, rings } from './geometry.js'
import { recordedNativeGlyph } from './recorded-native.js'
import { reconnectStroke } from './stroke-donors.js'
import { hexOf } from './sha256.js'
import { parseChain } from './stroke-chain.js'

const five = '#(丿◝x4◞◟◜)'
const seven = '⿱丄一'
const triangle = '#(-𠃋丶z)'
const sequences = new Map([
  ['⿰' + five + '日', 'weekday'],
  ['⿱⿰〧〥△', 'sevenFive'], ['⿱⿰' + seven + five + triangle, 'sevenFive'],
  ['⿱⿰〥〤元', 'fiveFour'], ['⿱⿰' + five + '乂元', 'fiveFour'],
  ['⿺是？', 'question'], ['⿺是⿱#(◜◝◞-◜)丶', 'question'],
  ['⿵巾１', 'exercise'], ['⿵巾⿱#(㇀丨)一', 'exercise'],
])

/** @type {Record<string, string>} */
const donors = { weekday: '〥日', sevenFive: '〧〥△', fiveFour: '〥〤元', question: '題？', exercise: '冂１丨' }

/** @param {string} key @param {string} style */
export function numeralDonors(key, style) {
  const form = sequences.get(key)
  if (!form) return []
  let chars = donors[form]
  if (style === 'fangsong') chars = chars.replace('〥', '〇丿一').replace('〧', '丄㇀刁').replace('〤', '乂').replace('１', '1')
  if (style === 'pen-writing' && form === 'exercise') chars += '一'
  return [...new Set(chars)]
}

/** Normalized ink boxes measured within the printed character, y upwards. */
const unit = [0, 0, 1, 1]
/** @param {any} part @param {number[]} region @param {number[]} box @param {string} origin */
function place(part, region, box, origin) {
  return { ...placed(part, part.box, mapped(box, unit, region), partInk(part), origin), fixed: true }
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
 * @param {any} composer @param {number[]} region @param {any} mark */
function questionParts(composer, region, mark) {
  const entry = shi[composer.fontStyle], record = composer.glyphRecord('題')
  if (!entry || record?.v !== 1 || hexOf(JSON.stringify(record.p)) !== entry[0]) return null
  const title = partOf(record), contours = entry[1].map(i => title.contours[i])
  if (composer.fontStyle === 'fangsong') contours.push(reconnectStroke(title.contours, [[0, 0, 44], [0, 110, 127]]))
  const body = derived(title, contours)
  return [place(body, region, unit, '是 from 題'), place(mark, region, [0.56, 0.18, 0.97, 0.98], 'glyph ？')]
}

/** 笹原宏之，《日本的汉字》，2019，頁161. The numeral's staff projects above the 巾 frame.
 * https://rare.glyphatlas.org/en/entry/3119#sighting-3283
 * @param {any} glyphs @param {number[]} region */
function exerciseParts(glyphs, region) {
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
  const parts = [place(glyphs.冂, region, frame, 'glyph 冂'), place(glyphs.丨, region, [left, 0.53, right, 1], 'upper staff of 巾 from 丨'),
    place(digit, region, box, 'glyph ' + digitKey)]
  if (glyphs.一) parts.push(place(glyphs.一, region, [0.36, 0.10, 0.68, 0.15], 'base of １ from 一'))
  return parts
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

/** 胡懷琛，《簡易字表》，1928，頁102. 「圕」新字之商榷（第三次）.
 * https://rare.glyphatlas.org/en/entry/2514#sighting-2678
 * https://rare.glyphatlas.org/en/entry/2516#sighting-2680
 * https://rare.glyphatlas.org/en/entry/2518#sighting-2682
 * @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export function numeralParts(composer, key, region) {
  const form = sequences.get(key)
  if (!form || composer.excluded(key)) return null
  const source = numeralDonors(key, composer.fontStyle)
  if (source.some(c => composer.excluded(c)) || [...key].some(c => composer.excluded(c)) ||
      [...key.matchAll(/#\([^()]*\)/gu)].some(m => composer.excluded(m[0]) || parseChain(m[0])?.strokes.some(s => composer.excluded(s.char)))) return null
  /** @type {Record<string, any>} */
  const glyphs = {}
  for (const char of source) {
    const record = composer.glyphRecord(char)
    const glyph = record?.v === 1 ? partOf(record) : recordedNativeGlyph(composer.fontStyle, char) ??
      ((char === '㇀' || char === '〇') ? composer.chainStroke(char) : null)
    if (!glyph) return null
    glyphs[char] = glyph
  }
  if (form === 'question') return questionParts(composer, region, glyphs['？'])
  if (form === 'exercise') return exerciseParts(glyphs, region)
  const fiveRoom = form === 'weekday' ? [0, 0, 0.49, 1] : form === 'sevenFive' ? [0.53, 0.38, 1, 1] : [0, 0.48, 0.46, 1]
  const target = mapped(fiveRoom, unit, region)
  const parts = glyphs['〥'] ? [place(glyphs['〥'], target, unit, 'Suzhou numeral 〥')] : [
    place(smallCounter(glyphs.〇, 0.72, 0.5), target, [0.05, 0, 0.98, 0.55], 'loop of 〥 from 〇'),
    place(glyphs.丿, target, [0.24, 0.49, 0.97, 1], 'main stroke of 〥 from 丿'),
    place(glyphs.丿, target, [0.01, 0.51, 0.47, 0.98], 'short stroke of 〥 from 丿'),
    place(glyphs.一, target, [0.01, 0.48, 0.46, 0.55], 'shoulder of 〥 from 一'),
  ]
  if (form === 'weekday') parts.push(place(glyphs.日, region, [0.49, 0, 1, 0.96], 'glyph 日'))
  if (form === 'sevenFive') {
    if (glyphs['〧']) parts.push(place(risingSeven(glyphs['〧']), region, [0, 0.29, 0.55, 1], 'Suzhou numeral 〧'))
    else parts.push(place(glyphs.丄, region, [0, 0.59, 0.54, 1], 'upper strokes of 〧 from 丄'),
      place(glyphs['㇀'], region, [0.01, 0.30, 0.53, 0.55], 'lower stroke of 〧 from ㇀'))
    parts.push(place(smallCounter(glyphs['△'], 0.55, 1 / 3), region, [0.11, 0, 0.58, 0.31], 'glyph △'))
  }
  if (form === 'fiveFour') parts.push(place(glyphs['〤'] ?? glyphs.乂, region, [0.49, 0.48, 1, 1],
    glyphs['〤'] ? 'Suzhou numeral 〤' : '〤 from 乂'), place(glyphs.元, region, [0.01, 0, 1, 0.46], 'glyph 元'))
  return parts
}
