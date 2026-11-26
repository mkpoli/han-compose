import { derived, fitted, mapped, partInk, partOf, placed, segments } from './geometry.js'
import { hexOf } from './sha256.js'

const tiger = '⿱⺊⿸#(-乛丿)노'
const horse = '⿱⿷#(-一丨b𠃌)𰀁乙'

/** @typedef {[number, number, number]} Run */
/** @typedef {[string, number[][]]} Segment */

// R+06F3 also describes the exterior as ㇯虍七. The exterior is one
// contour in FangSong's 虍. Cut its branch across the base of ⺊.
// https://rare.glyphatlas.org/en/entry/1779#sighting-1857
const tigerDigest = '3b8fd4d245463e60cf88b2a35f714681b84af49a310d446aa7b76f443706f3d2'
/** @type {Run[]} */
const head = [[0, 13, 36]]
/** @type {Run[]} */
const cliff = [[0, 36, 13]]

// R+07B4 gives ⿱㇯馬灬乙. The cut keeps the exterior and 𰀁 of 馬,
// partitioned along the joins between their strokes, with all four dots omitted.
// https://rare.glyphatlas.org/en/entry/1972#sighting-2072
// https://github.com/yi-bai/ids/blob/2597437b928e8d530b7ae09cf53fe5ec7868569c/ids_lv2.txt
/** @type {Map<string, {digest: string, outer: Run[], inner: Run[], bounds?: number[]}>} */
const horseCuts = new Map([
  ['fangsong', {
    digest: '997aafc290221658dc9ea3208cc7cd815a9b5069b651062f2080768792924be1',
    outer: [[0, 71, 47], [5, 15, 0]],
    inner: [[0, 47, 71], [5, 0, 15]],
  }],
  ['regular', {
    digest: '9dbb41716e381d96f861222bfcbfe322b521b912873ad2fae37ebbe6ae95bd1c',
    // Ink bounds of the Regular composition on main in the font’s own em.
    bounds: [129, -44, 859, 811],
    outer: [[0, 29, 0], [3, 5, 0], [2, 4, 0], [1, 6, 0]],
    inner: [[0, 0, 29], [1, 0, 6], [2, 0, 4], [3, 0, 5]],
  }],
])

/** @param {string} key @param {string} style */
export function rccChainDonors(key, style) {
  if (key === tiger && style === 'fangsong') return ['虍', '丨', '一', '丄']
  if (key === horse && horseCuts.has(style)) return ['馬', '乙']
  return []
}

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

/** @param {number[]} box @param {number[]} fractions */
const subBox = (box, fractions) => mapped(fractions, [0, 0, 1, 1], box)

/** Draw ㄴ with FangSong's vertical and horizontal strokes and ㅗ with 丄.
 * The Hangul outline remains one editable operand. For the horizontal vowel,
 * see the Hangul jamo composition in the Unicode Standard, §3.12.
 * https://www.unicode.org/versions/Unicode17.0.0/core-spec/chapter-3/
 * @param {any} vertical @param {any} horizontal @param {any} vowel @param {number[]} room */
function no(vertical, horizontal, vowel, room) {
  const boxes = [
    subBox(room, [0.17, 0.49, 0.28, 1]),
    subBox(room, [0.17, 0.49, 0.87, 0.61]),
    subBox(room, [0, 0, 1, 0.49]),
  ]
  const contours = [vertical, horizontal, vowel].flatMap((part, i) => {
    const [x0, y0, x1, y1] = part.box
    const [left, bottom, right, top] = boxes[i]
    /** @param {Float64Array} points */
    const pointsInBox = points => points.map((value, at) => at % 2
      ? bottom + (value - y0) * (top - bottom) / (y1 - y0)
      : left + (value - x0) * (right - left) / (x1 - x0))
    return part.contours.map((/** @type {any} */ contour) => ({
      ...contour, light: pointsInBox(contour.light), heavy: pointsInBox(contour.heavy),
    }))
  })
  return derived(vertical, contours, room)
}

/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export function rccChainContextParts(composer, key, region) {
  const donors = rccChainDonors(key, composer.fontStyle)
  if (!donors.length) return null
  const operands = key === tiger ? ['⺊', '#(-乛丿)', '乛', '丿', '노'] : ['#(-一丨b𠃌)', '一', '丨', '𠃌', '𰀁', '乙']
  if ([...donors, ...operands, key].some(char => composer.excluded(char))) return null

  /** @param {any} part @param {number[]} box @param {string} origin */
  const place = (part, box, origin) => ({
    ...placed(part, part.box, box, partInk(part), origin), fixed: true,
  })

  if (key === tiger) {
    const glyph = native(composer, '虍', tigerDigest)
    if (!glyph) return null
    const vertical = native(composer, '丨'), horizontal = native(composer, '一'), vowel = native(composer, '丄')
    if (!vertical || !horizontal || !vowel) return null

    const top = outlineThrough(glyph, head), frame = outlineThrough(glyph, cliff)
    const opening = derived(glyph, [glyph.contours[1]], undefined).box
    const syllable = no(vertical, horizontal, vowel, subBox(opening, [0.09, 0.03, 0.83, 0.83]))
    const target = fitted(glyph.box, region, composer.C.STRETCH)
    /** @param {any} part */
    const into = part => mapped(part.box, glyph.box, target)
    return [place(top, into(top), '⺊ from 虍'), place(frame, into(frame), '#(-乛丿) from 虍'),
      place(syllable, into(syllable), '노 from FangSong strokes')]
  }

  const cut = horseCuts.get(composer.fontStyle)
  if (!cut) return null
  const glyph = native(composer, '馬', cut.digest)
  if (!glyph) return null
  const lower = native(composer, '乙')
  if (!lower) return null

  const frame = outlineThrough(glyph, cut.outer), inner = outlineThrough(glyph, cut.inner)
  const box = frame.box
  const bounds = cut.bounds ? mapped(cut.bounds, composer.C.face, region) : region
  const top = fitted(box, subBox(bounds, [0.13, 0.30, 0.88, 1]), composer.C.STRETCH)
  const base = subBox(bounds, [0, 0, cut.bounds ? 1 : 0.93, 0.36])
  return [place(frame, top, '#(-一丨b𠃌) from 馬'), place(inner, mapped(inner.box, box, top), '𰀁 from 馬'),
    place(lower, base, 'glyph 乙')]
}
