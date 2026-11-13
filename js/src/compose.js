// @ts-nocheck: a port of han-compose's Python, kept line for line; its types are the arrays it reads.
// A port of han-compose's composer (`compose.py`, `Composer.compose`) over its web export: a sequence
// drawn from parts other characters' designers drew. The export carries what the composer reads
// when it draws: the learned layout, each character's glyph, and every host of each operand in each
// place in the composer's index order, each with its cut; `ranked` weighs the whole list against
// the target as `Composer._ranked` does, so an entry with no clean cut still takes a place. What it
// does not carry (teachers, KanjiVG's groups for overlays, the standalone model) falls back the way
// the composer falls back without them: rows of three share their axis by `SHARES`.
//
// Beyond the composer, a stacked operand whose donor drew it into the component above it closes on
// to the operand above wherever the two cuts leave a seam (`space`, `closed`), not only under a cover, ⿾
// mirrors its operand, ⿿ turns it half round, 〾 draws it as it is, ㇯
// draws its second operand as a cut out of the first, and ⿼ ⿽ enclose from the right and the lower
// right, their inner part placed in the room the outer one leaves.
//
// Everything here is synchronous. `data.rec(key)` answers a key's record, `data.hosts(key, place)`
// every host entry of it there, cut or not, and `data.places(key)` the places it is held in; each
// answers empty for a key the export lacks or whose file is not loaded yet (which the caller loads
// before drawing again).
import { EM_BOX, area, centre, count, derived, drawnBox, drawnContours, fill, fitted, grown, groupRings, makePart, mapped, partInk, partOf,
  placed, pointsBox, pyRound, raster, rings, scaleOf, shrunk, square, stretchOf, targetFor, union, within } from './geometry.js'
import { ownFormsOnly, componentParts, componentPosition, componentPositionBox, componentRecord, containsComponentForm, isComponentForm, isGroupedForm } from './component-forms.js'
import { features, forward } from './layout.js'
import { CONSTRUCTS, BODY_FORMS, IVD_FORMS, SURROUND_CONSTRUCTS, bodyForm, constructBody, constructParts, ivdParts } from './constructs.js'
import { pyramidCells, pyramidOnBaseLayout } from './pyramid.js'
import { pyramidRows, pyramidOnBase } from './pyramid-rows.js'
import { hangulClusterAt, jamoClass } from './hangul.js'
import { hangulLetters } from './hangul-ids.js'
import { toConjoiningJamo } from './hangul.js'
import { componentFix } from './component-fixes.js'
import { isOutbound, markFace, markParts } from './marks.js'
import { customAt, splitToneMarks, toneMarksAt } from './tree.js'
import { hexOf } from './sha256.js'
import componentConstants from './constants.json' with { type: 'json' }
import numberedFiveContext from '../data/numbered-five-context.json' with { type: 'json' }
import pyramidCatalog from './pyramid-glyphs.json' with { type: 'json' }
import { createRenderNormalizer } from './normalization.js'

const pyramidGlyphs = new Map(pyramidCatalog.entries.flatMap(({ char, part, sequence, pair }) =>
  [sequence, `⿱${part}${pair}`, `⿱${part}⿰${part}${part}`].map(ids => [ids, char])))
const yanGlyphs = new Map(['⿳亠㐅厂', '⿱文厂'].flatMap(outer =>
  [['彡', '彥'], ['生', '產']].map(([inner, char]) => [`⿸${outer}${inner}`, char])))
const yanSources = new Map([['⿳亠㐅厂', '產'], ['⿱文厂', '產'], ['⿳亠丷厂', '产']])
// The stacked 日 pair has about this much outline ink in both exports.
const YAN_STACK_INK = 14000

/** A precomposed syllable's letters as the conjoining jamo run a font shapes; a run stays as it is.
 *  @param {string} syllable @returns {string} */
const runOfSyllable = syllable => {
  const letters = hangulLetters(syllable)
  if (!letters) return syllable
  const initial = toConjoiningJamo(letters.initial, 'L') ?? ''
  const medial = toConjoiningJamo(letters.medial, 'V') ?? ''
  const final = letters.final ? toConjoiningJamo(letters.final, 'T') ?? '' : ''
  return initial + medial + final
}

/** The medial a jamo run opens with, or '' when the run has none. @param {string} run */
const jamoVowel = run => [...run].find(letter => jamoClass(letter) === 'V') ?? ''

const BELOW_VOWELS = new Set(['\u1169', '\u116d', '\u116e', '\u1172', '\u1173'])
const DOT_VOWELS = new Set(['\u119e', '\u119f'])
/** Whether `part` is one Hangul syllable, precomposed or a run of jamo, with any tone marks. @param {string | any[]} part */
const isHangulSyllable = part => {
  if (typeof part !== 'string') return false
  const { rest } = splitToneMarks(part)
  return Boolean(rest && (hangulLetters(rest) || isJamoRun(rest)))
}

/** Whether `text` is one run of conjoining jamo that forms a syllable. @param {string} text */
const isJamoRun = text => {
  const chars = [...text]
  const cluster = hangulClusterAt(chars, 0)
  return Boolean(cluster && cluster.end === chars.length)
}

export class LookupError extends Error { name = 'LookupError' }

/** The first `n` hosts of a list in the composer's index order, by each entry's position `r`. */
const upTo = (list, n) => list.filter(h => h.r < n)

const isSelector = ch => ch !== undefined && /^[︀-️\u{E0100}-\u{E01EF}]$/u.test(ch)

const MODIFIER = /^[0-9:,._xabcdlr|-]+$/u
const MODIFIABLE = new Set(['⿻', '⿴', '⿵', '⿶', '⿷', '⿼', '㇯'])

// Covers whose bar below is drawn inside their width: 宀, 冖, 穴, 雨.
const COVERS = new Set(['宀', '冖', '穴', '雨'])
const COVER_ROOTS = new Set(['冖', '宀', '穴', '雨'])
// Roofs that head a body under a cover: the base below them spans the cell, as 又 does under 𠆢 in
// ⿳穴𠆢又 (叜), rather than standing as the narrow block 害 and 宴 put under 丰 and 日.
const ROOF_BODIES = new Set(['𠆢', '人', '入'])
// How much of a designed body a run of a flat stack needs before it is drawn as one (`bodySupport`).
// One cut is a single accident of one character; from two the font is drawing the pair as a body.
// Measured over 178 stacked characters scored against their own glyphs: at one witness the rule
// moves 39 up and 23 down, at two 18 up and 7 down, at three 11 up and 3 down.
const BODY_WITNESSES = 2
// How much wider than it is tall a single-contour operand is before it counts as a bar.
const BAR_ASPECT = 5
// How much wider than tall a whole glyph may be before a stacked middle band flattens it as a bar:
// the flattest full component (工, 1.23 in the export) and the flattest one drawn as a band
// (丷, 2.04) fall either side of it.
const MIDDLE_FLAT = 1.5
// How much of a cover's width a box head takes, and the part below it, so the two stay in balance.
const BOX_HEAD = 0.72
const BOX_BODY = 0.85
// Covers whose only ink below the bar is their side strokes. 穴 and 雨 hang a middle stroke too,
// where a child touching it is drawn as it is.
const SIDE_COVERS = new Set(['宀', '冖'])
// Covers whose upper edge is their bar: below a stack they close on the part above, as 學 and 覺
// set the 冖 on the 𦥑. 宀 and 穴 carry a dot above the bar, which would meet the part first.
const CLOSING_COVERS = new Set(['冖', '雨'])
// Width of the bar under a cover, as a share of the cover's width (0.70 in 定, 0.72 in 甍).
const COVER_BAR = 0.72
/** How far a middle 冖's ink overlaps the parts above and below it, in font units. */
const COVER_GAP = -24
// How much of a middle 冖's width the part above it must span before the cover closes on it: a
// narrow part would have the bar close on a post (⿳卜冖人).
const COVER_CLOSE_SHARE = 0.5
// The KRM ⿱⺊冖 top. `bar` is where the underside of the roof's bar falls, as a share of the roof's ink
// height from its top; a brush roof's left tip stands well above its bar. `height` is the share of the
// whole the top takes, where the face's own band leaves ⺊ too short. `KRM_GAP` is how far 人's apex
// stands below the bar, as a share of the whole: the manuscript tucks it close under the roof.
// Kureedo's roof underside at the centred stem is about 448 in its 274–546 ink band.
const KRM_TOP = { sans: { bar: 0.24, height: 0.7 }, serif: { bar: 0.34, height: null }, kaisho: { bar: 0.36, height: null } }
const KRM_GAP = 0.035
// Share of its own height a component's top band covers, and the share of the component's width
// the ink in that band must span for the component to count as flat-topped.
const COVER_HEAD = 0.15, COVER_SPAN = 0.9
// How far past a cover's own ink the child may reach beside its side strokes before it is brought in.
const COVER_REACH = 1.05
// The band of white a stack under a cover keeps between its operands, as a share of the stack's
// height, and the most of its own height an operand gives up to open one.
const COVER_CLEAR = 0.09, COVER_TRIM = 0.15
// How much of its own width an operand's top must span to be drawn back from the one above: the 皿
// of 𡩬 spans four fifths and is drawn back, the 八 of 㝙 tapers to a point and is not. Measured
// across the ⿱宀 / ⿱冖 corpus the two kinds fall either side of a gap between 0.58 and 0.66.
const COVER_BROAD = 0.65
// The tallest an operand may be, against the foot that closes on to it, to count as the bar that
// foot's own shape is missing: the 一 of ⿳罒一𧘇 stands at 0.29 of its 𧘇, a body of its own does not.
const COVER_BARRED = 0.5

/** A description with this many leaves and no character to follow is drawn in cells: the
 *  composer's host cuts fit a character's positions, and a dense invented description has none, so
 *  its parts overlap. */
const CELL_LEAVES = 8
/** The gap between cells and the margin inside one, as shares of the cell's box. */
const CELL_GAP = 0.01
const CELL_INSET = 0.018
/** A single top part takes this share of a stacked description's height; the reference design for
 *  the 108-stroke 「ぼんのう」 gives 苦 about a quarter above a much taller bottom. */
const CELL_TOP = 0.28
/** A part may stretch this much to fill its cell, more than the composer allows a placed part. */
const CELL_STRETCH = 4
/** An inner part of a side enclosure sits inside its outer: it takes less than the cell's height.
 *  The middle row of a three-row description is inset across, as in the reference. */
const CELL_INNER_INSET = 0.15
const CELL_MIDDLE_INSET = 0.08
/** The axis an enclosure's two parts take when they are drawn apart: down for the top and bottom
 *  enclosures, across for the rest. Parts keep the tree's reading order, not the side the
 *  enclosure would put them on, since they no longer surround each other. */
const CELL_AXIS = { '⿵': 1, '⿶': 1 }
/** The scale `fitInside` walks down to, and the share of a box a room is short of before it gives way. */
const FIT_FLOOR = 0.45
/** Frames a font sets as a left half and a right half: the halves stand at the sides of the cell
 *  and the enclosed part sits between them (𦥑 in ⿴𦥑囟, read as ⿲). */
const SPLIT_FRAMES = new Set(['𦥑'])
/** A short stack in a tall column of a ⿲ keeps to the top of its column, leaving the rest empty:
 *  山 over 一 in ⿲彳⿱山一攵 stands as 微 and 徵 set it, with 攵 filling the lower right. A stack is
 *  short when each part stays under this share of the column's height at the column's width, and
 *  both together under `SHORT_STACK`; it is then drawn in the top `SHORT_STACK` of the column,
 *  twice the 0.28 that `CELL_TOP` gives one top part, and its lower part closes to
 *  `SHORT_STACK_GAP` under the upper. Measured on the parts' own glyphs, before any host cut:
 *  徵 sets 山's foot 66 units above the 王 below it, 7% of the column; the stack is placed at 7.6%
 *  so its own spacing settles there. */
const SHORT_STACK_PART = 0.45, SHORT_STACK = 0.56, SHORT_STACK_GAP = 0.076
/** Share of a donor's overlap a nested stack closes by: at the root the seam closes fully, inside
 *  another node that same overlap crowds what it sits under (⿱一𧘇 under 罒 in ⿱宀⿳罒一𧘇). */
export const CLOSED_NESTED = 0.45
/** How much of the gap between two stacked operands a donor's overlap has to cover before the pair
 *  is closed: an overlap the designer drew somewhere else (八 under 宀) is no seam to weld shut. */
const CLOSED_SHARE = 0.15
/** The least share of a three-band stack's height an enclosed middle band takes: a 口 or 日
 *  compressed to a sliver reads as a gap between two bars. */
const MIDDLE_BAND = 0.4
/** Middle operands drawn as a closed box: they need height to keep their counter open. */
const ENCLOSED_MIDDLE = new Set(['口', '日', '田', '目', '罒', '回', '囗', '曰'])
/** The most of a three-band stack's height a single component over a cover takes: a hollow roof
 *  (𰀉 over 冖, the top of 橐) otherwise reads as one band too many, with the bottom squeezed. */
const TOP_BAND = 1 / 3
/** The share of the region's width a three-band stack's middle band takes: a 口 or 日 set as wide as
 *  the bars above and below it looks stretched, and the font draws it narrower and taller. */
const MIDDLE_ACROSS = 0.72
/** How much of a pair's height the learned layout may give its top before its ink has to agree:
 *  past `LEARNED_TOP`, a top holding under `LEARNED_INK` of the pair's ink fills too little of it. */
const LEARNED_TOP = 0.55, LEARNED_INK = 0.4
/** Characters whose middle horizontal the font runs out past its right vertical: the textbooks
 *  end 丑's third stroke inside that vertical. Their own glyph and any host cut of them are drawn
 *  with the bar cut back to the vertical. A glyph the cut cannot be made in (a brush outline
 *  without separate bars) is left as the font draws it. */
const CONTAINED_MIDDLE_BARS = new Set(['丑'])

/** `⿰亻⿱亠女` as ['⿰', '亻', ['⿱', '亠', '女']], each operator taking `arity(op)` operands.
 * An operator's zi.tools modifier is retained as the array's `note`. */
export function parseTree(sequence, arity) {
  const chars = [...sequence]
  let at = 0
  const node = () => {
    if (at >= chars.length) throw new LookupError(`${sequence} is missing a component.`)
    let ch = chars[at++]
    // A component no code point names ({53}, &CDP-8BD0;, #(-𠃌㇉)) is one component.
    const custom = customAt(chars, at - 1)
    if (custom) { at = custom.end; return custom.text }
    const n = arity(ch)
    if (!n) {
      // A run of conjoining jamo that forms one syllable is one component, as the editor reads it.
      const cluster = hangulClusterAt(chars, at - 1)
      if (cluster) { at = cluster.end; ch = cluster.text }
      if (isSelector(chars[at])) ch += chars[at++]
      // A tone mark belongs to the syllable it follows, not to the whole description.
      const end = toneMarksAt(chars, at)
      const tones = chars.slice(at, end).join('')
      at = end
      return ch + tones
    }
    let note = ''
    if (MODIFIABLE.has(ch) && chars[at] === '[') {
      const close = chars.indexOf(']', at + 1)
      if (close > at && close - at <= 65 && MODIFIER.test(chars.slice(at + 1, close).join(''))) {
        note = chars.slice(at + 1, close).join('')
        at = close + 1
      }
    }
    const tree = [ch, ...Array.from({ length: n }, node)]
    if (note) tree.note = note
    return tree
  }
  const tree = node()
  if (at !== chars.length) throw new LookupError(`${sequence} has more components than its operators take.`)
  return tree
}

/** A glyph's ink box: its strokes can reach past its placement box, and inside a cell that overflow
 *  runs into the next cell, so a cell fits the ink. @param {any} part */
const tightBox = part => {
  const box = part.contours.reduce((b, c) => union([b, pointsBox(c.light)]), [Infinity, Infinity, -Infinity, -Infinity])
  return Number.isFinite(box[0]) ? box : part.box
}

/** The text of each leaf of a tree in reading order, an empty slot as ⬚. @param {any} node @returns {string[]} */
export function leafTexts(node) {
  /** @type {string[]} */
  const out = []
  /** @param {any} part */
  const walk = part => {
    if (part === null) { out.push(EMPTY); return }
    if (typeof part === 'string') { out.push(part); return }
    for (const child of part.slice(1)) walk(child)
  }
  walk(node)
  return out
}

/** A node written out again as a sequence, including crossing constraints. */
export const keyOf = node => typeof node === 'string' ? node : node[0] + (node.note ? `[${node.note}]` : '') + node.slice(1).map(keyOf).join('')
/** Rebuild operands without losing their operator's crossing constraint. */
export const mapOperands = (node, visit) => Object.assign([node[0], ...node.slice(1).map(visit)], node.note ? { note: node.note } : {})

/** An empty slot, as the editor writes it (EMPTY in ids-input's core). The composer lays a tree with empty
 *  slots out as it would a whole one, each empty slot an operand it knows nothing of (the layout
 *  reads its place's defaults, its ink is the unknown operand's), and draws no ink there: the slot
 *  becomes a placeholder in the box its node gave it. han-compose itself draws no empty slots. */
export const EMPTY = '⬚'
/** Whether a node is an empty slot, numbered in reading order (`⬚0`, `⬚1`, …) by `compose`. */
export const isEmpty = node => typeof node === 'string' && node[0] === EMPTY
/** Whether `node` holds an empty slot at all. */
const hasSlot = node => isEmpty(node) || Array.isArray(node) && node.slice(1).some(hasSlot)
/** How many empty slots `node` holds. */
const slotsIn = node => isEmpty(node) ? 1 : Array.isArray(node) ? node.slice(1).reduce((sum, kid) => sum + slotsIn(kid), 0) : 0
/** `node` with the numbers of its empty slots shifted by `by`, so each repeated cell keeps its own. */
const shiftedSlots = (node, by) => isEmpty(node) ? `${EMPTY}${Number(node.slice(1)) + by}`
  : Array.isArray(node) ? mapOperands(node, kid => shiftedSlots(kid, by)) : node
const isRepeatedRow = node => Array.isArray(node) && (node[0] === '⿰' || node[0] === '⿲') &&
  node.slice(1).every(child => keyOf(child) === keyOf(node[1]))
/** One cell per operand of a row that repeats one character: the same width and the same across
 *  extent, with `shares`' gap between the cells, so a whole glyph drawn from each is drawn alike. */
const evenCells = (boxes, axis) => {
  const frame = union(boxes), lo = frame[axis], span = frame[axis + 2] - lo
  const gap = span * 0.04, width = (span - gap * (boxes.length - 1)) / boxes.length
  return boxes.map((_, i) => {
    const box = frame.slice()
    box[axis] = lo + i * (width + gap)
    box[axis + 2] = box[axis] + width
    return box
  })
}

/** The operators this port draws beyond the composer's, with rooms and turns of its own choosing: a
 *  preview using them is approximate, and no stored drawing has them. */
export const APPROXIMATE = ['⿾', '⿿', '〾', '㇯', '⿼', '⿽']

/** The operators whose result no design can be checked against: a subtraction, an overlay, a
 *  mirrored or turned form, and the two enclosures that crush what they hold. A character built from
 *  one of these is only a guess, so a description carrying any of them is not composed at all.
 *  Repeated characters where the drawing is unreviewable; the rest the layout places predictably. */
export const UNPREDICTABLE = ['⿻', '㇯', '〾', '⿾', '⿼', '⿽', '⿴', '⿷']

/** Whether `description` may be composed. The description is flat text, so this covers every layer
 *  without walking the tree. @param {string} description */
export const composableDescription = description => ![...description].some(char => UNPREDICTABLE.includes(char))
const MIRROR = '⿾', ROTATE = '⿿', VARIANT = '〾', SUBTRACT = '㇯'
const EXTRA_ENCLOSE = { '⿼': 'RBT', '⿽': 'RB' }
const EXTRA_INSIDE = { '⿼': [0, 0.15, 0.8, 0.85], '⿽': [0, 0.25, 0.7, 1] }

// Contour partitions of the exact font-export glyphs. The digest ties each cut to its
// outlines: other fonts and later exports keep the usual geometric composition.
const ENCLOSURE_CUTS = {
  '⿽水丶': ['氷', {
    '28ff54a66b480707055ab6088d46e79d134020f143adc6403a6e2f8e66928327': [[0,1,3,4,5],[2]],
    '745eac7b7fecf77b76d949e954c3b6d315141be8297d65e19079f0467f332312': [[0,1,2,3,4],[5]],
    '5268c2cbbac2aa9fdb586cd7b478c95bede10b46379f4afd24ce42ec7ede5495': [[0,2],[1]],
  }],
  '⿽十⺀': ['斗', {
    '752e2007a0eb368d6c6133ea1179c9ca52de9606f0b798081cff58d47ca0b053': [[0,1],[2,3]],
    'eb98857e9d6fbd093e1ff8e2a5fb182c920483376a4e8c36f5fbd0da43f66372': [[2,3],[0,1]],
    'f53105473310a9f7cc54485ebadaf9828670deef3707ef2c095a5e97d24994f3': [[0],[1,2]],
  }],
  '⿽人⿰𠄌丶': ['以', {
    'd862658851387f879787ed51aab13b42825e0d1ae1295b2bea798b143d05cc72': [[2,3],[1,4],[0]],
    '00d8ce03d34eae498f722d8bad84bcf5d77a807654560eb8ba440d2d6dc7dd52': [[2,4],[0,3],[1]],
    '1ef49823562accfb65a808cce67594327e1bd9eceabeaff1683826af671c9209': [[0],[1],[2]],
  }],
  '⿽戈从': ['㦰', {
    'b7d2cd4473cf5cda692771db18ae491dd302efd7e0fdafe3582ee0dd909117de': [[4,5,6,7],[0,1,2,3]],
    'e0606c7982bcb036d9ec1a866509fcbe1f079a387534c36a78e4c7041dc2fdbd': [[0,1,2,3],[4,5,6,7]],
  }],
}

// Descriptions written with a variant of a component: ⿰查皮 names 皶, whose own sequence is ⿰査皮.
// The export has no cut for it because the left 一 and 皮's stroke overlap, so the font's designed
// glyph is partitioned here instead, one piece per leaf. The digest ties each partition to the
// outlines it was read from; another export keeps the geometric composition.
const VARIANT_CUTS = {
  '⿰查皮': ['皶', {
    'c8c37fe8c089233bb6a36f3e3170c0f173b4b9d6c155b470d0066fd8b4cd95a9': [[0,1,2,3,4,5,6,7],[8,9,10,11,12,13,14]],
    '0569d2e44325d2d0dc3c4a2ee2f26f044aa3fa08d623bd06a935b39dc5b419fe': [[0,1,2,3,4,5,6,7,8],[9,10,11,12,13,14,15]],
  }],
}

// Descriptions whose designed glyph no split of the parts reproduces: 鬱's 冖 runs under the top
// row and between 鬯 and 彡, so a composed 鬱 leaves a seam or a doubled stroke and reads as another
// character. The export's glyph is partitioned here, one piece per operand in reading order. A face
// whose glyph the digest does not name (Fangsong merges the top row into one outline) draws the
// whole glyph instead of a broken composition.
const YU_CUTS = {
  'fb9c7330b5c71f7e790ac36839fc97e904c1d8f042820ec0088a4422b509f3fb': [[0,1,3,4],[6,7,9,17,25],[2,5,8,24],[18],[10,11,12,13,14,15,16,19,20],[21,22,23]],
  'a56b3b57174cd99a9b3dc5a1f4266124b633b61d1258ce40e699f51c4db020aa': [[0,8,9,14],[2,4,5,18,28,29,30],[1,3,15,16],[17],[6,7,10,11,12,13,19,20,22,23,24,31],[21,25,26,27]],
  'a14ef02d3559416bf3d41ed615ac00fdef92479390e68602544bde166cb7ec47': [[2],[1],[0],[3],[5,6,7,8,9,11,13],[4,10,12]],
}

const LEAF_CUTS = {
  '⿳⿲木缶木冖⿰鬯彡': ['鬱', YU_CUTS],
}

/** The character whose designed glyph `sequence` is partitioned from, for a caller that must load
 *  its record before sketching. @param {string} sequence */
export const leafCutChar = sequence => LEAF_CUTS[sequence]?.[0] ?? null

// 身 shortens its first stroke and lifts its foot for the left column. The cuts from 射, 躬 and
// 躭 have that form; a cut from a dense neighbour (𨊂, 軀, 軆) keeps the standalone width, which
// reads as a whole character beside the right operand.
const LEFT_BODY_HOSTS = new Set(['射', '躬', '躭'])

// Kureedo draws no ⿺电; its ⿺巴 form (巴 round 三 in 𠀧, Kureedo's SIL OFL 1.1 face) presses the
// box of such a glyph to this share of the width and draws its foot out to the right edge.
const ENCLOSURE_SHARE = 0.485
// How much steeper the Möbius map starts the foot's stretch than its mean.
const FOOT_RATIO = 1.5

// Enclosing forms a designer drew for a whole operand: 电 as ⿺'s enclosing part, cut from 𫌷
// (⿺电言) in Noto Sans CJK JP and Noto Serif CJK JP, whose swept foot han-compose will not take for
// a host cut. The digest names the glyph's outlines; a font without that glyph presses its own
// outline instead (`pressedEnclosure`).
// The tail of a pressed enclosure, where the face draws one: Kureedo's 巴 as drawn round 三 in 𠀧
// (its outline and two windows). 巴's sweep — the leg below its box, the floor and the rising tip —
// becomes 电's 乚. The digest names the glyph; an export without it keeps the pressed foot.
const ENCLOSURE_TAILS = {
  电: ['𠀧', { '97647776e6a744399c766db1da6c1eb408c37901e4607ff6f613de6a71a99646': [0, 1, 2] }],
}

const ENCLOSURE_FORMS = {
  '⿺': {
    电: ['𫌷', {
      '656184795d653a390844e1bfd99e8efddfb5c36be68d683d9d8986984f150a85': [0, 1, 2, 3, 4],
      '2fa6f7b8e09a68c6173dafe84d5b96d5b4c36dc9a7e6b77703d9ed9f13ff525a': [0, 3, 4, 6, 7],
    }],
  },
  // 𭰲 (⿰氵⿵冂并) is the only encoded character with this shape; its frame serves the ⿵冂 enclosure.
  '⿵': {
    冂: ['𭰲', {
      '345749510c894ac303898cacbbd71bc35880cb6179990632d00b1ffe463f2d71': [3],
    }],
  },
}

// Left components the export carries no host cuts for, taken from a designed character's glyph.
const DESIGNED_CUTS = {
  氵: ['𭰲', {
    '345749510c894ac303898cacbbd71bc35880cb6179990632d00b1ffe463f2d71': [0, 1, 2],
  }],
}

export class Composer {
  /**
   * `data`: `{ manifest, layout, rec(key), hosts(key, place), places(key) }`; `exclude`: characters nothing is taken from (a
   * character redrawn to test, with its twins); `face`: the box a whole character fills, when those
   * characters change it (the manifest's is the median of `FULL` with none excluded); `separate`:
   * draw operands as individual pieces where possible, including cuts from a matching whole glyph,
   * so a view that changes one part can address its leaf.
   */
  constructor(data, { exclude = [], face = null, separate = false, fontStyle = 'sans', keepBars = false } = {}) {
    this.data = data
    const m = data.manifest, c = m.constants
    this.C = c
    this.layout = data.layout
    this.exclude = new Set(exclude)
    this.spelled = new Set(m.spelled)
    this.AXIS = c.AXIS
    this.ENCLOSE = { ...c.ENCLOSE, ...EXTRA_ENCLOSE }
    this.INSIDE = { ...c.INSIDE, ...EXTRA_INSIDE }
    this.SLOTS = c.SLOTS
    this.face = face ?? c.face
    this.separate = separate
    this.fontStyle = fontStyle
    this.keepBars = keepBars
    // `hosted` as han-compose's: with no host list there is nothing to cut, and the learned boxes —
    // where cut parts go — would stretch whole glyphs into component shapes (a squat 木, its bar
    // merged with its neighbour's). The export's own manifest says how many bytes of host lists it
    // carries.
    this.hosted = m.files?.hosts?.bytes !== 0
    // A static face keeps its own stroke weights; a variable export weights its parts.
    this.weighted = m.weighted ?? m.heavy !== 400
    this.stem0 = c.stem
    this.arities = new Map([...c.BINARY.map(op => [op, 2]), ...c.TERNARY.map(op => [op, 3]), ...c.UNARY.map(op => [op, 1])])
    this.expanding = new Set()
    this.approximate = new Set()
    this.coverCache = new Map()
    // Characters whose glyph the export lacks and whose sequence stands in for it.
    this.missingGlyphs = new Set()
    this.pyramids = new WeakMap()
    this.bases = new WeakMap()
    this.nativeEnclosures = new Set()
    this.normalizer = createRenderNormalizer({ record: key => this.rec(key), parse: text => this.parse(text), keyOf, excluded: key => this.excluded(key) })
    this.resolutions = new Map()
    // Stacked operand pairs, settled against their ink once the drawing is weighted.
    this.joints = []
  }

  arity = ch => this.arities.get(ch) ?? 0
  parse = sequence => parseTree(sequence, this.arity)
  // A key holding an empty slot has no record and no hosts: nothing is asked for it.
  rec = key => key.includes(EMPTY) ? null : (componentRecord(key, this.fontStyle) ?? this.data.rec(key))
  excluded = ch => this.exclude.has(ch)
  slot = (op, i) => this.SLOTS[op] ? this.SLOTS[op][i] : `${op}${i}`
  /**
   * The pyramid a node draws as, remembered for this drawing. A two-layer pyramid of one part keeps
   * the composer's designed forms for it (品, 森); a description or a slot has no designed form, so
   * its equal cells are the drawing, and every deeper pyramid draws in its cells.
   */
  pyramid(node) {
    if (typeof node === 'string' || !node || typeof node !== 'object') return pyramidRows(node)
    if (this.pyramids.has(node)) return this.pyramids.get(node)
    const found = pyramidRows(node, { minLayers: 2 })
    const designed = found && found.layers === 2 && typeof found.cell === 'string' && !isEmpty(found.cell)
    const answer = found && !designed ? found : null
    this.pyramids.set(node, answer)
    return answer
  }

  /**
   * The pyramid standing on a base that a node draws as, remembered for this drawing: rows of 1, 2,
   * … cells with one part under them, however the stack groups the rows. The rows are the drawing,
   * so a 品-shaped top spreads over the width in flat cells rather than stacking square ones.
   */
  pyramidWithBase(node) {
    if (typeof node === 'string' || !node || typeof node !== 'object') return pyramidOnBase(node)
    if (this.bases.has(node)) return this.bases.get(node)
    const answer = pyramidOnBase(node)
    this.bases.set(node, answer)
    return answer
  }

  /**
   * The parts of a pyramid standing on a base: its cells in the top `layers` of `layers + 1` rows,
   * the base across the rest. The cells spread over the full width, so each is wider than it is
   * tall; the base is drawn as a cell too, so a 木 under a 品 spans the width instead of standing
   * thin in the middle of it. A pyramid of empty slots numbers its cells in reading order, as one
   * drawn alone does.
   */
  baseParts({ cell, layers, base }, region) {
    const { cells, base: baseBox } = pyramidOnBaseLayout(region, layers)
    const drawn = hasSlot(cell)
      ? cells.flatMap((box, i) => this.node(i ? shiftedSlots(cell, i * slotsIn(cell)) : cell, box))
      : cells.flatMap(box => this.node(cell, box))
    return [...drawn, ...this.basePart(base, baseBox)]
  }

  /**
   * The base of a pyramid, drawn as a cell: a plain component fits its box with the wider stretch
   * a cell allows, so a wide, short base row fills its width. Anything else is drawn as usual.
   * @param {any} base @param {number[]} region */
  basePart(base, region) {
    if (typeof base === 'string' && base && !splitToneMarks(base).tones) {
      const glyph = this.glyph(base)
      if (glyph) {
        const ink = tightBox(glyph)
        return [placed(glyph, ink, fitted(ink, region, Math.max(this.C.STRETCH, CELL_STRETCH)), this.ink(base), `glyph ${base}`)]
      }
    }
    return this.node(base, region)
  }

  glyphRecord(ch) { const record = this.rec(ch); const glyph = record?.G; if (glyph && record.sg && !glyph.sg) glyph.sg = record.sg; return glyph ?? null }
  glyph(ch) { const g = this.glyphRecord(ch); return g ? partOf(g) : null }
  /** The glyph a whole character is drawn with: a body the font drew as another shape is replaced
   *  by `BODY_FORMS` where the export carries the glyph that cut was made for. A cut of the glyph
   *  (`pieceOf`) keeps the font's own contours. */
  drawnGlyph(ch, contain = false) {
    const record = this.glyphRecord(ch)
    if (!record) return null
    const form = BODY_FORMS[ch]
    const piece = (form ? bodyForm(record, this.glyphRecord(form.host), form) : null) ?? partOf(record)
    return contain ? this.pieceFor(ch, piece) : piece
  }
  /** A piece drawn for `key`, a glyph or a host cut, with the bar rule of `CONTAINED_MIDDLE_BARS`
   *  applied. */
  pieceFor(key, piece) {
    if (this.keepBars || typeof key !== 'string' || !CONTAINED_MIDDLE_BARS.has(key)) return piece
    return containedMiddleBar(piece)
  }
  /** Whether the variable font draws `ch`: its strokes can be weighted. */
  own(ch) { return this.glyphRecord(ch)?.v === 1 }
  /** A source occurrence's rendering identity. A composer is recreated after each loading pass. */
  resolution(node) {
    const key = keyOf(node)
    const known = this.resolutions.get(key)
    if (known) return known
    const plan = this.normalizer.resolve(node)
    // A plan the budget cut short may miss evidence the next call finds, so it is not kept.
    if (!plan.capped) this.resolutions.set(key, plan)
    return plan
  }
  /** Shared lookup key and metrics for descriptions that name the same form. */
  renderKey(node) { return this.resolution(node).key }
  /** The encoded glyph supported by the description's normalization evidence. */
  bySequence(key) {
    try { return this.resolution(this.parse(key)).encoded } catch { return null }
  }
  sequenceOf(ch) { return this.rec(ch)?.s ?? null }
  atomic(ch) { return this.rec(ch)?.at === 1 }

  /** Outline length: a glyph's, or for an excluded or glyphless character its sequence's operands'. */
  ink(node, seen = new Set()) {
    if (componentRecord(keyOf(node), this.fontStyle)) return componentRecord(keyOf(node), this.fontStyle).ink
    if (Array.isArray(node) && node[0] === '⿸' && this.yanStackedDays(node[1], node[2]))
      return this.ink(node[1], seen) + this.ink('儿', seen) + YAN_STACK_INK
    if (typeof node !== 'string') {
      const key = this.renderKey(node), record = this.rec(key)
      if (!this.excluded(key) && record?.G) return record.ink
      return node.slice(1).reduce((s, n) => s + this.ink(n, seen), 0)
    }
    const key = this.renderKey(node), r = this.rec(key)
    if (!this.excluded(key) && r?.G) return r.ink
    if (r?.s && !seen.has(key)) {
      try { return this.ink(this.parse(r.s), new Set([...seen, key])) } catch { /* unreadable: as unknown */ }
    }
    return !this.excluded('永') ? this.rec('永')?.ink ?? 1000 : 1000
  }

  /** Permitted outline count; zero when an operand is unknown. */
  outlines(node, seen = new Set()) {
    if (componentRecord(keyOf(node), this.fontStyle)) return componentRecord(keyOf(node), this.fontStyle).o
    if (typeof node === 'string') {
      const key = this.renderKey(node), r = this.rec(key)
      if (!this.excluded(key)) return r?.G ? r.G.p.length : 0
      if (r?.s && !seen.has(key)) {
        try { return this.outlines(this.parse(r.s), new Set([...seen, key])) } catch { /* unreadable */ }
      }
      return 0
    }
    const key = this.renderKey(node), record = this.rec(key)
    if (!this.excluded(key) && record?.G) return record.G.p.length
    const counts = node.slice(1).map(n => this.outlines(n, seen))
    return counts.every(Boolean) ? counts.reduce((a, b) => a + b, 0) : 0
  }

  /** Whether a sequence names a bare stroke among its operands. */
  stroked(node) {
    if (typeof node === 'string') { const p = node.codePointAt(0); return (p >= 0x31C0 && p <= 0x31EF) || this.outlines(node) === 1 }
    return node.slice(1).some(n => this.stroked(n))
  }

  place(part, target, native, origin) {
    const p = placed(part, part.box, fitted(part.box, target, this.C.STRETCH), native, origin)
    if (part.fixed) p.fixed = true
    return p
  }

  // ---------------------------------------------------------------- the composer's entry
  /** The parts drawing `sequence`, weighted, and the loose `marks` its text carries after it. */
  compose(sequence, marks = '') {
    this.approximate.clear()
    this.nativeEnclosures.clear()
    this.joints.length = 0
    let slots = 0
    const number = node => node === EMPTY ? `${EMPTY}${slots++}` : Array.isArray(node) ? mapOperands(node, number) : node
    const tree = this.normalizeYan(number(this.cancelTransforms(this.parse(sequence))))
    const rendered = this.normalizeRequestedEnclosures(tree)
    // A mark that sits beside the drawing takes a margin: the character shrinks toward the opposite
    // corner, so the mark stands outside its strokes instead of over them.
    const frame = this.face.slice()
    const face = this.faceBeside(marks)
    const previous = this.face
    this.face = face
    try {
      let out = this.node(this.standaloneExpandedOverlay(rendered) ?? this.standalonePyramid(rendered) ?? this.standaloneRepeatedGrid(rendered) ?? this.normalizeRepeatedGrids(rendered), this.face.slice(), true)
      // Separated drawings retain reading order. Only publish ownership when every
      // rendered leaf produced exactly one piece (including empty placeholders).
      const ownership = this.separate ? this.leafOwners(tree) : null
      // A toned syllable draws more parts than leaves, so its drawing needs the owners even where
      // the tree was not split.
      if (ownership && (ownership.split || out.some(p => p.origin?.startsWith('mark '))) && !out.some(p => p.cut)) {
        // A toned syllable draws its marks beside it; they belong to the leaf they mark.
        const before = out.map(part => part.leaf)
        let owner = 0, current = null
        for (const part of out) {
          if (part.origin?.startsWith('mark ')) part.leaf = current
          else part.leaf = current = ownership.owners[owner++]
        }
        // The walk only answers for a drawing of one part per leaf; another keeps the leaves it
        // was drawn with.
        if (owner !== ownership.owners.length) out.forEach((part, i) => {
          if (before[i] === undefined) delete part.leaf
          else part.leaf = before[i]
        })
      }
      if (!this.partial && this.weighted) this.balance(out)
      this.settleJoints()
      const construct = CONSTRUCTS[sequence]
      // The bundled body is Noto's: a face with its own forms keeps the drawing it made. A nested
      // construct is drawn where its description is a component (`node`), not here.
      if (construct && !construct.nested && !ownFormsOnly(this.fontStyle)) {
        const hosts = new Set([construct.host, ...(construct.cuts ?? []).map(cut => cut.host)])
        if (![...hosts].some(host => this.excluded(host)))
          out = constructParts(construct, out, Object.fromEntries([...hosts].map(host => [host, this.glyphRecord(host)])), this.face)
      }
      // Layout can squeeze an operand after it was placed. Restore native proportions within its
      // final allocation so a contextual cut keeps the donor font's stroke widths.
      for (const part of out) if (part.nativeAspect) {
        const [x0, y0, x1, y1] = part.target
        const [sx0, sy0, sx1, sy1] = part.source
        const scale = Math.min((x1 - x0) / (sx1 - sx0), (y1 - y0) / (sy1 - sy0))
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
        const w = (sx1 - sx0) * scale, h = (sy1 - sy0) * scale
        part.target = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]
      }
      // Loose marks annotate the whole drawing; they take no part in its layout or weight.
      if (marks) out.push(...markParts(this, marks, frame, face))
      return out
    } finally { this.face = previous }
  }

  /** Whether `tree` is drawn in cells (`compose`'s `layout: 'auto'`): no character spells it as a
   *  whole, it has at least `CELL_LEAVES` leaves, every leaf is a glyph or an empty slot, and every
   *  node is an axis or an enclosure this layout splits without approximation. A description this
   *  dense has no designed host forms; drawn in place, its parts overlap each other. */
  cellsFor(tree, marks = '') {
    if (marks || this.exclude.size) return false
    // Cell scaffolds already have a complete layout; searching every repeated subtree adds no evidence.
    if (this.pyramid(tree) || this.pyramidWithBase(tree)) return false
    const key = keyOf(tree)
    if (this.bySequence(key) || this.spelled.has(key)) return false
    if (isGroupedForm(key, this.fontStyle) || isComponentForm(key, this.fontStyle)) return false
    let leaves = 0, supported = true
    const walk = node => {
      if (!Array.isArray(node)) {
        leaves++
        const { rest } = typeof node === 'string' ? splitToneMarks(node) : { rest: node }
        if (!isEmpty(node) && !this.glyph(rest)) supported = false
        return
      }
      const op = node[0]
      if (APPROXIMATE.includes(op) || (!(op in this.AXIS) && !(op in this.ENCLOSE))) { supported = false; return }
      node.slice(1).forEach(walk)
    }
    walk(tree)
    return supported && leaves >= CELL_LEAVES
  }

  /** The parts of `tree` drawn in cells: one glyph (or empty slot) per leaf, in a cell its operator
   *  gives it. An alignment axis below the top shares its cells by the ink of its parts, or by leaf
   *  count when it holds an empty slot; an enclosure always shares by leaf count. Parts keep the
   *  tree's reading order on an axis chosen for the cell's shape, so no cell overlaps another.
   *  `region` is the box the grid fills (the frame's opening for an inner grid); a grid drawn as
   *  part of a larger drawing passes `leafIndices: false`, since its leaves are not its own. */
  cellLayout(tree, region = this.face, { leafIndices = true } = {}) {
    let slots = 0
    const number = node => node === EMPTY ? `${EMPTY}${slots++}` : Array.isArray(node) ? mapOperands(node, number) : node
    const numbered = number(tree)
    const out = []
    let leaf = 0
    const f = region, width = f[2] - f[0], height = f[3] - f[1]
    const target = box => [f[0] + box[0] * width, f[1] + (1 - box[3]) * height, f[0] + box[2] * width, f[1] + (1 - box[1]) * height]
    const inset = box => {
      const w = box[2] - box[0], h = box[3] - box[1]
      return [box[0] + w * CELL_INSET, box[1] + h * CELL_INSET, box[2] - w * CELL_INSET, box[3] - h * CELL_INSET]
    }
    const leaves = node => typeof node === 'string' ? 1 : node.slice(1).reduce((sum, kid) => sum + leaves(kid), 0)
    // The ink of a toned syllable is the ink of its syllable: the mark is no part of the weight.
    const baseOf = node => typeof node === 'string' ? splitToneMarks(node).rest : node
    // Fit the ink, not the glyph's placement box: a designed glyph's strokes can reach past it,
    // and inside a cell that overflow runs into the next cell.
    const hasEmpty = node => isEmpty(node) || (Array.isArray(node) && node.slice(1).some(hasEmpty))
    const split = (kids, axis, box, equal, override = null, dense = false) => {
      // An axis takes its shares from the ink of its parts: a column of six dense parts needs more
      // width than one tall 身. A placeholder has no ink, so an axis holding one keeps leaf shares.
      const fallback = !dense || kids.some(hasEmpty)
      const weights = override ?? kids.map(kid => equal ? 1 : fallback ? Math.sqrt(leaves(kid)) : Math.max(this.ink(baseOf(kid)), 1) ** 0.8)
      const sum = weights.reduce((a, b) => a + b, 0)
      const lo = box[axis], span = box[axis + 2] - lo
      let at = lo
      return kids.map((kid, i) => {
        const size = span * weights[i] / sum
        const b = box.slice()
        b[axis] = at + (i ? CELL_GAP / 2 : 0)
        b[axis + 2] = at + size - (i < kids.length - 1 ? CELL_GAP / 2 : 0)
        at += size
        return b
      })
    }
    const walk = (node, box, depth) => {
      if (isEmpty(node)) {
        const part = this.placeholder(node, inset(target(box)))
        if (leafIndices) part.leaf = leaf++
        out.push(part)
        return
      }
      if (typeof node === 'string') {
        const { rest, tones } = splitToneMarks(node)
        // A tone mark annotates the syllable before it. With nothing before it there is no syllable
        // to tone, and it is a loose mark like U+0300: it draws as the glyph it is.
        if (tones && rest) {
          const parts = this.toneLeaf(rest, tones, inset(target(box)), true)
          for (const part of parts) part.leaf = leaf
          leaf++
          out.push(...parts)
          return
        }
        const glyph = this.glyph(node)
        if (!glyph) throw new LookupError(`No glyph draws ${node}.`)
        // A cell allows a little more stretch than a composed part, so the glyph fills it; a
        // narrow cell still keeps the glyph's proportions instead of turning it into a sliver.
        const cell = inset(target(box)), inkBox = tightBox(glyph)
        const part = placed(glyph, inkBox, fitted(inkBox, cell, Math.max(this.C.STRETCH, CELL_STRETCH)), this.ink(node), `cells ${node}`)
        if (leafIndices) part.leaf = leaf++
        out.push(part)
        return
      }
      const op = node[0], kids = node.slice(1)
      if (op in this.AXIS) {
        // The top of a stacked description is one part over many; the reference design gives it
        // less than a third of the height.
        const topShare = depth === 0 && this.AXIS[op] === 1 && kids.length === 2 && leaves(kids[0]) === 1 ? [CELL_TOP, 1 - CELL_TOP] : null
        const boxes = split(kids, this.AXIS[op], box, depth === 0, topShare, true)
        // The middle row of a three-row description is inset across, as in the reference.
        if (op === '⿳' && kids.length === 3) {
          const b = boxes[1], w = b[2] - b[0]
          b[0] += w * CELL_MIDDLE_INSET
          b[2] -= w * CELL_MIDDLE_INSET
        }
        kids.forEach((kid, i) => walk(kid, boxes[i], depth + 1))
        return
      }
      if (op in this.ENCLOSE) {
        // An enclosure whose outer operand is one part holds that part around the rest: cells that
        // split the two apart stand the frame away from what it holds (𠕲's 冂 above its rows).
        if (typeof kids[0] === 'string' && !isEmpty(kids[0])) {
          const glyph = this.glyph(kids[0])
          const region = target(box)
          if (glyph) {
            const ink = tightBox(glyph)
            const outer = placed(glyph, ink, fitted(ink, region, Math.max(this.C.STRETCH, CELL_STRETCH)), this.ink(kids[0]), `cells ${kids[0]}`)
            const room = this.room(op, [outer], region)
            if (room) {
              if (leafIndices) outer.leaf = leaf++
              out.push(outer)
              const width = f[2] - f[0], height = f[3] - f[1]
              walk(kids[1], [(room[0] - f[0]) / width, 1 - (room[3] - f[1]) / height,
                (room[2] - f[0]) / width, 1 - (room[1] - f[1]) / height], depth + 1)
              return
            }
          }
        }
        const namedAxis = CELL_AXIS[op] ?? 0
        // A cell narrower than it is tall reads better with its parts stacked, and a much wider one
        // side by side, whatever the enclosure's own direction.
        const across = box[2] - box[0], down = box[3] - box[1]
        const axis = namedAxis === 0 && across < down * 0.9 ? 1 : namedAxis === 1 && down < across * 0.8 ? 0 : namedAxis
        const boxes = split(kids, axis, box, false)
        // A side-split enclosure's inner part sits inside its outer, so it takes less of the cell's
        // height; the reference puts 意 to the right of 平/惡, not from top to bottom.
        if (axis === 0) {
          const b = boxes[1], h = b[3] - b[1]
          b[1] += h * CELL_INNER_INSET
          b[3] -= h * CELL_INNER_INSET
        }
        walk(kids[0], boxes[0], depth + 1)
        walk(kids[1], boxes[1], depth + 1)
        return
      }
      throw new LookupError(`${op} is not laid out.`)
    }
    walk(numbered, [0, 0, 1, 1], 0)
    if (!this.partial && this.weighted) this.balance(out)
    return out
  }

  /**
   * Where each leaf of `sequence` goes before anything of it is drawn, from the layout alone: the
   * learned boxes where the composer would ask the network (reading whatever records are loaded, a
   * place's defaults for the rest), even shares of the axis elsewhere, and for an enclosure the
   * region and its `INSIDE`. Answers `{ index, box, empty }` per leaf in reading order, boxes in
   * font units, y up.
   */
  sketch(sequence, marks = '') {
    const previous = this.face
    this.face = this.faceBeside(marks)
    try { return this.sketched(sequence) } finally { this.face = previous }
  }

  /** The face a character takes beside its outbound marks: the whole face where none needs room. @param {string} marks */
  faceBeside(marks) {
    const frame = this.face.slice()
    const outbound = [...marks].filter(isOutbound).join('')
    if (!outbound) return frame
    const probe = markParts(this, outbound, frame, frame)
    if (!probe.length) return frame
    const fitted = markFace(frame, union(probe.map(part => part.target)))
    return fitted.scale < 1 ? fitted.face : frame
  }

  /** The leaves of `sequence` laid out in the current face. */
  sketched(sequence) {
    const partitioned = this.leafCutSketch(sequence)
    if (partitioned) return partitioned
    const out = []
    const walk = (node, region, atRoot) => {
      const pyramid = this.pyramid(node)
      if (pyramid) {
        // One box per leaf of the repeated cell, in the cell the pyramid gives it.
        for (const box of pyramidCells(region, pyramid.layers, { direction: pyramid.direction })) walk(pyramid.cell, box, false)
        return
      }
      const stacked = this.pyramidWithBase(node)
      if (stacked) {
        const { cells, base } = pyramidOnBaseLayout(region, stacked.layers)
        for (const box of cells) walk(stacked.cell, box, false)
        walk(stacked.base, base, false)
        return
      }
      const repeated = isGroupedForm(keyOf(node), this.fontStyle) ? componentParts(keyOf(node), region, this.fontStyle, atRoot) : null
      if (repeated) {
        for (const part of repeated) out.push({ index: out.length, box: part.target, empty: false })
        return
      }
      if (!Array.isArray(node)) { out.push({ index: out.length, box: region, empty: node === EMPTY }); return }
      const grid = this.repeatedGrid(node)
      if (grid) {
        const start = out.length
        walk(grid.tree, region, atRoot)
        const leaves = out.splice(start)
        for (const i of grid.order) out.push({ ...leaves[i], index: out.length })
        return
      }
      const enclosure = this.splitEnclosure(node)
      if (enclosure) {
        const start = out.length
        walk(enclosure.tree, region, atRoot)
        const leaves = out.splice(start)
        const leafCount = n => Array.isArray(n) ? n.slice(1).reduce((sum, kid) => sum + leafCount(kid), 0) : 1
        const inner = leaves.splice(enclosure.innerIndex, leafCount(node[2]))
        if (leafCount(node[1]) === 1) out.push({ index: out.length, box: union(leaves.map(leaf => leaf.box)), empty: false })
        else {
          const order = this.repeatedGrid(node[1])?.order ?? leaves.map((_, i) => i)
          for (const i of order) out.push({ ...leaves[i], index: out.length })
        }
        for (const leaf of inner) out.push({ ...leaf, index: out.length })
        return
      }
      const op = node[0], kids = node.slice(1)
      if (kids.length === 2 && this.hosted && this.layout && this.hasHosts(op, kids) && (atRoot ? this.layout.ops.includes(op) : op === '⿰' || op === '⿱')) {
        let boxes = this.predict(op, kids.map(kid => this.normalizeRepeatedGrids(this.normalizeRequestedEnclosures(kid))))
        if (!atRoot) { const frame = union(boxes); boxes = boxes.map(b => mapped(b, frame, region)) }
        if (boxes.every(b => b[2] > b[0] && b[3] > b[1])) { kids.forEach((kid, i) => walk(kid, boxes[i], false)); return }
      }
      if (op in this.AXIS) {
        const axis = this.AXIS[op], lo = region[axis], span = (region[axis + 2] - lo) / kids.length
        kids.forEach((kid, i) => {
          const box = region.slice(), k = axis ? kids.length - 1 - i : i
          box[axis] = lo + k * span
          box[axis + 2] = lo + (k + 1) * span
          // A short stack in a tall column of a ⿲ takes the top of its column, as `shares` draws it.
          walk(kid, (op === '⿲' && axis === 0 ? this.shortStackBox(kid, box) : null) ?? box, false)
        })
      } else if (this.INSIDE[op]) {
        walk(kids[0], region, false)
        const [x0, y0, x1, y1] = this.INSIDE[op], w = region[2] - region[0], h = region[3] - region[1]
        walk(kids[1], [region[0] + x0 * w, region[1] + y0 * h, region[0] + x1 * w, region[1] + y1 * h], false)
      } else if (op === MIRROR || op === ROTATE) {
        // About the region's centre, as `flipped` draws it: ⿾ mirrors each box, ⿿ turns it half round.
        const from = out.length
        walk(kids[0], region, atRoot)
        for (const leaf of out.slice(from)) {
          const [x0, y0, x1, y1] = leaf.box, turned = op === ROTATE
          leaf.box = [region[0] + region[2] - x1, turned ? region[1] + region[3] - y1 : y0, region[0] + region[2] - x0, turned ? region[1] + region[3] - y0 : y1]
        }
      } else kids.forEach(kid => walk(kid, region, false))
    }
    walk(this.normalizeYan(this.cancelTransforms(this.parse(sequence))), this.face.slice(), true)
    return out
  }

  /** An empty slot's placeholder: no ink, in the box its node gives it, with the slot's number. */
  placeholder(node, region) {
    return { ...placed(makePart([], region.slice()), region.slice(), region.slice(), 0, 'empty'), empty: Number(node.slice(1)) }
  }

  /** Preferred host keys depend on rendering identity, independently of the input spelling. */
  alternatives(node, place) {
    const key = this.renderKey(node)
    const out = [key]
    for (const form of this.rec(key)?.a?.[place] ?? []) if (!out.includes(form)) out.push(form)
    return out
  }

  /** The host pieces of `written` in `place`; with `uncut`, also the entries the export lists without
   *  a piece, which the composer weighs before finding it cannot cut them. */
  hostsOf(written, place, uncut = false) {
    if (written.includes(EMPTY)) return []
    const list = this.data.hosts(written, place)
    return uncut ? list : list.filter(h => this.cutOf(h))
  }

  /** Whether the export lists a host for a node's operands in their places. An export that names
   *  its host places (`files.hosts.places`) can carry some operands only; a node without a list
   *  takes the plain shares. An export without the list is taken to cover what it carries. */
  hasHosts(op, children) {
    if (!this.hosted) return false
    const places = this.data.manifest.files?.hosts?.places
    if (!places) return true
    return children.some((child, i) => places.includes(`${this.slot(op, i)}\t${this.renderKey(child)}`))
  }

  /** What a host entry's cut is known by before its outlines are read: its box and its contour
   *  count; null for an entry the composer could not cut. An entry carries its piece's outlines
   *  (`p`), or the indices of the host glyph's contours it keeps (`k`). */
  cutOf(h) {
    // A cut only a parity drawing made, under its exclusion, is no cut for a sequence typed whole.
    if (h.pc && !this.exclude.size) return null
    if (h.p) return { box: h.b, count: h.p.length }
    if (h.k) return { box: h.b, count: h.k.length }
    return null
  }

  /** A host entry's piece: its own outlines, or the contours it keeps of its host's glyph, read from
   *  the host's record when the piece is chosen. */
  pieceOf(h) {
    let piece = h.p ? partOf(h) : h._piece
    if (!piece) {
      const glyph = this.glyph(h.h)
      if (!glyph) return makePart([], h.b.slice())
      piece = derived(glyph, h.k.map(k => glyph.contours[k]), h.b.slice())
      Object.defineProperty(h, '_piece', { value: piece, enumerable: false })
    }
    // A piece cut along KanjiVG's groups, which a drawing using it credits.
    if (h.kv && !piece.kv) Object.defineProperty(piece, 'kv', { value: true, enumerable: false })
    return piece
  }

  /** A ranked host as the callers take it: the entry, and its piece read when first asked for. */
  chosen(h) {
    const self = this
    return { record: h, get piece() { return self.pieceOf(h) } }
  }

  /** The parts drawing `node` in `region`, with the correction its description carries, where the
   *  component is one the font cuts wrong (`COMPONENT_FIXES`). */
  node(node, region, atRoot = false, sideBySide = false) {
    const construct = CONSTRUCTS[keyOf(node)]
    if (construct?.nested) {
      const hosts = new Set([construct.host, ...(construct.cuts ?? []).map(cut => cut.host)])
      if (![...hosts].some(host => this.excluded(host))) {
        const parts = constructParts(construct, [], Object.fromEntries([...hosts].map(host => [host, this.glyphRecord(host)])), region)
        if (parts.length) return parts
      }
    }
    return componentFix(keyOf(node), this.drawNode(node, region, atRoot, sideBySide), this, region)
  }

  drawNode(node, region, atRoot = false, sideBySide = false) {
    if (isEmpty(node)) return [this.placeholder(node, region)]
    if (!atRoot && sideBySide && typeof node === 'string') {
      const designed = this.designedCut(node)
      if (designed) return [placed(designed.piece, designed.piece.box, fitted(designed.piece.box, region, this.C.STRETCH), this.ink(designed.record.h), `host ${designed.record.h}`)]
    }
    const pyramid = this.pyramid(node)
    if (pyramid) {
      const cells = pyramidCells(region, pyramid.layers, { direction: pyramid.direction })
      // A pyramid of empty slots draws one placeholder per cell, numbered in reading order; a cell
      // of several slots takes the next numbers each time it repeats.
      if (hasSlot(pyramid.cell)) {
        const slots = slotsIn(pyramid.cell)
        return cells.flatMap((box, i) => this.node(i ? shiftedSlots(pyramid.cell, i * slots) : pyramid.cell, box))
      }
      return cells.flatMap(box => this.node(pyramid.cell, box))
    }
    const native = this.enclosureParts(node, region)
    if (native) return native
    const interlocked = this.leafParts(node, region)
    if (interlocked) return interlocked
    const designed = this.variantParts(node, region)
    if (designed) return designed
    const key = keyOf(node), nativeSource = yanGlyphs.get(key) ?? yanSources.get(key)
    // A description the font draws as a variation sequence keeps that outline, where the export
    // still draws the glyph the outline was read against. An export that draws another base composes
    // its operands; a source without a drawable base keeps the prepared form.
    const ivd = IVD_FORMS[key]
    const ivdRecord = ivd && !this.excluded(ivd.base) ? this.glyphRecord(ivd.base) : null
    if (ivd && ivdRecord && (!this.separate || isGroupedForm(key, this.fontStyle))) {
      const variant = ivdParts(ivd, key, ivdRecord, this.fontStyle, region, atRoot)
      if (variant) return variant
    }
    const repeated = (!nativeSource || !this.excluded(nativeSource)) && (!this.separate || isGroupedForm(key, this.fontStyle)) && !ivdRecord
      ? componentParts(key, region, this.fontStyle, atRoot) : null
    if (repeated) return repeated
    const hasRepetition = containsComponentForm(keyOf(node), this.fontStyle)
    const C = this.C
    let encoded = typeof node === 'string' ? node : hasRepetition ? null : this.spelled.has(keyOf(node)) ? null : this.bySequence(keyOf(node))
    if (atRoot && typeof node !== 'string') {
      const redrawn = [...this.exclude].find(ch => this.sequenceOf(ch) === keyOf(node))
      if (redrawn) encoded = redrawn
    }
    // A syllable with tone marks splits before any whole-character lookup, since no character
    // carries a tone. A mark with nothing to follow has no syllable to tone and stays an ordinary
    // component, drawn as its own glyph.
    if (typeof node === 'string') {
      const { rest, tones } = splitToneMarks(node)
      if (tones && rest) return this.toneLeaf(rest, tones, region)
      // A run of conjoining jamo has no glyph of its own; its letters stand in the syllable's 配置.
      if (isJamoRun(node)) return this.runLeaf(node, region)
    }
    if (this.separate && Array.isArray(node)) encoded = null
    if (encoded && !this.expanding.has(encoded) && (typeof node === 'string' || !this.excluded(encoded))) {
      const glyph = this.drawnGlyph(encoded, !atRoot)
      let tree = typeof node !== 'string' ? node : null
      if (!tree && this.sequenceOf(encoded) && !this.excluded(encoded)) {
        try { tree = this.parse(this.sequenceOf(encoded)) } catch (error) {
          if (!glyph) throw new LookupError(`${encoded} has no glyph, and its sequence is malformed.`)
        }
        if (typeof tree === 'string') tree = null
      }
      let squeezed = glyph !== null && stretchOf(glyph.box, region) > C.STRETCH
      if (tree && (this.stroked(tree) || this.atomic(encoded))) squeezed = false
      if (glyph && !(squeezed && tree)) {
        if (sideBySide && encoded === '\u{F2A9}' && this.fontStyle === 'sans') {
          // The native cut from 葭 already has its contextual proportions.
          const context = partOf(numberedFiveContext.G)
          const [x0, y0, x1, y1] = context.box
          const scale = Math.min((region[2] - region[0]) / (x1 - x0), (region[3] - region[1]) / (y1 - y0))
          const cx = (region[0] + region[2]) / 2, cy = (region[1] + region[3]) / 2
          const w = (x1 - x0) * scale, h = (y1 - y0) * scale
          return [{ ...placed(context, context.box, [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], numberedFiveContext.ink, `glyph ${encoded}`), fixed: true, nativeAspect: true }]
        }
        return [this.place(glyph, region, this.ink(encoded), `glyph ${encoded}`)]
      }
      if (!tree) throw new LookupError(`No glyph or sequence draws ${encoded}.`)
      if (!glyph) this.missingGlyphs.add(encoded)
      this.expanding.add(encoded)
      try { return this.node(tree, region, atRoot) } catch (error) {
        if (!glyph || !(error instanceof LookupError)) throw error
        return [this.place(glyph, region, this.ink(encoded), `glyph ${encoded}`)]
      } finally { this.expanding.delete(encoded) }
    }
    if (typeof node === 'string') {
      const glyph = this.drawnGlyph(node, !atRoot)
      if (!glyph) throw new LookupError(`No glyph or sequence draws ${node}.`)
      return [this.place(glyph, region, this.ink(node), `glyph ${node}`)]
    }
    const coverHead = Array.isArray(node) && typeof node[1] === 'string' && this.isCover(node[1])
    const found = this.separate || hasRepetition || isRepeatedRow(node) || this.spelled.has(keyOf(node)) || coverHead ? null : this.instance(node, region)
    if (found) return [found]
    const stacked = this.pyramidWithBase(node)
    if (stacked) return this.baseParts(stacked, region)
    const written = this.respelled(node)
    // Once nothing draws this node whole, a run of it the export designs as one body is regrouped.
    // A rewrite stands as it is: an enclosure written as a stack (㗊 as ⿳吅X吅) holds its operand
    // between the halves of a frame, which is no run to group.
    node = (written === node ? this.groupedStack(node) : null) ?? written
    const op = node[0], children = node.slice(1)
    // Two syllables in one block close up as the manuscript sets them; an ideograph's two operands
    // would halve the face and leave the pair standing apart.
    if (op === '⿱' && children.length === 2 && children.every(isHangulSyllable)) return this.hangulBlock(children, region)
    if (op === MIRROR || op === ROTATE) return this.flipped(op, children[0], region, atRoot)
    if (op === VARIANT) return this.node(children[0], region, atRoot)
    if (op === SUBTRACT) return this.subtracted(children, region, atRoot)
    if (!(op in this.AXIS) && !(op in this.ENCLOSE) && op !== '⿻') throw new LookupError(`${op} is not laid out.`)
    if (op === '⿻') return this.overlay(children, region)
    // A ⿵ whose outer operand is a roof (入 over 一, as in 兪's top) has no opening for the inner
    // part: the description as a whole is a stack, the bar under the roof. Laid as an enclosure,
    // the roof stretches over the whole cell and the bar lands in the slot between its feet. The
    // stack is laid out from its two operands; written ⿱, the same pair also spells 𠓛, whose
    // glyph is the font's cut of it.
    if (atRoot && op === '⿵' && this.roof(children[0], region ?? this.face)) return this.shares('⿱', children, region, atRoot)
    if (!this.separate && this.rowHoldsEnclosure(node)) {
      const adopted = this.enclosureRow(op, children, region)
      if (adopted) return adopted
    }
    const legs = !this.separate && op === '⿸' && this.legEnclosure(children, region)
    if (legs) return legs
    const yan = !this.separate && op === '⿸' && this.yanEnclosure(children, region)
    if (yan) return yan
    // As a left-bottom surround, ⿳𠂉一乙 uses 𣱪's frame across the whole cell.
    // Its standalone construct uses 气; the enclosing form keeps the host's wider opening.
    const surround = op === '⿺' && !this.separate ? SURROUND_CONSTRUCTS[keyOf(children[0])] : null
    if (surround) {
      const frame = constructBody(surround, region)
      if (frame) {
        // The frame's own ink leaves the room the surrounded part fills, as 𣱪 draws it; the natural
        // stack would leave a smaller pocket between its strokes.
        const [x0, y0, x1, y1] = this.INSIDE[op]
        const w = region[2] - region[0], h = region[3] - region[1]
        const room = this.room(op, [frame], region)
          ?? [region[0] + x0 * w, region[1] + y0 * h, region[0] + x1 * w, region[1] + y1 * h]
        return [frame, ...this.node(children[1], room)]
      }
    }
    // Native compound forms have no trained layout features; fit their actual outlines.
    if (this.hosted && this.layout && (!hasRepetition || ownFormsOnly(this.fontStyle)) && children.length === 2 && this.hasHosts(op, children) && (atRoot ? this.layout.ops.includes(op) : op === '⿰' || op === '⿱')) {
      // A description nothing in the export spells as one character has nothing to integrate a host
      // cut with, so each operand is drawn from its own glyph.
      const learned = this.learned(op, children, atRoot ? null : region, !this.bySequence(keyOf(node)))
      if (learned) return learned
    }
    if (!this.separate && !hasRepetition && atRoot && op in this.AXIS && !this.rowHoldsEnclosure(node)) {
      const moved = this.transplant(op, children)
      if (moved) return moved
    }
    return this.shares(op, children, region, atRoot)
  }

  /** Two syllables in one block, set at the split the manuscript's blocks keep: the upper takes
   *  the top 54%, the lower the rest, and the lower reaches a little into the upper's band so the
   *  pair closes up rather than standing apart as two characters. @param {(string | any[])[]} children @param {number[]} region */
  hangulBlock(children, region) {
    const [x0, y0, x1, y1] = region, w = x1 - x0, h = y1 - y0
    const parts = children.map(child => {
      const { rest, tones } = typeof child === 'string' ? splitToneMarks(child) : { rest: child, tones: '' }
      return { run: typeof rest === 'string' ? runOfSyllable(rest) : '', node: rest, tones }
    })
    // Two syllables whose vowels sit under their initials run their letters down one column:
    // ᄃᆞ over 륵 sets ㄷ ᆞ ㄹ ㅡ ㄱ from top to bottom.
    const below = part => DOT_VOWELS.has(jamoVowel(part.run)) || BELOW_VOWELS.has(jamoVowel(part.run))
    const column = parts.every(part => part.run && below(part))
    // In a column the marks of both syllables stand together at the left of the block.
    // In a column the marks of both syllables stand together at the left of the block, sized as a
    // syllable's mark is rather than as the whole block's.
    const markFrame = [x0, y0 + h * 0.25, x0 + w * 0.5, y0 + h * 0.75]
    const marks = column ? markParts(this, parts.map(part => part.tones).join(''), markFrame, region) : []
    const face = marks.length ? markFace(region, union(marks.map(part => part.target))).face : region
    const [fx0, fy0, fx1, fy1] = face
    const fw = fx1 - fx0, fh = fy1 - fy0
    const letters = column ? parts.flatMap(part => [...part.run]) : []
    let drawn
    if (column) {
      // The consonants keep one size and the vowels most of it, so nothing runs thin, and every
      // letter takes the block's width the way the workshop's own drawings fill their face.
      const VOWEL = 0.78
      // Each letter's box runs a little past its slot, so neighbour strokes close up as they do in
      // the workshop's own drawings instead of leaving white between them.
      const OVERLAP = 0.1
      const kinds = letters.map(letter => jamoClass(letter))
      const consonants = kinds.filter(kind => kind !== 'V').length, vowels = kinds.length - consonants
      const unit = fh / (consonants + vowels * VOWEL)
      let top = fy1
      drawn = []
      letters.forEach((letter, i) => {
        const tall = kinds[i] === 'V', slot = tall ? unit * VOWEL : unit
        const height = slot * (1 + OVERLAP), width = fw * (tall ? 0.9 : 0.72)
        const cx = fx0 + fw / 2
        drawn.push(...this.runLeaf(letter, [cx - width / 2, top - height + (height - slot) / 2, cx + width / 2, top + (height - slot) / 2]))
        top -= slot
      })
    } else {
      // Both syllables share one span across the block, so neither stands off its partner.
      const upper = [x0 + 0.02 * w, y0 + 0.52 * h, x0 + 0.98 * w, y1]
      const lower = [x0 + 0.02 * w, y0, x0 + 0.98 * w, y0 + 0.58 * h]
      // A tone mark takes room at the left of its syllable; both syllables keep the same body
      // box, at full height, so neither is squashed or stands off the other.
      const boxes = [upper, lower]
      const voice = parts.map((part, index) => (part.tones ? markParts(this, part.tones, boxes[index], boxes[index]) : []))
      const gap = Math.min(w, h) * 0.06
      const inset = Math.max(0, ...voice.map(marks => (marks.length ? Math.max(...marks.map(mark => mark.target[2] - x0)) + gap : 0)))
      const syllable = (index) => {
        const part = parts[index], [, by0, bx1, by1] = boxes[index]
        const inner = inset ? [x0 + inset, by0, bx1, by1] : boxes[index]
        const body = part.run ? this.runLeaf(part.run, inner) : this.node(part.node, inner)
        for (const mark of voice[index]) mark.fixed = true
        return [...body, ...voice[index]]
      }
      drawn = [...syllable(0), ...syllable(1)]
    }
    for (const mark of marks) mark.fixed = true
    return [...drawn, ...marks]
  }

  /** A run of conjoining jamo that no glyph spells, stood in its syllable's 配置: the initial
   *  above a horizontal vowel or beside a vertical one, the final below, and the 아래아 a dot of
   *  its own under the initial. Every letter is drawn from its own outline, so the run carries the
   *  drawing's ink and weight like any other component.
   *  @param {string} run @param {number[]} region */
  runLeaf(run, region) {
    const [x0, y0, x1, y1] = region, w = x1 - x0, h = y1 - y0
    /** @param {number} a @param {number} b @param {number} c @param {number} d */
    const box = (a, b, c, d) => [x0 + a * w, y0 + b * h, x0 + c * w, y0 + d * h]
    const chars = [...run]
    const classes = chars.map(jamoClass)
    let at = 0
    const initial = chars[at++]
    /** @type {string[]} */ const vowels = []
    while (classes[at] === 'V') vowels.push(chars[at++])
    /** @type {string[]} */ const finals = []
    while (classes[at] === 'T') finals.push(chars[at++])
    if (!vowels.length) return this.node(initial, region)
    const below = BELOW_VOWELS.has(vowels[0]) || DOT_VOWELS.has(vowels[0])
    const hasFinal = finals.length > 0
    const parts = []
    // A stacked pair keeps room for its final; a pair side by side hangs the final under both.
    // The initial takes the width a consonant takes in a column, and beside a vowel it stands at
    // that vowel's middle without being squeezed.
    const initialBox = below
      ? (hasFinal ? box(0.14, 0.54, 0.86, 0.98) : box(0.14, 0.26, 0.86, 0.98))
      : (hasFinal ? box(0.02, 0.24, 0.50, 0.90) : box(0.01, 0.12, 0.52, 0.88))
    parts.push(...this.node(initial, initialBox))
    if (DOT_VOWELS.has(vowels[0])) {
      // 아라아 and its fellows are dots: a dot drawn to fill a letter's room would be a blob.
      // A dot keeps its own round shape: squaring it to a letter's room would draw a lozenge.
      const side = Math.min(w, h) * 0.15
      const cx = x0 + 0.5 * w
      const dot = hasFinal
        ? [cx - side / 2, y0 + 0.40 * h, cx + side / 2, y0 + 0.40 * h + side]
        : [cx - side / 2, y0 + 0.04 * h, cx + side / 2, y0 + 0.04 * h + side]
      for (const part of this.node(vowels[0], dot)) { part.fixed = true; parts.push(part) }
    } else {
      const vowelBox = below
        ? (hasFinal ? box(0.10, 0.34, 0.90, 0.56) : box(0.10, 0.14, 0.90, 0.42))
        : (hasFinal ? box(0.50, 0.34, 0.98, 0.98) : box(0.50, 0.06, 0.98, 0.96))
      // A compound vowel is written as its two letters, the first at the left or below.
      const [vx0, vy0, vx1, vy1] = vowelBox
      const count = vowels.length
      vowels.forEach((letter, i) => {
        const from = vx0 + (vx1 - vx0) * (i / count), to = vx0 + (vx1 - vx0) * ((i + 1) / count)
        parts.push(...this.node(letter, [from, vy0, to, vy1]))
      })
    }
    if (hasFinal) {
      const [fx0, fy0, fx1, fy1] = box(0.18, 0.02, 0.82, 0.32)
      const count = finals.length
      finals.forEach((letter, i) => {
        const from = fx0 + (fx1 - fx0) * (i / count), to = fx0 + (fx1 - fx0) * ((i + 1) / count)
        parts.push(...this.node(letter, [from, fy0, to, fy1]))
      })
    }
    return parts
  }

  /** A syllable carrying tone marks: it keeps only the part of the box the marks leave free, at the
   *  right, and the marks stand at the left as the tone of the syllable is written.
   *  @param {string} base @param {string} tones @param {number[]} region */
  toneLeaf(base, tones, region, cell = false) {
    const marks = markParts(this, tones, region, region)
    const face = markFace(region, union(marks.map(part => part.target)))
    const glyph = cell ? this.glyph(base) : null
    // The syllable draws as it would alone, in what the marks leave of the box; in a cell it fills
    // that remainder, as a cell lets a leaf stretch further than a composed part.
    const body = glyph
      ? [placed(glyph, tightBox(glyph), fitted(tightBox(glyph), face.face, Math.max(this.C.STRETCH, CELL_STRETCH)), this.ink(base), `cells ${base}`)]
      : this.node(base, face.face)
    // A dot has no stem, so the weight pass leaves it its size.
    for (const part of marks) part.fixed = true
    return [...body, ...marks]
  }

  /** A designed enclosing form of a whole operand, where the export has no cut of it: 电 as ⿺'s
   *  enclosing part from 𫌷. Answers a host-like `{ record, piece }`, or null. */
  enclosureForm(op, node) {
    const entry = typeof node === 'string' ? ENCLOSURE_FORMS[op]?.[node] : null
    if (!entry || this.excluded(node)) return null
    const [char, cuts] = entry, record = this.glyphRecord(char)
    if (!record || this.excluded(char)) return null
    const indices = cuts[hexOf(JSON.stringify(record.p))]
    if (!indices) return null
    const glyph = partOf(record)
    return { record: { h: char }, piece: derived(glyph, indices.map(i => glyph.contours[i])) }
  }

  /** The designed tail of `node`'s pressed enclosure, or null where the face draws none. */
  tailForm(node) {
    const entry = typeof node === 'string' ? ENCLOSURE_TAILS[node] : null
    if (!entry) return null
    const [char, cuts] = entry, record = this.glyphRecord(char)
    if (!record || this.excluded(char)) return null
    const indices = cuts[hexOf(JSON.stringify(record.p))]
    if (!indices) return null
    const glyph = partOf(record)
    return derived(glyph, indices.map(i => glyph.contours[i]))
  }

  /** Preserve the font's designed shape while retaining one adjustable piece per leaf. */
  enclosureParts(node, region) {
    const entry = ENCLOSURE_CUTS[keyOf(node)]
    // Expansion adapts a squeezed character to its region; do not replace it with that same glyph.
    if (!entry || this.expanding.size || this.excluded(entry[0])) return null
    const [char, cuts] = entry, record = this.glyphRecord(char)
    if (!record) return null
    const indices = cuts[hexOf(JSON.stringify(record.p))]
    if (!indices) return null
    this.nativeEnclosures.add(keyOf(node))
    const glyph = partOf(record), target = fitted(glyph.box, region, this.C.STRETCH)
    if (!this.separate) return [placed(glyph, glyph.box, target, this.ink(char), `glyph ${char}`)]
    return indices.map(group => {
      const part = derived(glyph, group.map(i => glyph.contours[i]))
      return { ...placed(part, part.box, mapped(part.box, glyph.box, target), this.ink(char), `glyph ${char}`), balanceBox: glyph.box }
    })
  }

  /** The leaf boxes of a partitioned designed glyph, in the sketch's own units, so a document view
   *  frames each piece by the box the drawing gives it. */
  leafCutSketch(sequence) {
    const entry = LEAF_CUTS[sequence]
    if (!entry || this.excluded(entry[0])) return null
    const [char, cuts] = entry, record = this.glyphRecord(char)
    if (!record) return null
    const glyph = partOf(record), target = fitted(glyph.box, this.face, this.C.STRETCH)
    const groups = cuts[hexOf(JSON.stringify(record.p))]
    if (!groups) return null
    const tree = this.parse(sequence)
    const count = node => typeof node === 'string' ? 1 : node.slice(1).reduce((sum, kid) => sum + count(kid), 0)
    if (typeof tree === 'string' || groups.length !== count(tree)) return null
    return groups.map((group, index) => {
      const part = derived(glyph, group.map(i => glyph.contours[i]))
      return { index, box: mapped(part.box, glyph.box, target), empty: false }
    })
  }

  /** The designed glyph of a description whose operands interlock, partitioned one piece per leaf;
   *  a face the partition does not name draws the whole glyph, which still reads as the character. */
  leafParts(node, region) {
    const entry = Array.isArray(node) ? LEAF_CUTS[keyOf(node)] : null
    if (!entry || this.expanding.size || this.excluded(entry[0])) return null
    const [char, cuts] = entry, record = this.glyphRecord(char)
    if (!record) return null
    const glyph = partOf(record), target = fitted(glyph.box, region, this.C.STRETCH)
    const count = node => typeof node === 'string' ? 1 : node.slice(1).reduce((sum, kid) => sum + count(kid), 0)
    const groups = cuts[hexOf(JSON.stringify(record.p))]
    if (!this.separate || !groups || groups.length !== count(node)) return [placed(glyph, glyph.box, target, this.ink(char), `glyph ${char}`)]
    return groups.map(group => {
      const part = derived(glyph, group.map(index => glyph.contours[index]))
      // A stroke the piece holds whole stays addressable, its contours renumbered to the piece.
      const strokes = (glyph.strokes ?? [])
        .filter(([, contours]) => contours.every(contour => group.includes(contour)))
        .map(([id, contours]) => [id, contours.map(contour => group.indexOf(contour))])
      if (strokes.length) part.strokes = strokes
      return { ...placed(part, part.box, mapped(part.box, glyph.box, target), this.ink(char), `glyph ${char}`), balanceBox: glyph.box }
    })
  }

  /** The font's designed glyph of a description written with a variant component, partitioned one
   *  piece per leaf. The export has no cut for it: the operands' strokes overlap, so the parts do
   *  not separate into contours the way a host cut expects. */
  variantParts(node, region) {
    const entry = Array.isArray(node) ? VARIANT_CUTS[keyOf(node)] : null
    if (!entry || this.expanding.size || this.excluded(entry[0]) || !node.slice(1).every(child => typeof child === 'string')) return null
    if (node.slice(1).some(child => this.excluded(child))) return null
    const [char, cuts] = entry, record = this.glyphRecord(char)
    if (!record) return null
    const glyph = partOf(record)
    if (!this.separate) return [this.place(glyph, region, this.ink(char), `glyph ${char}`)]
    const groups = cuts[hexOf(JSON.stringify(record.p))]
    if (!groups || groups.length !== node.length - 1) return null
    const used = groups.flat().sort((a, b) => a - b)
    if (used.length !== glyph.contours.length || used.some((index, i) => index !== i)) return null
    const target = fitted(glyph.box, region, this.C.STRETCH)
    return groups.map(group => {
      const part = derived(glyph, group.map(index => glyph.contours[index]))
      return { ...placed(part, part.box, mapped(part.box, glyph.box, target), this.ink(char), `glyph ${char}`), balanceBox: glyph.box }
    })
  }

  /** Place an arbitrary inner operand in the room designed for these native enclosures. */
  yanStackedDays(outer, contents) {
    const source = yanSources.get(keyOf(outer))
    return !this.separate && !ownFormsOnly(this.fontStyle) && source && !this.excluded(source)
      && !this.excluded('昌') && !this.excluded('菖') && !this.excluded('儿') && !this.excluded('元')
      && Array.isArray(contents) && contents[0] === '⿱' && contents[1] === '儿'
      && ['昌', '⿱日日'].includes(keyOf(contents[2]))
  }

  /** Any ⿸ whose contents begin ⿱儿: the native legs join the enclosing bar. */
  legEnclosure(children, region) {
    if (this.separate || ownFormsOnly(this.fontStyle)) return null
    const key = keyOf(children[0]), contents = children[1]
    if (yanSources.has(key) || this.excluded('儿') || this.excluded('元') || this.excluded('詹')
      || !Array.isArray(contents) || contents[0] !== '⿱' || contents[1] !== '儿') return null
    const outer = this.node(children[0], region)
    const opening = this.room('⿸', outer, region)
    if (!opening) return null
    // 詹, 擔 and 檐 set the width: the 八 under 厃 spans almost the whole
    // opening at roughly a third of its height. Lift the native cut so its
    // left leg joins the bar.
    const form = (opening[2] - opening[0]) < 550 ? '儿:dan' : '儿:zhan'
    const box = componentPositionBox(form, this.fontStyle)
    if (!box) return null
    const openW = opening[2] - opening[0], openH = opening[3] - opening[1], cx = (opening[0] + opening[2]) / 2
    const width = openW * 0.88
    const height = width * (box[3] - box[1]) / Math.max(box[2] - box[0], 1)
    const top = opening[3] + this.C.ROOM_MARGIN * this.stem0[0][0] + 40
    const bottom = top - height
    const legs = componentPosition(form, [cx - width / 2, bottom, cx + width / 2, top], this.fontStyle, height)
    if (!legs) return null
    const lowerBox = [opening[0], opening[1], opening[2], bottom - 25]
    const lowerKey = keyOf(contents[2])
    if (lowerKey === '木') {
      lowerBox[0] += openW * 0.10
      lowerBox[2] -= openW * 0.10
      lowerBox[3] += openH * 0.03
    }
    else if (lowerKey === '𢀛' || lowerKey === '⿱工口') {
      lowerBox[0] += openW * 0.10
      lowerBox[2] -= openW * 0.10
      lowerBox[1] += openH * 0.04
      lowerBox[3] -= openH * 0.04
    }
    const lower = this.node(contents[2], lowerBox)
    return [...outer, legs, ...lower]
  }

  yanEnclosure(children, region) {
    if (ownFormsOnly(this.fontStyle)) return null
    const key = keyOf(children[0])
    if (!yanSources.has(key) || this.excluded(yanSources.get(key))) return null
    const outer = componentParts(key, region, this.fontStyle, true)
    const serif = this.fontStyle === 'serif', traditional = key !== '⿳亠丷厂'
    const contents = children[1]
    if (Array.isArray(contents) && contents[0] === '⿱' && contents[1] === '儿' && !this.excluded('儿') && !this.excluded('元')) {
      const top = serif ? (traditional ? 461 : 415) : (traditional ? 450 : 390)
      const baseBottom = traditional ? 210 : 180
      const stackedDays = this.yanStackedDays(children[0], contents)
      // A denser lower subtree needs more of the opening than a simple 丅.
      const ink = stackedDays ? YAN_STACK_INK : isEmpty(contents[2]) ? 0 : this.ink(contents[2])
      const extra = Math.max(0, Math.min(top - 120 - baseBottom, (Math.sqrt(ink / 3700) - 1) * 150))
      const bottom = baseBottom + extra
      const legs = componentPosition('儿:under-bar', mapped([250, bottom, 920, top + 2], componentConstants.face, region), this.fontStyle, top + 2 - bottom)
      if (legs) {
        const box = mapped(stackedDays ? [300, -59, 880, bottom - 25] : [240, -59, 940, bottom - 25], componentConstants.face, region)
        const days = stackedDays && componentPosition('昌:stack', box, this.fontStyle)
        const lower = days ? [days] : this.node(contents[2], box)
        // Strong vertical weight expansion closes the counters of compact,
        // dense lower components. Keep their native light-master detail.
        if (ink > 7400) for (const part of lower) part.weightLimit = [1, 0]
        return [...outer, legs, ...lower]
      }
    }
    // The traditional boxes follow 生 in Noto 產. The 产 enclosure's
    // lower crossbar leaves a shorter opening, so its top is lowered.
    const box = serif ? [198, -51, 954, traditional ? 445 : 330]
      : [227, -59, 944, traditional ? 431 : 335]
    const inner = this.node(children[1], mapped(box, componentConstants.face, region))
    // Fitting clears collisions, but must not enlarge the already calibrated
    // inner drawing to fill every available pixel of the opening.
    this.fit(outer, inner, region, this.stem0[0][0], this.C, { room: union(inner.map(p => p.target)), size: 128 })
    return [...outer, ...inner]
  }

  leafOwners(tree) {
    let index = 0, split = false, valid = true
    const walk = node => {
      if (!Array.isArray(node)) return [index++]
      const pyramid = this.pyramid(node)
      if (pyramid) {
        split = true
        return node.slice(1).flatMap(walk)
      }
      const grid = this.repeatedGrid(node)
      if (grid) {
        split = true
        const owners = node.slice(1).flatMap(walk)
        return grid.order.map(i => owners[i])
      }
      const enclosure = this.splitEnclosure(node)
      if (enclosure) {
        split = true
        const outer = walk(node[1]), inner = walk(node[2])
        const count = n => Array.isArray(n) ? n.slice(1).reduce((sum, child) => sum + count(child), 0) : 1
        const sourceInner = count(node[2])
        const outside = outer.length === 1 ? Array(count(enclosure.tree) - sourceInner).fill(outer[0]) : outer
        return [...outside.slice(0, enclosure.innerIndex), ...inner, ...outside.slice(enclosure.innerIndex)]
      }
      // Other rewrites can merge or introduce leaves; leave their grouping to geometry.
      if (this.respelled(node) !== node) valid = false
      return node.slice(1).flatMap(walk)
    }
    const owners = walk(tree)
    return valid ? { owners, split } : null
  }

  /** Two identical reflections or half-turns restore the subtree, before lookup and layout. */
  cancelTransforms(node) {
    if (!Array.isArray(node)) return node
    const kids = node.slice(1).map(child => this.cancelTransforms(child))
    if ((node[0] === MIRROR || node[0] === ROTATE) && Array.isArray(kids[0]) && kids[0][0] === node[0]) return kids[0][1]
    return Object.assign([node[0], ...kids], node.note ? { note: node.note } : {})
  }

  /** The same yan enclosure can put its contents inside 厂 before grouping the upper strokes. */
  normalizeYan(node) {
    if (!Array.isArray(node)) return node
    const op = node[0], kids = node.slice(1).map(child => this.normalizeYan(child))
    const tail = kids.at(-1)
    if (Array.isArray(tail) && tail.length === 3 && tail[0] === '⿸' && tail[1] === '厂') {
      if (op === '⿳' && kids.length === 3 && kids[0] === '亠' && (kids[1] === '㐅' || kids[1] === '丷'))
        return ['⿸', ['⿳', kids[0], kids[1], '厂'], tail[2]]
      if (op === '⿱' && kids.length === 2 && kids[0] === '文')
        return ['⿸', ['⿱', '文', '厂'], tail[2]]
    }
    return Object.assign([op, ...kids], node.note ? { note: node.note } : {})
  }

  /** Whole-character lookup for attested overlays; nested editing keeps its leaves. */
  standaloneExpandedOverlay(node) {
    if (!Array.isArray(node) || node[0] !== '⿻') return null
    const equivalents = {"⿻大⿰人人": "夾", "⿻工⿰人人": "巫", "⿻⿰人人土": "坐"}
    const expanded = equivalents[keyOf(node)]
    const char = expanded ?? this.bySequence(keyOf(node))
    if (!expanded && char && this.overlayTeachers(node.slice(1)).length) return null
    return char && !this.excluded(char) && this.glyph(char) ? char : null
  }

  /** Whole-character lookup for attested expanded pyramid-glyphs; nested editing keeps its leaves. */
  standalonePyramid(node) {
    const char = pyramidGlyphs.get(keyOf(node))
    return char && !this.excluded(char) && this.glyph(char) ? char : null
  }

  /** A complete attested grid uses its designed glyph, including separated previews. */
  standaloneRepeatedGrid(node) {
    for (const [part, char] of Object.entries({ 口: '㗊', 火: '燚', 又: '叕', 水: '㵘', 屮: '茻' })) {
      if ([`⿰⿱${part}${part}⿱${part}${part}`, `⿱⿰${part}${part}⿰${part}${part}`].includes(keyOf(node))
        && !this.excluded(char) && this.glyph(char)) return char
    }
    return null
  }

  /** Canonicalize attested grids before lookup; preserve the editor's tree and leaf order. */
  normalizeRepeatedGrids(node) {
    if (!Array.isArray(node)) return node
    const grid = this.repeatedGrid(node)
    return grid ? grid.tree : mapOperands(node, child => this.normalizeRepeatedGrids(child))
  }

  repeatedGrid(node) {
    for (const part of ['口', '火', '又', '水', '屮']) {
      if (keyOf(node) === `⿰⿱${part}${part}⿱${part}${part}`)
        return { tree: ['⿱', ['⿰', part, part], ['⿰', part, part]], order: [0, 2, 1, 3] }
    }
    return null
  }

  /** These host aliases use their expanded form for glyph lookup and parent layout features. */
  requestedEnclosure(node) {
    if (!Array.isArray(node) || node.length !== 3 || node.note) return null
    const [op, outer, inner] = node
    if (op === '⿹' && (outer === '須' || keyOf(outer) === '⿰彡頁')) return { tree: ['⿰', ['⿱', '彡', inner], '頁'], innerIndex: 1 }
    if (op === '⿸' && (outer === '攸' || keyOf(outer) === '⿲亻丨攵')) return { tree: ['⿲', '亻', '丨', ['⿱', '攵', inner]], innerIndex: 3 }
    if (op === '⿸' && (outer === '𪧇' || keyOf(outer) === '⿱宀爿')) return { tree: ['⿱', '宀', ['⿰', '爿', inner]], innerIndex: 2 }
    if (op === '⿸' && (outer === '朕' || keyOf(outer) === '⿰月关')) return { tree: ['⿰', '月', ['⿱', '关', inner]], innerIndex: 2 }
    return null
  }

  /** Normalize the rendering tree only; the source tree still owns editable leaf indices. */
  normalizeRequestedEnclosures(node) {
    if (!Array.isArray(node)) return node
    const rewritten = this.requestedEnclosure(node)
    const tree = rewritten?.tree ?? node
    return mapOperands(tree, child => this.normalizeRequestedEnclosures(child))
  }

  /** Layout and first inner leaf for two-part descriptions with a disconnected outer part. */
  splitEnclosure(node) {
    if (!Array.isArray(node) || node.length !== 3) return null
    const [op, outer, inner] = node
    // Match explicit hosts without merging the original editable leaves.
    const requested = this.requestedEnclosure(node)
    if (requested) return requested
    if (op === '⿵' && keyOf(outer) === '⿲彳⿱山一攵') return { tree: ['⿲', '彳', ['⿱', ['⿱', '山', '一'], inner], '攵'], innerIndex: 3 }
    if (op === '⿴' && keyOf(outer) === '⿰彳亍') return { tree: ['⿲', '彳', inner, '亍'], innerIndex: 1 }
    if (op === '⿴' && keyOf(outer) === '⿰弓弓') return { tree: ['⿲', '弓', inner, '弓'], innerIndex: 1 }
    if (op === '⿴' && keyOf(outer) === '⿰𤣩王') return { tree: ['⿲', '𤣩', inner, '王'], innerIndex: 1 }
    if (op === '⿴' && keyOf(outer) === '⿰辛辛') return { tree: ['⿲', '辛', inner, '辛'], innerIndex: 1 }
    if (op === '⿴' && keyOf(outer) === '⿰隹隹') return { tree: ['⿲', '隹', inner, '隹'], innerIndex: 1 }
    if (op === '⿴' && keyOf(outer) === '⿱亠𧘇') return { tree: ['⿳', '亠', inner, '𧘇'], innerIndex: 1 }
    if (op === '⿸' && keyOf(outer) === '⿰方𠂉') return { tree: ['⿰', '方', ['⿱', '𠂉', inner]], innerIndex: 2 }
    if (op === '⿹' && keyOf(outer) === '⿰匕頁') return { tree: ['⿰', ['⿱', '匕', inner], '頁'], innerIndex: 1 }
    if (op === '⿸' && keyOf(outer) === '⿰𠦝𠆢') return { tree: ['⿰', '𠦝', ['⿱', '𠆢', inner]], innerIndex: 2 }
    if (op === '⿶' && keyOf(outer) === '⿱⿰弓弓鬲') return { tree: ['⿱', ['⿲', '弓', inner, '弓'], '鬲'], innerIndex: 1 }
    if (op === '⿹' && keyOf(outer) === '⿰⿳士冖一殳') return { tree: ['⿰', ['⿱', ['⿳', '士', '冖', '一'], inner], '殳'], innerIndex: 3 }
    if (op === '⿴' && (outer === '林' || keyOf(outer) === '⿰木木')) return { tree: ['⿲', '木', inner, '木'], innerIndex: 1 }
    const sides = { 行: ['彳', '亍'], 弜: ['弓', '弓'], 玨: ['𤣩', '王'], 辡: ['辛', '辛'], 雔: ['隹', '隹'] }
    if (op === '⿴' && Object.hasOwn(sides, outer)) return { tree: ['⿲', sides[outer][0], inner, sides[outer][1]], innerIndex: 1 }
    if (op === '⿴' && outer === '衣') return { tree: ['⿳', '亠', inner, '𧘇'], innerIndex: 1 }
    if (op === '⿸' && outer === '𭤨') return { tree: ['⿰', '方', ['⿱', '𠂉', inner]], innerIndex: 2 }
    if (op === '⿴' && (outer === '𨺅' || keyOf(outer) === '⿰𨸏⿾𨸏')) return { tree: ['⿲', '𨸏', inner, ['⿾', '𨸏']], innerIndex: 1 }
    if (op === '⿹' && outer === '頃') return { tree: ['⿰', ['⿱', '匕', inner], '頁'], innerIndex: 1 }
    if (op === '⿴' && ['⿰⿱口口⿱口口', '⿱⿰口口⿰口口'].includes(keyOf(outer))) {
      return { tree: ['⿳', ['⿰', '口', '口'], inner, ['⿰', '口', '口']], innerIndex: 2 }
    }
    if (op === '⿴' && outer === '㗊') return { tree: ['⿳', '吅', inner, '吅'], innerIndex: 1 }
    if (op === '⿸' && outer === '倝') return { tree: ['⿰', '𠦝', ['⿱', '𠆢', inner]], innerIndex: 2 }
    if (op === '⿶' && outer === '𩰲') return { tree: ['⿱', ['⿲', '弓', inner, '弓'], '鬲'], innerIndex: 1 }
    if (op === '⿹' && outer === '𣪊') return { tree: ['⿰', ['⿱', ['⿳', '士', '冖', '一'], inner], '殳'], innerIndex: 3 }
    return null
  }

  /**
   * How often the export cut `key` out of a character as one body, by its own key and by the name
   * of the character that spells it. Cuts on the left or the top are not counted, as `instance`
   * cannot use them, nor is the spelling character's own glyph: that a pair is a character of its
   * own (沐 for 氵木) says nothing about whether a font sets it as one body inside a wider one.
   */
  bodySupport(key) {
    if (key.includes(EMPTY)) return 0
    const open = place => !this.C.SIDED_PLACES.includes(place)
    // Only a host the drawing may take from, and only where the export could cut the body out of it.
    const usable = host => host.c && !this.excluded(host.h)
    const cuts = name => this.data.places(name).filter(open)
      .reduce((n, place) => n + this.data.hosts(name, place).filter(usable).length, 0)
    const encoded = this.bySequence(key)
    return cuts(key) + (encoded && !this.excluded(encoded) ? cuts(encoded) : 0)
  }

  /** A bare bar: one contour, far wider than it is tall. A stack's bar spans the whole character
   *  (the 一 of 寅, the base 一 of 𡩬), so it belongs to no narrower body inside it. */
  isBar(node) {
    if (typeof node !== 'string') return false
    const glyph = this.glyph(node)
    if (!glyph || glyph.contours.length !== 1) return false
    const [x0, y0, x1, y1] = glyph.box
    return x1 - x0 > BAR_ASPECT * (y1 - y0)
  }

  /**
   * A flat stack holding a run the export cuts as one body (亠厶 of ⿳亠厶十, the 𠫓 of 充 and 育),
   * regrouped so that run is one operand. The run then shares the stack as one body and divides its
   * own row, instead of each of the three operands taking a third of the stack and the body's two
   * halves standing as far apart as the operand beside them. Answers the rewritten node, or null
   * where no run is more of a body than the whole stack.
   */
  groupedStack(node) {
    if (!Array.isArray(node) || node.length !== 4) return null
    const op = node[0]
    if (op !== '⿳' && op !== '⿲') return null
    const key = keyOf(node)
    if (key.includes(EMPTY) || this.spelled.has(key) || containsComponentForm(key, this.fontStyle)) return null
    const pair = op === '⿳' ? '⿱' : '⿰'
    const children = node.slice(1)
    // ⺊ over 冖 is one designed top (the KRM vulgar 處, K07097330), not two stack operands:
    // draw the prepared ⿱⺊冖 and give it the top band, with the bottom operand below.
    if (op === '⿳' && (children[0] === '⺊' || children[0] === '卜') && children[1] === '冖'
      && isComponentForm('⿱⺊冖', this.fontStyle)) return ['⿱', ['⿱', '⺊', '冖'], children[2]]
    // An even run stays even, whatever cuts the export holds of a pair of it: three of the same
    // operand (品, 森, 焱), a pair of the same operand beside a third (⿲大糸糸), and a run that
    // reads the same from either end (呂, 粥), whose middle belongs to both sides at once.
    const keys = children.map(keyOf)
    if (keys[0] === keys[1] || keys[1] === keys[2] || keys[0] === keys[2]) return null
    // A stack the export draws whole keeps its own body; only a stronger run replaces it. A
    // character excluded from the drawing draws nothing, so the stack is free to regroup.
    const spelled = this.bySequence(key)
    if (spelled && !this.excluded(spelled)) return null
    const whole = this.bodySupport(key)
    let best = null
    for (const at of [0, 1]) {
      // A cover takes what follows it under its roof (`fitUnderCover`); a body may not come between.
      if (at === 0 && op === '⿳' && COVERS.has(children[1])) continue
      // A bar belongs to the whole character, not to a body inside it.
      if (this.isBar(children[at]) || this.isBar(children[at + 1])) continue
      const run = [pair, children[at], children[at + 1]]
      const support = this.bodySupport(keyOf(run))
      if (support >= BODY_WITNESSES && support > whole && (!best || support > best.support)) best = { at, run, support }
    }
    if (!best) return null
    return best.at === 0 ? [pair, best.run, children[2]] : [pair, children[0], best.run]
  }

  /** Rendering rewrites for split enclosures and compound corners (原 in 愿). */
  respelled(node) {
    const grid = this.repeatedGrid(node)
    if (grid) return grid.tree
    const enclosure = this.splitEnclosure(node)
    if (enclosure) return enclosure.tree
    if (node[0] !== '⿸' || node.length !== 3 || typeof node[1] !== 'string') return node
    let outer
    try { outer = this.parse(this.sequenceOf(node[1]) ?? '') } catch { return node }
    if (Array.isArray(outer) && outer[0] === '⿸' && outer.length === 3
      && !(typeof outer[1] === 'string' && (this.sequenceOf(outer[1]) ?? '').startsWith('⿸'))) return ['⿸', outer[1], ['⿱', outer[2], node[2]]]
    return node
  }

  // ---------------------------------------------------------------- hosts
  /** Whether `node` is a row (⿰ or ⿲) writing an enclosing description. Such a row keeps the row's
   *  layout: the enclosure takes its share of the cell and frames what it holds there, and the
   *  other operand keeps its own column. A host's piece is a whole row in the donor's proportions,
   *  which give the enclosure the donor's frame and the partner the donor's column. */
  rowHoldsEnclosure(node) {
    return Array.isArray(node) && this.AXIS[node[0]] === 0
      && node.slice(1).some(child => Array.isArray(child) && child[0] in this.ENCLOSE)
  }

  /** Whether a host cut would replace a row that writes an enclosing description, or the enclosing
   *  description written in that row. */
  keepsRowLayout(op, node) {
    if (this.rowHoldsEnclosure(node)) return true
    return this.AXIS[op] === 0 && Array.isArray(node) && node[0] in this.ENCLOSE
  }

  /** A row writing an enclosing description laid out where a donor drew the same row: the donor's
   *  row frame gives the row's width, its cuts give each operand's share, and each operand is drawn
   *  from its own description. The rows the learned boxes would draw for such a description are the
   *  export's defaults (it has no glyph shape to read), which give the enclosure more of the cell
   *  than the font gives it beside its partner. Falls back when no one donor holds every operand. */
  enclosureRow(op, children, region) {
    if (this.partial || !this.layout) return null
    const anchor = children.findIndex(child => Array.isArray(child) && child[0] in this.ENCLOSE)
    if (anchor < 0) return null
    const lists = children.map((child, i) => this.hostsOf(keyOf(child), this.slot(op, i)))
    if (lists.some(list => !list.length)) return null
    const boxes = this.predict(op, children)
    const box = region ? mapped(boxes[anchor], union(boxes), region) : boxes[anchor]
    const same = (a, b) => Boolean(a && b) && [0, 1, 2, 3].every(k => Math.abs(a[k] - b[k]) < 1)
    for (const [, chosen] of this.ranked(op, anchor, children[anchor], children.filter((_, i) => i !== anchor), box, true)) {
      const h = chosen.record
      const row = children.map((child, i) => i === anchor ? h : lists[i].find(entry => entry.h === h.h && entry.op === h.op && same(entry.fr, h.fr)))
      if (row.some(entry => !entry?.fr || !entry.b)) continue
      const frame = h.fr
      if (!frame || frame[2] <= frame[0] || frame[3] <= frame[1]) continue
      const width = Math.min(frame[2] - frame[0], region ? region[2] - region[0] : frame[2] - frame[0])
      const middle = region ? (region[0] + region[2]) / 2 : (frame[0] + frame[2]) / 2
      const target = [middle - width / 2, region ? region[1] : frame[1], middle + width / 2, region ? region[3] : frame[3]]
      return this.flatten(row.map((entry, i) => this.node(children[i], mapped(entry.b, frame, target))))
    }
    return null
  }

  /** The drawn part closest to what `node` needs at `index` of `op` inside `box`, as [record, piece]. */
  host(op, index, node, siblings, box, isPlaced = false) {
    if (containsComponentForm(keyOf(node), this.fontStyle)) return null
    if (this.keepsRowLayout(op, node)) return null
    // A cut of an entire repeated row can include strokes belonging to its host.
    // Draw the row from its own glyph or its operands instead.
    if (isRepeatedRow(node)) return null
    // A separated drawing gives each leaf its own piece, so a host for a whole operand sequence is
    // not used; the sequence is drawn through `node` instead.
    if (this.separate && Array.isArray(node)) return null
    const ranked = this.ranked(op, index, node, siblings, box, isPlaced)
    if (ranked.length) return ranked[0][1]
    return this.designedCut(node)
  }

  /** A designed left form from a character's glyph, for a component whose host cuts the export lacks. */
  designedCut(node) {
    const entry = typeof node === 'string' ? DESIGNED_CUTS[node] : null
    if (!entry) return null
    const [char, cuts] = entry, record = this.glyphRecord(char)
    if (!record) return null
    const indices = cuts[hexOf(JSON.stringify(record.p))]
    if (!indices) return null
    const glyph = partOf(record)
    return { record: { h: char }, piece: derived(glyph, indices.map(i => glyph.contours[i])) }
  }

  /** Whether the export carries the left column's 身, cut from 射, 躬 or 躭. */
  hasLeftBody(node, place = 'L') {
    return this.alternatives(node, place).some(written =>
      this.hostsOf(written, place).some(h => LEFT_BODY_HOSTS.has(h.h) && !this.excluded(h.h)))
  }

  ranked(op, index, node, siblings, box, isPlaced = false) {
    const C = this.C, place = this.slot(op, index)
    const want = siblings.reduce((s, n) => s + this.ink(n), 0)
    const aspect = (box[2] - box[0]) / Math.max(box[3] - box[1], 1)
    const siblingKeys = siblings.map(child => this.renderKey(child))
    const siblingKey = written => {
      try { return this.renderKey(this.parse(written)) } catch { return written }
    }
    // ⿰身X draws its 身 as 射, 躬 and 躭 do: the first stroke shortens and the foot lifts for the
    // narrow column. A cut from a dense neighbour (𨊂, 軀, 軆) keeps the standalone width.
    if (op === '⿰' && place === 'L' && keyOf(node) === '身') {
      const native = []
      for (const written of this.alternatives(node, place))
        for (const h of this.hostsOf(written, place))
          if (LEFT_BODY_HOSTS.has(h.h) && !this.excluded(h.h))
            native.push([Math.abs(Math.log(stretchOf(this.cutOf(h).box, box))), h])
      if (native.length) return [[0, this.chosen(native.sort((a, b) => a[0] - b[0])[0][1])]]
    }
    let hand = null
    if (node === '𠂇') {
      const drawn = [op, ...siblings.slice(0, index), node, ...siblings.slice(index)]
      const ch = this.bySequence(keyOf(drawn)) ?? ''
      hand = ch && !this.excluded(ch) ? this.rec(ch)?.hand ?? null : null
      // The hand forms are read from KanjiVG's stroke types.
      if (hand !== null) this.handForms = true
    }
    const weighed = (candidates, written, facing = false) => {
      const scored = []
      for (const [h, alien] of candidates) {
        if (this.excluded(h.h)) continue
        if (hand !== null) {
          // The hand an entry's node writes (`hd`).
          if (h.hd !== hand) continue
        }
        const exact = h.j === 1 && h.op === op && h.ok.length === siblingKeys.length
          && h.ok.every((key, j) => siblingKey(key) === siblingKeys[j])
        const ratio = Math.abs(Math.log(Math.max(h.si, 1) / Math.max(want, 1)))
        scored.push([!exact, alien, ratio, h.d, h])
      }
      const cmp4 = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]) || (a[3] - b[3])
      const ordered = scored.slice().sort(cmp4)
      const limit = isPlaced ? 32 : 16
      const mine = ordered.filter(r => r[4].v === 1).slice(0, limit), foreign = ordered.filter(r => r[4].v !== 1).slice(0, limit)
      const found = []
      for (const [notExact, alien, ratio, depth, h] of [...mine, ...foreign].sort(cmp4)) {
        // An entry the composer could not cut takes its place among those weighed, and is passed over.
        const cut = this.cutOf(h)
        if (!cut) continue
        if (alien && cut.count !== this.outlines(node)) continue
        const b = cut.box
        const shape = Math.abs(Math.log(((b[2] - b[0]) / Math.max(b[3] - b[1], 1)) / aspect))
        const size = Math.abs(Math.log(Math.max(b[2] - b[0], 1) * Math.max(b[3] - b[1], 1) / Math.max((box[2] - box[0]) * (box[3] - box[1]), 1)))
        let near = 0
        if (isPlaced) near = h.wh && !facing ? [0, 1, 2, 3].reduce((s, k) => s + Math.abs(b[k] - box[k]), 0) / 4 / C.PLACED_UNITS : C.PLACED_NESTED
        found.push([notExact, ratio + shape + 0.5 * size + 0.1 * depth + near + C.KIN_COST * alien
          + C.FOREIGN_COST * (h.v !== 1) + C.UNJAPANESE_COST * (h.j !== 1), h])
      }
      return found
    }
    for (const written of this.alternatives(node, place)) {
      const kin = C.KIN_PLACES[place]
      let candidates = this.hostsOf(written, place, true).map(h => [h, false])
      if (kin) candidates = candidates.concat(upTo(this.hostsOf(written, kin, true), C.KIN_HOSTS).map(h => [h, true]))
      let found = weighed(candidates, written)
      const facing = C.FACING_PLACES[place]
      if (facing && found.length && !found.some(r => r[2].v === 1)) {
        found = found.concat(weighed(this.hostsOf(written, facing, true).filter(h => h.v === 1).slice(0, C.KIN_HOSTS).map(h => [h, true]), written, true))
        const local = found.filter(r => r[2].v === 1 && r[2].j === 1)
        if (local.length) found = local
      }
      if (op in this.ENCLOSE && typeof node === 'string' && this.own(node) && found.length && !found.some(r => r[2].v === 1)) return []
      if (found.length) {
        found.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]))
        return this.nativeShapes(found.map(r => [r[1], this.chosen(r[2])]))
      }
    }
    return []
  }

  /** A fallback cut with a detached bar the native cuts lack is left out (`_native_shapes`). */
  nativeShapes(ranked) {
    if (this.partial) return ranked
    const own = ranked.filter(r => r[1].record.v === 1)
    if (!own.length || own.length === ranked.length) return ranked
    const references = own.map(r => { const m = square(r[1].piece, 64); return [m, grown(m, 64, 2)] })
    return ranked.filter(row => {
      if (row[1].record.v === 1) return true
      const piece = row[1].piece, mask = square(piece, 64), g = grown(mask, 64, 2)
      const total = count(mask)
      const agrees = references.some(([reference, expanded]) => {
        let extra = 0, missing = 0
        for (let i = 0; i < mask.length; i++) { extra += mask[i] & (1 - expanded[i]); missing += reference[i] & (1 - g[i]) }
        return extra <= this.C.TYPICAL_EXTRA * total && missing <= this.C.TYPICAL_GLYPH * count(reference)
      })
      return agrees || !extraBar(piece, mask, references.map(r => r[1]))
    })
  }

  // ---------------------------------------------------------------- learned layout
  predict(op, children) {
    const keys = children.map(child => this.renderKey(child))
    return forward(this.layout, features(this.layout, op, keys.map(k => this.rec(k)), [this.slot(op, 0), this.slot(op, 1)]))
  }

  /**
   * The description of a character the font draws as a rectangular grid of parts: a stack of rows,
   * each a row of the same length, as 㸚 is ⿱⿰㐅㐅⿰㐅乂. A designer may draw one row of such a grid
   * smaller than another, and inside a frame that reads as two rows out of balance; drawing the
   * description gives every row its own cell.
   * @param {any} node @returns {any[] | null}
   */
  gridTree(node) {
    if (typeof node !== 'string') return null
    const sequence = this.sequenceOf(node)
    if (!sequence) return null
    let tree
    try { tree = this.parse(sequence) } catch { return null }
    if (!Array.isArray(tree) || !['⿱', '⿳'].includes(tree[0])) return null
    const row = child => Array.isArray(child) && (child[0] === '⿰' || child[0] === '⿲') ? child.length - 1 : 0
    const widths = tree.slice(1).map(row)
    if (!(widths.length >= 2 && widths.every(width => width >= 2 && width === widths[0]))) return null
    const drawn = child => typeof child === 'string' && (isEmpty(child) || this.glyph(child) !== null)
    return tree.slice(1).every(child => child.slice(1).every(drawn)) ? tree : null
  }

  /**
   * A frame the font draws as a left half and a right half cut down the middle: each half takes a
   * side of the cell and the enclosed part takes the space between them.
   * @param {any} glyph @param {string} char @param {number[]} region @returns {any[] | null}
   */
  frameHalves(glyph, char, region) {
    if (!glyph || !glyph.contours || glyph.contours.length < 2) return null
    const pieces = glyph.contours.map((_, i) => derived(glyph, [glyph.contours[i]]))
    const middle = (glyph.box[0] + glyph.box[2]) / 2
    const left = [], right = []
    pieces.forEach((piece, i) => ((piece.box[0] + piece.box[2]) / 2 < middle ? left : right).push(i))
    if (!left.length || !right.length) return null
    const w = region[2] - region[0], h = region[3] - region[1], share = 0.25
    // The half a font sets on the right starts its bars a little inside its column: 學 leaves 30
    // units between its 爻 and that half, and only 3 on the left. The enclosed part keeps that
    // clearance, wider on the right than on the left.
    const LEFT_GAP = 0.002, RIGHT_GAP = 0.032
    const side = (list, box) => {
      const part = derived(glyph, list.map(i => glyph.contours[i]))
      return placed(part, part.box, fitted(part.box, box, this.C.STRETCH), this.ink(char), `glyph ${char} half`)
    }
    const room = [region[0] + w * (0.25 + LEFT_GAP), region[1] + h * 0.05,
      region[2] - w * (0.25 + RIGHT_GAP), region[3] - h * 0.05]
    return {
      sides: [side(left, [region[0], region[1], region[0] + w * share, region[3]]),
        side(right, [region[2] - w * share, region[1], region[2], region[3]])],
      room,
    }
  }

  learned(op, children, region, ownParts = false) {
    // A frame drawn as two halves holds its inner part between them (𦥑 in ⿴𦥑囟 reads as ⿲).
    if (op === '⿴' && typeof children[0] === 'string' && SPLIT_FRAMES.has(children[0])) {
      const frame = this.frameHalves(this.glyph(children[0]), children[0], region ?? this.face)
      if (frame) return [...frame.sides, ...this.node(children[1], frame.room)]
    }
    const C = this.C, stem = this.stem0[0][0], frameOf = region ?? this.face
    let boxes = this.predict(op, children)
    // The network can give a rare nested stack a band its strokes do not fill: when the top of a
    // pair takes more than half the height while holding under 40% of the pair's ink, the plain ink
    // shares place the pair (⿱㇒𭕄 over 𠙻).
    if (op === '⿱' && children.length === 2 && Array.isArray(children[0]) && !Array.isArray(children[1])) {
      const frame = union(boxes), span = frame[3] - frame[1]
      const ink = this.ink(children[0]), other = this.ink(children[1])
      if (span > 0 && (boxes[0][3] - boxes[0][1]) / span > LEARNED_TOP && ink < LEARNED_INK * (ink + other)) return null
    }
    if (region) { const frame = union(boxes); boxes = boxes.map(b => mapped(b, frame, region)) }
    // 𭰲 (⿰氵⿵冂并) keeps about a fifth of a stem between the water and the frame; a described
    // ⿰氵⿵冂… tends to close it to nothing.
    if (op === '⿰' && children[0] === '氵' && Array.isArray(children[1]) && children[1][0] === '⿵') {
      const gap = 0.02 * (this.face[2] - this.face[0]), b = boxes[1]
      if (b[2] - b[0] > gap * 4) { b[0] = b[0] + gap; b[2] = Math.min(b[2] + gap, this.face[2]) }
    }
    if (op in this.ENCLOSE && !region && area(boxes[0]) < C.ENCLOSING_LEAST * area(this.face)) boxes[0] = this.face.slice()
    if (C.COVERING.includes(op)) boxes[0] = union(boxes)
    if (boxes.some(b => b[2] <= b[0] || b[3] <= b[1])) return null
    // 王 as the left part of a compound body takes its combining form and a narrow column.
    const wangLeft = !region && op === '⿰' && children[0] === '王'
    if (wangLeft) {
      const frame = union(boxes), split = frame[0] + 0.28 * (frame[2] - frame[0])
      boxes[0] = [frame[0], frame[1], split, frame[3]]
      boxes[1] = [split, frame[1], frame[2], frame[3]]
    }
    // A row of one character repeated gives its operands one cell each: the layout's narrower left
    // and wider right are for different parts, and the same glyph drawn once from each shows as two
    // sizes of one shape (the two pairs of bars of ⿰𠄠𠄠).
    const even = isRepeatedRow([op, ...children]) ? evenCells(boxes, this.AXIS[op]) : null
    const groups = []
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      // A repeated glyph takes one cell per operand, whichever path draws it.
      let box = even ? even[i] : boxes[i]
      if (wangLeft && i === 0) {
        const glyph = this.glyph('𤣩')
        if (glyph) { groups.push([this.place(glyph, box, this.ink('𤣩'), 'glyph 𤣩')]); continue }
      }
      if (this.AXIS[op] === 0 && child === '\u{F2A9}' && this.fontStyle === 'sans') {
        groups.push(this.node(child, box, false, true))
        continue
      }
      // Under a cover, a child whose own glyph fits the box is drawn from it: a host cut can meet
      // the cover's bar through a turning stroke and leave a wedge (定's 𤴓 cut from 是).
      if (i === 1 && op === '⿱' && typeof children[0] === 'string' && COVERS.has(children[0])
        && typeof child === 'string' && !this.excluded(child) && this.sequenceOf(child)) {
        const own = this.glyph(child)
        if (own && stretchOf(own.box, box) <= C.STRETCH) {
          groups.push([this.place(own, box, this.ink(child), `glyph ${child}`)])
          continue
        }
      }
      // A grid whose whole glyph overflows the opening keeps its rows equal only when its
      // description is drawn: the glyph and a host cut both carry the font's smaller row.
      const opening = op in this.ENCLOSE && i === 1 ? this.room(op, groups[0], frameOf) : null
      const tightGrid = opening && area(opening) < area(box) && within(box, opening) >= C.ROOM_TRUST ? this.gridTree(child) : null
      if (tightGrid) {
        groups.push(this.cellLayout(tightGrid, opening, { leafIndices: false }))
        this.fit(groups[0], groups[1], frameOf, stem, C, { room: opening })
        continue
      }
      let part = this.host(op, i, child, [...children.slice(0, i), ...children.slice(i + 1)], box, region === null)
      // An operand with no host cut is drawn from its own glyph, which keeps the part inside its box.
      // A repeated component still has its cuts (⿱丑丑 takes both halves from 峱), so the glyph is
      // the fallback and never replaces a cut the export provides. A glyph the box would deform
      // beyond STRETCH is no form for that place (示's square glyph in a left column); 身 also takes
      // the left column's narrow form from 射, 躬 or 躭.
      if (!part && ownParts && typeof child === 'string' && !this.excluded(child)
        && !(op === '⿰' && i === 0 && keyOf(child) === '身' && this.hasLeftBody(child))) {
        const designed = this.designedCut(child)
        if (designed) {
          groups.push([this.place(designed.piece, box, this.ink(designed.record.h), `host ${designed.record.h}`)])
          continue
        }
        const own = this.glyph(child)
        // The left column is where a square glyph loses its form; a right or upper operand keeps
        // its own glyph, which the box's size matches.
        if (own && (i > 0 || stretchOf(own.box, box) <= C.STRETCH)) {
          groups.push([this.place(own, box, this.ink(child), `glyph ${child}`)])
          continue
        }
      }
      if (part && op in this.ENCLOSE && i === 0 && typeof child === 'string' && this.own(child)
        && stretchOf(part.piece.box, box) > C.ENCLOSING_STRETCH) part = null
      // A grid whose whole glyph overflows the opening keeps its rows equal only when its
      // description is drawn: the host cut carries the font's smaller row.
      if (!part && op in this.ENCLOSE && i === 0) part = this.enclosureForm(op, child)
      if (!part) {
        if (op in this.ENCLOSE && i === 1) {
          // An inner the opening cannot hold is drawn into the opening itself, so it cannot
          // overflow the frame. A grid drawn whole can still have one row smaller than the other
          // (㸚 in 冂); its description gives every row its own equal cell.
          const opening = this.room(op, groups[0], frameOf)
          // An opening that overlaps little of the layout's box is a pocket beside the part. 𦉪's
          // own hook splits off a small box below it; 丅 belongs in the frame's wide opening under
          // the roof.
          const tight = opening && area(opening) < area(box) && within(box, opening) >= C.ROOM_TRUST
          const grid = tight ? this.gridTree(child) : null
          const inner = tight ? opening : box
          // A part centred in a room alone would sit away from a short arm: open the room out over
          // the sides the enclosure closes.
          const anchor = opening && (tight || area(opening) > area(box)) ? centre(this.held(opening, op, frameOf)) : centre(inner)
          groups.push(grid ? this.cellLayout(grid, inner, { leafIndices: false }) : this.node(child, inner))
          this.fit(groups[0], groups[1], frameOf, stem, C, { room: inner, anchor })
        } else groups.push(this.node(child, even ? even[i] : box))
        continue
      }
      let { record: drawn, piece: source } = part
      // A cut of 丑 carries the font's bar out past its right vertical, as its own glyph does.
      source = this.pieceFor(child, source)
      // An operand the layout has no usual box for has no learned evidence for its band: the network
      // reads its shape alone and can stretch a flat top far past the proportion the font draws it
      // with. Keep the cut's own proportion along the stack and give the rest to the operand below
      // (卝 over 干, as 咩 and 羋 set the cap wide and the body below it).
      if (op in this.AXIS && this.AXIS[op] === 1 && children.length === 2 && i === 0
        && !isComponentForm(keyOf(child), this.fontStyle) && !this.rec(keyOf(child))?.u?.[this.slot(op, 0)]) {
        const natural = this.cutBand(box, source.box)
        if (natural > 0 && natural < box[3] - box[1]) {
          const low = box[3] - natural
          boxes[1] = [boxes[1][0], boxes[1][1], boxes[1][2], low]
          box = [box[0], low, box[2], box[3]]
        }
      }
      if (op === '⿺' && i === 1 && groups[0].length === 1 && groups[0][0].origin.startsWith('glyph')) {
        const tail = this.tailForm(keyOf(children[0]))
        const swept = sweptPart(groups[0][0], box[0] - C.FACING[0], C, tail)
        if (swept) {
          groups[0] = swept
          const opening = this.room(op, groups[0], frameOf)
          if (opening) {
            const cut = [Math.max(opening[0], box[0]), Math.max(opening[1], box[1]), Math.min(opening[2], box[2]), Math.min(opening[3], box[3])]
            if (cut[0] < cut[2] && cut[1] < cut[3]) box = cut
          }
        } else return this.node(['⿰', ...children], frameOf)
      }
      if (op in this.ENCLOSE && i === 1 && groups[0].every(p => p.origin.startsWith('glyph'))) {
        groups.push([placed(source, source.box, fitted(source.box, box, C.STRETCH), this.ink(drawn.h), `learned ${drawn.h}`)])
        this.fit(groups[0], groups[1], frameOf, stem, C, { room: box })
        continue
      }
      if (op in this.ENCLOSE && i === 1) {
        let room = this.room(op, groups[0], frameOf)
        room = room && shrunk(room, C.OPENING_SHARE)
        if (room && (within(box, room) < C.ROOM_TRUST || stretchOf(source.box, box) > C.STRETCH)) {
          const other = this.host(op, i, child, children.slice(0, 1), room)
          if (other) ({ record: drawn, piece: source } = other)
          if (stretchOf(source.box, room) > C.STRETCH) {
            groups.push(this.node(child, room))
          } else groups.push([this.place(source, room, this.ink(drawn.h), `learned ${drawn.h}`)])
          this.fit(groups[0], groups[1], frameOf, stem, C, { room, anchor: centre(this.held(room, op, frameOf)) })
          continue
        }
      }
      if (!region && op in this.AXIS && drawn.wh) {
        const s = stretchOf(source.box, box)
        if (!(C.HOST_SNAP < s && s <= C.HOST_EXTENT)) {
          const across = 1 - this.AXIS[op]
          box = [0, 1, 2, 3].map(k => k % 2 === across ? source.box[k] : box[k])
        }
      }
      if (op in this.AXIS && stretchOf(source.box, box) > C.STRETCH) return null
      groups.push([{ ...placed(source, source.box, box, this.ink(drawn.h), `learned ${drawn.h}`), ...(this.AXIS[op] === 1 ? { gap: drawn.g } : {}) }])
      if (op === '⿸' && Array.isArray(children[0]) && i === 1 && this.collide(groups[0], groups[1], frameOf, 256) > C.COLLIDE)
        this.fit(groups[0], groups[1], frameOf, stem, C, { size: 256, room: box })
      if (C.CLEARED.includes(op) && i === 1 && this.collide(groups[0], groups[1], frameOf, 64) > C.COLLIDE) {
        const opening = this.room(op, groups[0], frameOf)
        const limit = !opening || area(opening) <= area(box) ? box : shrunk(opening, C.OPENING_SHARE)
        this.fit(groups[0], groups[1], frameOf, stem, C, { room: limit, anchor: centre(limit) })
      }
    }
    if (op in this.AXIS) this.space(this.AXIS[op], groups, Boolean(region))
    this.closeUnderCover(op, children, groups)
    this.fitUnderCover(op, children, groups)
    this.clearUnderCover(op, children, groups)
    this.openUnderCover(op, children, groups)
    this.containUnderCover(op, children, groups)
    this.joinUnderCover(op, children, groups)
    // 𭰲 (⿰氵⿵冂并) sets the water at 5–31% and the frame at 33–93% of the face; a described
    // row stretched the frame wider. Keep the reference's shares and the gap between them.
    if (op === '⿰' && children[0] === '氵' && Array.isArray(children[1]) && children[1][0] === '⿵') {
      const a = union(groups[0].map(p => p.target)), b = union(groups[1].map(p => p.target))
      const want = 0.02 * (this.face[2] - this.face[0]), gap = b[0] - a[2]
      if (gap < want) {
        const d = want - gap
        for (const p of groups[1]) p.target = [p.target[0] + d, p.target[1], p.target[2] + d, p.target[3] + d]
      }
      const frame = union(groups[1].map(p => p.target)), left = frame[0], cy = (frame[1] + frame[3]) / 2
      const sx = 0.88, sy = 0.93
      for (const p of groups[1]) p.target = [left + (p.target[0] - left) * sx, cy + (p.target[1] - cy) * sy, left + (p.target[2] - left) * sx, cy + (p.target[3] - cy) * sy]
      // The inner keeps top and bottom gaps the described row closed.
      const innerParts = groups[1].filter(p => !p.origin.startsWith('host 𭰲'))
      if (innerParts.length) {
        const box = union(innerParts.map(p => p.target)), cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2
        const lift = 0.02 * (this.face[3] - this.face[1]), split = 0.013 * (this.face[3] - this.face[1])
        for (const p of innerParts) {
          const upper = (p.target[1] + p.target[3]) / 2 > cy
          p.target = [cx + (p.target[0] - cx) * 0.90, cy + (p.target[1] - cy) * 0.90 + lift + (upper ? split : -split), cx + (p.target[2] - cx) * 0.90, cy + (p.target[3] - cy) * 0.90 + lift + (upper ? split : -split)]
        }
      }
    }
    this.recordJoints(op, groups)
    return this.flatten(groups)
  }

  /** A whole character's operands each taken unscaled from where a designer put them (`_transplant`). */
  transplant(op, children) {
    const C = this.C, axis = this.AXIS[op], options = []
    for (let i = 0; i < children.length; i++) {
      const siblings = [...children.slice(0, i), ...children.slice(i + 1)]
      const want = siblings.reduce((s, n) => s + this.ink(n), 0)
      const found = []
      for (const written of this.alternatives(children[i], this.slot(op, i)))
        for (const h of upTo(this.hostsOf(written, this.slot(op, i)), C.TRANSPLANT_HOSTS)) {
          if (h.d || this.excluded(h.h) || h.op !== op || h.ok.length !== children.length - 1) continue
          found.push([Math.abs(Math.log(Math.max(h.si, 1) / Math.max(want, 1))), h])
        }
      found.sort((a, b) => a[0] - b[0])
      const pieces = found.slice(0, C.TRANSPLANT_CANDIDATES).map(([ratio, h]) => [ratio, h, this.cutOf(h), h.g, children[i]])
      if (!pieces.length) return null
      options.push(pieces)
    }
    const misfit = (a, b) => {
      const gap = axis === 0 ? b[2].box[0] - a[2].box[2] : a[2].box[1] - b[2].box[3]
      return Math.abs(gap - (a[3] + b[3]) / 2) + 40 * (a[0] + b[0])
    }
    let best = options[0].map(p => [0, [p]])
    for (const row of options.slice(1)) {
      best = row.map(p => best.map(([cost, chain]) => [cost + misfit(chain.at(-1), p), [...chain, p]])
        .reduce((a, b) => b[0] < a[0] ? b : a))
    }
    const [cost, chain] = best.reduce((a, b) => b[0] < a[0] ? b : a)
    if (cost > C.TRANSPLANT_TOLERANCE * (children.length - 1)) return null
    return chain.map(([, h, , , key]) => {
      const piece = this.pieceFor(key, this.pieceOf(h))
      return placed(piece, piece.box, piece.box.slice(), this.ink(h.h), `transplant ${h.h}`)
    })
  }

  // ---------------------------------------------------------------- no layout to follow
  /** The box a short two-part stack takes at the top of a tall column (`SHORT_STACK_PART`,
   *  `SHORT_STACK`), leaving the rest of the column empty; null for a stack that fills its column.
   *  The stack is drawn in the top `SHORT_STACK` of the column, where the layout gives its parts
   *  room, rather than stretched down the whole column. */
  shortStackBox(node, box) {
    if (!Array.isArray(node) || node[0] !== '⿱' || node.length !== 3) return null
    const leaves = node.slice(1)
    if (leaves.some(leaf => typeof leaf !== 'string' || isEmpty(leaf))) return null
    const width = box[2] - box[0], height = box[3] - box[1]
    if (!(width > 0 && height > 0)) return null
    const heights = []
    for (const leaf of leaves) {
      const glyph = this.glyph(leaf)
      if (!glyph) return null
      const span = glyph.box[2] - glyph.box[0], tall = glyph.box[3] - glyph.box[1]
      if (!(span > 0 && tall > 0)) return null
      heights.push(tall / span * width)
    }
    if (heights.some(tall => tall > SHORT_STACK_PART * height)) return null
    const natural = heights.reduce((sum, tall) => sum + tall, 0)
    if (natural > SHORT_STACK * height) return null
    return [box[0], box[3] - SHORT_STACK * height, box[2], box[3]]
  }

  /** The lower part of a short stack (`shortStackBox`) drawn `SHORT_STACK_GAP` of the column's
   *  height under the upper one. The layout spaces the two over a full column, so the gap has to
   *  close with them at the top, and the stack's own pair opens to the gap 徵 sets. */
  closeShortStack(parts, column) {
    const above = parts.filter(part => part.branch?.[0] === 0)
    const below = parts.filter(part => part.branch?.[0] === 1)
    if (!above.length || !below.length) return
    const gap = bounds(above)[1] - bounds(below)[3]
    const target = (column[3] - column[1]) * SHORT_STACK_GAP
    if (!(Math.abs(target - gap) > 1)) return
    const shift = gap - target
    for (const part of below) part.target = [part.target[0], part.target[1] + shift, part.target[2], part.target[3] + shift]
  }

  /** Operands sharing the region along an aligned operator by `SHARES`; an enclosed one in the room its
   *  enclosing part leaves. */
  shares(op, children, region, atRoot = false) {
    const C = this.C
    if (op in this.ENCLOSE) {
      let outer = this.node(children[0], region)
      const designedOuter = this.enclosureForm(op, children[0])
      if (designedOuter) outer = [placed(designedOuter.piece, designedOuter.piece.box, fitted(designedOuter.piece.box, region, C.STRETCH), this.ink(designedOuter.record.h), `host ${designedOuter.record.h}`)]
      // 虍's whole glyph leaves the inner only the narrow hook. The export's designed 虍 cuts
      // (from 慮, 虜, 虞 …) open wider, so take one when the outer is 虍.
      if (op === '⿸' && typeof children[0] === 'string' && children[0] === '虍') {
        const cut = this.host(op, 0, children[0], children.slice(1), region)
        if (cut) outer = [placed(cut.piece, cut.piece.box, mapped(cut.piece.box, cut.piece.box, region), this.ink(cut.record.h), `host ${cut.record.h}`)]
      }
      let room = this.room(op, outer, region)
      if (op === '⿸' && typeof children[0] === 'string' && children[0] === '虍') {
        const [x0, y0, x1, y1] = region, w = x1 - x0, h = y1 - y0
        room = [x0 + 0.18 * w, y0 + 0.0 * h, x0 + 0.99 * w, y0 + 0.95 * h]
      }
      const fallback = !room
      if (!room) {
        const [x0, y0, x1, y1] = this.INSIDE[op], w = region[2] - region[0], h = region[3] - region[1]
        room = [region[0] + x0 * w, region[1] + y0 * h, region[0] + x1 * w, region[1] + y1 * h]
      }
      const hu = op === '⿸' && typeof children[0] === 'string' && children[0] === '虍'
      const [hx0, hy0, hx1, hy1] = region, hw = hx1 - hx0, hh = hy1 - hy0
      const huRoom = hu ? [hx0 + 0.30 * hw, hy0 + 0.0 * hh, hx0 + 0.97 * hw, hy0 + 0.55 * hh] : null
      const inner = this.node(children[1], hu ? huRoom : room)
      if (!hu) this.fit(outer, inner, region, this.stem0[0][0], C,
        fallback && op === '⿽' ? { room, bounds: room } : undefined)
      return [...outer, ...inner]
    }
    const axis = this.AXIS[op]
    // A stack the layout can place takes its learned boxes even where a component form kept `learned`
    // from running: sharing ink would leave an arbitrary band gap (the 冖 under ⿴𦥑同).
    if (axis === 1 && children.length === 2 && this.layout && this.hosted && !this.partial) {
      const learned = this.learned(op, children, atRoot ? null : region)
      if (learned) return learned
    }
    // Without a host cut a whole glyph stands in for a component. Equal halves make a left 木 as
    // wide as the right one; a font draws it narrow instead. The learned boxes say how wide each
    // part is, so take the split from them, give both the full across-axis extent, and let each
    // glyph fill its share.
    if (!this.hasHosts(op, children) && this.layout && children.length === 2) {
      const boxes = this.predict(op, children), frame = union(boxes)
      if (frame[2] > frame[0] && frame[3] > frame[1] && boxes.every(b => b[2] > b[0] && b[3] > b[1])) {
        const [first, second] = boxes.map(b => mapped(b, frame, region))
        const across = 1 - axis, lo = region[axis], hi = region[axis + 2]
        const gap = (hi - lo) * 0.01, edge = (first[axis + 2] + second[axis]) / 2
        const ranges = [[Math.max(first[axis], lo), Math.min(first[axis + 2], edge - gap)],
          [Math.max(second[axis], edge + gap), Math.min(second[axis + 2], hi)]]
        if (ranges.every(([a, b]) => b > a)) {
          const groups = []
          for (const [i, child] of children.entries()) {
            const box = region.slice()
            box[axis] = ranges[i][0]
            box[axis + 2] = ranges[i][1]
            const designed = typeof child === 'string' ? this.designedCut(child) : null
            const glyph = typeof child === 'string' ? this.glyph(child) : null
            if (designed) groups.push(placed(designed.piece, designed.piece.box, fitted(designed.piece.box, box, C.STRETCH), this.ink(designed.record.h), `host ${designed.record.h}`))
            else if (glyph && !(axis === 0 && child === '\u{F2A9}' && this.fontStyle === 'sans')) groups.push(placed(glyph, glyph.box, box, this.ink(child), `glyph ${child}`))
            else groups.push(this.row(child, box, children.length, axis === 0))
          }
          return this.flatten(groups)
        }
      }
    }
    const [power, middle] = C.SHARES[`${op},${children.length}`] ?? [0.5, 1.0]
    const other = children[1]
    const compactYan = op === '⿰' && children[0] === '朱' && Array.isArray(other) && other[0] === '⿸'
      && yanSources.has(keyOf(other[1])) && !this.separate && !ownFormsOnly(this.fontStyle)
      && !this.excluded('朱') && !this.excluded('鴸') && !this.excluded(yanSources.get(keyOf(other[1])))
    // A font compresses a stacked middle band, but a full part reads better with the share its own
    // ink asks for than with 0.75 of it: at 0.75 the 六 of ⿳山六廾 was 217 units high. Bars and
    // covers (一, 冖, 丷) still take the compression.
    const wholeMiddles = children.map((child, k) => op === '⿳' && k > 0 && k < children.length - 1 && this.middleWhole(child))
    const weights = children.map((child, k) => this.ink(child) ** power
      * (k > 0 && k < children.length - 1 && !wholeMiddles[k] ? middle : 1))
    if (axis === 1 && children.length === 3) {
      const total = weights.reduce((a, b) => a + b, 0)
      // A single component over a cover is the roof of one unit: past its third the bottom takes
      // whatever height the top gives up (𰀉 over 冖, the top of 橐).
      if (typeof children[0] === 'string' && COVERS.has(children[1]) && weights[0] > TOP_BAND * total) {
        weights[2] += weights[0] - TOP_BAND * total
        weights[0] = TOP_BAND * total
      }
      // An enclosed middle band keeps its height: the bands above and below give way to it.
      if (ENCLOSED_MIDDLE.has(children[1])) {
        const least = MIDDLE_BAND * total
        if (weights[1] < least) {
          const grow = least - weights[1]
          weights[1] = least
          const other = weights[0] + weights[2]
          weights[0] -= grow * weights[0] / other
          weights[2] -= grow * weights[2] / other
        }
      }
    }
    // A three-band stack is a vertical chain: each band is drawn on to the one below it (丅 on 口 on
    // 丄). A pair keeps a row's gap unless the learned boxes above place it.
    const gap = compactYan ? 0.01 : axis === 1 && children.length > 2 ? 0 : 0.04
    const fit = (1 - gap * (children.length - 1)) / weights.reduce((a, b) => a + b, 0)
    const lo = region[axis], span = region[axis + 2] - region[axis]
    const groups = []
    let yanBox = null
    let at = 0
    children.forEach((child, i) => {
      let a = at, b = at + weights[i] * fit
      at = b + gap
      if (axis === 1) [a, b] = [1 - b, 1 - a]
      const box = region.slice()
      box[axis] = lo + a * span
      box[axis + 2] = lo + b * span
      // The sloping right edge of 朱 leaves space for the enclosure's curved
      // left stroke; a gap between their bounding boxes exaggerates it.
      if (compactYan && i === 1) { box[0] -= span * 0.045; yanBox = box.slice() }
      // 鴸 supplies a full-height left 朱 even in exports without a usable host cut.
      if (compactYan && i === 0) {
        const native = componentPositionBox('朱:L', this.fontStyle)
        if (native) {
          const vertical = mapped(native, componentConstants.face, region)
          groups.push([componentPosition('朱:L', [box[0], vertical[1], box[2], vertical[3]], this.fontStyle)])
          return
        }
      }
      const contextualFive = axis === 0 && child === '\u{F2A9}' && this.fontStyle === 'sans'
      // A short stack in a tall column of a ⿲ keeps to the top of the column (山 over 一 in
      // ⿲彳⿱山一攵), leaving the rest empty for the column beside it to fill.
      const top = op === '⿲' && axis === 0 ? this.shortStackBox(child, box) : null
      const target = top ?? box
      const part = contextualFive ? null : this.host(op, i, child, [...children.slice(0, i), ...children.slice(i + 1)], target)
      // A cut of 丑 carries the font's bar out past its right vertical, as its own glyph does; and a
      // part from a host cut fills its cell as a glyph does in a row of three: a cell is no designed
      // placement, so it may change its proportions up to `CELL_STRETCH` (𠆢's cut from 㓿 is half
      // the width of the cell it belongs in).
      const source = part ? this.pieceFor(child, part.piece) : undefined
      if (part) groups.push([{ ...placed(source, source.box, fitted(source.box, target, Math.max(C.STRETCH, C.CELL_STRETCH)), this.ink(part.record.h), `host ${part.record.h}`), ...(axis === 1 ? { gap: part.record.g } : {}) }])
      else {
        const stack = this.row(child, target, children.length, axis === 0)
        if (top) this.closeShortStack(stack, box)
        groups.push(stack)
      }
    })
    if (compactYan && !this.partial) {
      // Restore just enough room when a whole-glyph outline protrudes toward 朱.
      const size = 512, mask = grown(fill(groupRings(groups[0]), size, region), size, 1)
      const original = groups[1].map(part => part.target.slice())
      for (let step = 0; step <= 9; step++) {
        const frame = yanBox.slice()
        frame[0] += span * 0.005 * step
        groups[1].forEach((part, i) => { part.target = mapped(original[i], yanBox, frame) })
        const right = fill(groupRings(groups[1].filter(part => !part.cut)), size, region)
        if (!right.some((value, i) => value && mask[i])) break
      }
    } else if (!compactYan) {
      if (axis === 1 && children.length === 3) narrowMiddleBand(children[1], groups, region)
      this.space(axis, groups, Boolean(region))
    }
    this.closeUnderCover(op, children, groups)
    this.fitUnderCover(op, children, groups)
    this.clearUnderCover(op, children, groups)
    this.openUnderCover(op, children, groups)
    this.containUnderCover(op, children, groups)
    this.joinUnderCover(op, children, groups)
    // 𭰲 (⿰氵⿵冂并) sets the water at 5–31% and the frame at 33–93% of the face; a described
    // row stretched the frame wider. Keep the reference's shares and the gap between them.
    if (op === '⿰' && children[0] === '氵' && Array.isArray(children[1]) && children[1][0] === '⿵') {
      const a = union(groups[0].map(p => p.target)), b = union(groups[1].map(p => p.target))
      const want = 0.02 * (this.face[2] - this.face[0]), gap = b[0] - a[2]
      if (gap < want) {
        const d = want - gap
        for (const p of groups[1]) p.target = [p.target[0] + d, p.target[1], p.target[2] + d, p.target[3] + d]
      }
      const frame = union(groups[1].map(p => p.target)), left = frame[0], cy = (frame[1] + frame[3]) / 2
      const sx = 0.88, sy = 0.93
      for (const p of groups[1]) p.target = [left + (p.target[0] - left) * sx, cy + (p.target[1] - cy) * sy, left + (p.target[2] - left) * sx, cy + (p.target[3] - cy) * sy]
      // The inner keeps top and bottom gaps the described row closed.
      const innerParts = groups[1].filter(p => !p.origin.startsWith('host 𭰲'))
      if (innerParts.length) {
        const box = union(innerParts.map(p => p.target)), cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2
        const lift = 0.02 * (this.face[3] - this.face[1]), split = 0.013 * (this.face[3] - this.face[1])
        for (const p of innerParts) {
          const upper = (p.target[1] + p.target[3]) / 2 > cy
          p.target = [cx + (p.target[0] - cx) * 0.90, cy + (p.target[1] - cy) * 0.90 + lift + (upper ? split : -split), cx + (p.target[2] - cx) * 0.90, cy + (p.target[3] - cy) * 0.90 + lift + (upper ? split : -split)]
        }
      }
    }
    this.recordJoints(op, groups)
    return this.flatten(groups)
  }

  /** `child` drawn into `box` as one of `count` aligned operands; a whole glyph in a row of three may
   *  change its proportions up to `ROW_STRETCH`. */
  row(child, box, n, sideBySide) {
    const designed = typeof child === 'string' ? this.designedCut(child) : null
    if (designed) return [placed(designed.piece, designed.piece.box, fitted(designed.piece.box, box, this.C.STRETCH), this.ink(designed.record.h), `host ${designed.record.h}`)]
    const group = this.node(child, box, false, sideBySide)
    if (n === 3 && group.length === 1 && !group[0].nativeAspect && group[0].origin.startsWith('glyph ')) group[0].target = fitted(group[0].source, box, this.C.ROW_STRETCH)
    else if (n === 3 && group.length > 1 && group[0].balanceBox && group.every(p => p.balanceBox === group[0].balanceBox)) {
      const frame = group[0].balanceBox, target = fitted(frame, box, this.C.ROW_STRETCH)
      for (const part of group) part.target = mapped(part.source, frame, target)
    }
    return group
  }

  /** A whole glyph a stack's middle band cannot compress: bars and covers (一, 冖, 丷) lie flat
   *  enough to be one, a full character such as 六 or 水 does not. */
  middleWhole(child) {
    const key = this.renderKey(child)
    const glyph = this.glyph(key)
    if (!glyph) return false
    const ink = tightBox(glyph)
    return this.outlines(child) > 1 && ink[2] - ink[0] <= MIDDLE_FLAT * (ink[3] - ink[1])
  }

  /** A sequence drawn whole somewhere in the font, in any place but the left or the top (`_instance`). */
  instance(node, region) {
    const C = this.C, k = keyOf(node)
    if (k.includes(EMPTY)) return null
    if (this.rowHoldsEnclosure(node)) return null
    const names = [k, ...(this.bySequence(k) ? [this.bySequence(k)] : [])]
    // A description that maps to an excluded character keeps that identity here: the plan leaves
    // it out, and its host must still not be used.
    const mapped = typeof this.rec(k)?.e === 'string' ? this.rec(k).e : null
    const redrawn = names.some(n => this.excluded(n)) || (mapped !== null && this.excluded(mapped))
    if (redrawn && !this.stroked(node)) return null
    let best = null
    const need = this.outlines(node), stroked = this.stroked(node)
    for (const name of names) {
      for (const place of this.data.places(name)) {
        if (C.SIDED_PLACES.includes(place)) continue
        for (const h of upTo(this.hostsOf(name, place), C.INSTANCE_HOSTS)) {
          // A character redrawn to test takes nothing from a host built of itself (吉 from 嚞).
          if (this.excluded(h.h) || (redrawn && h.ok.some(other => names.includes(other) || other === mapped))) continue
          const cut = this.cutOf(h)
          if (stroked && cut.count !== need) continue
          if (cut.count < C.INSTANCE_KEPT * need) continue
          const s = stretchOf(cut.box, region)
          if (s <= C.STRETCH && (!best || s < best[0])) best = [s, h]
        }
      }
    }
    if (!best) return null
    const piece = this.pieceOf(best[1])
    return placed(piece, piece.box, region.slice(), this.ink(best[1].h), `instance ${best[1].h}`)
  }

  // ---------------------------------------------------------------- overlays
  /** Overlays the export holds both pieces of, sharing an operand of comparable ink. */
  overlayTeachers(children) {
    const C = this.C, keys = children.map(keyOf)
    const teachers = []
    for (const index of [0, 1]) {
      for (const h of upTo(this.hostsOf(keys[index], `⿻${index}`), C.OVERLAY_HOSTS)) {
        if (this.excluded(h.h) || h.op !== '⿻' || h.ok.length !== 1) continue
        const other = this.hostsOf(h.ok[0], `⿻${1 - index}`).find(o => o.h === h.h && o.d === h.d && o.op === '⿻')
        if (!other) continue
        const written = index === 0 ? [keys[0], h.ok[0]] : [h.ok[0], keys[1]]
        const pieces = index === 0 ? [h, other] : [other, h]
        teachers.push({ ch: h.h, pieces, written, frame: h.fr })
      }
    }
    return teachers.filter(t => keys.every((k, j) => t.written[j] === k
      || (1 / C.OVERLAY_INK <= this.ink(k) / Math.max(this.ink(t.written[j]), 1) && this.ink(k) / Math.max(this.ink(t.written[j]), 1) <= C.OVERLAY_INK)))
  }

  /** Operands drawn across each other (⿻), where characters overlaying like operands put them. */
  overlay(children, region) {
    const C = this.C, keys = children.map(keyOf), usable = this.overlayTeachers(children)
    if (!usable.length && children.length === 2) {
      const outer = this.node(children[0], region)
      const rooms = { '⿶': this.room('⿶', outer, region), '⿵': this.room('⿵', outer, region) }
      const share = Object.fromEntries(Object.entries(rooms).map(([op, r]) => [op, r ? area(r) / area(region) : 0]))
      for (const [op, other] of [['⿶', '⿵'], ['⿵', '⿶']]) {
        if (share[op] >= C.OPEN_ROOM && share[op] >= C.OPEN_ONE_SIDE * share[other]) {
          const cells = this.cells(op, outer, region, children[1])
          if (cells) return [...outer, ...cells]
          if (this.hosted && this.layout?.ops.includes(op)) {
            const boxes = this.predict(op, children), frame = union(boxes)
            return children.flatMap((child, j) => this.node(child, mapped(boxes[j], frame, region)))
          }
          return this.node([op, ...children], region)
        }
      }
    }
    if (!usable.length) {
      // With no matching cuts or enclosing room, retain the operands' shared em-square.
      return children.flatMap(child => {
        const glyph = typeof child === 'string' ? this.glyph(child) : null
        return this.node(child, glyph ? mapped(glyph.box, EM_BOX, region) : region)
      })
    }
    const chosen = usable.sort((a, b) => keys.filter((k, j) => k === b.written[j]).length - keys.filter((k, j) => k === a.written[j]).length).slice(0, C.TEACHERS_OVERLAY)
    const shares = [0, 1].map(j => [0, 1, 2, 3].map(k => chosen.reduce((s, t) => {
      const b = t.pieces[j].b, f = t.frame, w = Math.max(f[2] - f[0], 1), h = Math.max(f[3] - f[1], 1)
      return s + [(b[0] - f[0]) / w, (b[1] - f[1]) / h, (b[2] - f[0]) / w, (b[3] - f[1]) / h][k]
    }, 0) / chosen.length))
    return children.flatMap((child, j) => {
      const box = mapped(shares[j], [0, 0, 1, 1], region)
      const donor = chosen.find(t => t.written[j] === keys[j])
      // A separated drawing unfolds a sequence operand rather than taking a teacher's piece for it.
      if (donor && !containsComponentForm(keyOf(child), this.fontStyle) && !(this.separate && Array.isArray(child))) {
        const piece = this.pieceFor(keys[j], this.pieceOf(donor.pieces[j]))
        return [placed(piece, piece.box, box, this.ink(donor.ch), `overlay ${donor.ch}`)]
      }
      return this.node(child, box)
    })
  }

  /** A side-by-side pair in the two cells a stroke down the middle of an opening makes (山's in 幽). */
  cells(op, outer, region, inner) {
    if (isComponentForm(keyOf(inner), this.fontStyle)) return null
    const C = this.C
    let tree = Array.isArray(inner) ? inner : null
    if (!tree && this.sequenceOf(inner)) { try { tree = this.parse(this.sequenceOf(inner)) } catch { tree = null } }
    if (!Array.isArray(tree) || tree[0] !== '⿰' || tree.length !== 3) return null
    const middle = (region[0] + region[2]) / 2
    const halves = [[region[0], region[1], middle, region[3]], [middle, region[1], region[2], region[3]]]
    const rooms = halves.map(half => this.room(op, outer, half))
    if (rooms.some(r => !r || area(r) < C.CELL_ROOM * area(region))) return null
    const grow = C.ROOM_MARGIN * this.stem0[0][0]
    return tree.slice(1).flatMap((child, i) => {
      const room = [rooms[i][0] - grow, rooms[i][1], rooms[i][2] + grow, rooms[i][3]]
      const found = this.host('⿰', i, child, [tree[2 - i]], room)
      if (!found) return this.node(child, room)
      return [placed(found.piece, found.piece.box, fitted(found.piece.box, room, C.CELL_STRETCH), this.ink(found.record.h), `host ${found.record.h}`)]
    })
  }

  // ---------------------------------------------------------------- operators beyond the composer
  /** ⿾ its operand mirrored left to right, ⿿ turned half round, about the region's centre. */
  flipped(op, child, region, atRoot) {
    this.approximate.add(op)
    const out = this.node(child, region, atRoot)
    const about = [(region[0] + region[2]) / 2, (region[1] + region[3]) / 2]
    for (const p of out) p.flips = [...p.flips ?? [], { x: true, y: op === ROTATE, about }]
    return out
  }

  /** ㇯ the second operand drawn where it lies in the first, as a cut taken out of it. */
  subtracted(children, region, atRoot) {
    const out = this.node(children[0], region, atRoot)
    const cut = this.node(children[1], region)
    for (const p of cut) p.cut = true
    return [...out, ...cut]
  }

  // ---------------------------------------------------------------- fitting
  // While a drawing meets data not loaded yet it is drawn again once that has loaded, so until then the
  // mask-based fitting is skipped: the pass only has to find out what else the drawing needs.
  get partial() { return (this.data.missing?.size ?? 0) > 0 }
  fit(outer, inner, region, stem, C, options) { return this.partial ? false : fitInside(outer, inner, region, stem, C, options) }
  collide(outer, inner, region, size) { return this.partial ? 0 : collision(outer, inner, region, size) }

  /** The largest empty box inside `region` the placed enclosing part closes on its closed sides,
   *  `ROOM_MARGIN` stroke widths clear of its ink (`_room`). On an open side the box stops at the
   *  part's own ink, so an enclosed part sits between the arms (凵, 門) rather than over their tips. */
  room(op, outer, region, size = 48) {
    if (this.partial) return null
    const C = this.C
    const ink = fill(groupRings(outer), size, region)
    const margin = Math.max(1, pyRound(C.ROOM_MARGIN * this.stem0[0][0] / ((region[2] - region[0]) / size)))
    const blocked = grown(ink, size, margin)
    // Each closed side must have ink between the room and the region's edge: prefix counts make
    // that a lookup.
    const pre = new Int32Array((size + 1) * (size + 1))
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++)
      pre[(r + 1) * (size + 1) + c + 1] = ink[r * size + c] + pre[r * (size + 1) + c + 1] + pre[(r + 1) * (size + 1) + c] - pre[r * (size + 1) + c]
    const sum = (r0, r1, c0, c1) => r1 <= r0 || c1 <= c0 ? 0
      : pre[r1 * (size + 1) + c1] - pre[r0 * (size + 1) + c1] - pre[r1 * (size + 1) + c0] + pre[r0 * (size + 1) + c0]
    const sides = this.ENCLOSE[op]
    let inkTop = size, inkBottom = -1, inkLeft = size, inkRight = -1
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      if (!ink[r * size + c]) continue
      if (r < inkTop) inkTop = r
      if (r > inkBottom) inkBottom = r
      if (c < inkLeft) inkLeft = c
      if (c > inkRight) inkRight = c
    }
    const rows = [sides.includes('T') ? 0 : inkTop, sides.includes('B') ? size : inkBottom + 1]
    const cols = [sides.includes('L') ? 0 : inkLeft, sides.includes('R') ? size : inkRight + 1]
    let best = null
    const heights = new Int32Array(size)
    for (let row = rows[0]; row < rows[1]; row++) {
      for (let c = 0; c < size; c++) heights[c] = blocked[row * size + c] ? 0 : heights[c] + 1
      const stack = []
      for (let col = cols[0]; col <= cols[1]; col++) {
        const h = col < cols[1] ? heights[col] : 0
        while (stack.length && heights[stack.at(-1)] >= h) {
          const top = stack.pop()
          const height = heights[top], left = stack.length ? stack.at(-1) + 1 : cols[0], width = col - left
          if (!height || !width) continue
          const r0 = row - height + 1, r1 = row + 1, c0 = left, c1 = col
          const closed = { L: sum(r0, r1, 0, c0), R: sum(r0, r1, c1, size), T: sum(0, r0, c0, c1), B: sum(r1, size, c0, c1) }
          if ([...sides].every(s => closed[s] > 0) && (!best || height * width > best[0])) best = [height * width, r0, r1, c0, c1]
        }
        stack.push(col)
      }
    }
    if (!best) return null
    const [, r0, r1, c0, c1] = best, w = (region[2] - region[0]) / size, h = (region[3] - region[1]) / size
    return [region[0] + c0 * w, region[3] - r1 * h, region[0] + c1 * w, region[3] - r0 * h]
  }

  /** `room` opened out over the sides `op` closes, where it is short of `FIT_FLOOR` of the region: a
   *  part centred in the room alone would sit away from a short arm. */
  held(room, op, region, size = 48) {
    const sides = this.ENCLOSE[op], C = this.C
    const w = (region[2] - region[0]) / size, h = (region[3] - region[1]) / size
    const room2 = Math.round(size * C.OPEN_ROOM)
    const give = cells => Math.max(0, Math.min(room2, Math.round(size * FIT_FLOOR) - cells))
    const across = give((room[2] - room[0]) / w), along = give((room[3] - room[1]) / h)
    return [sides.includes('L') ? Math.max(region[0], room[0] - across * w) : room[0],
      sides.includes('T') ? Math.max(region[1], room[1] - along * h) : room[1],
      sides.includes('R') ? Math.min(region[2], room[2] + across * w) : room[2],
      sides.includes('B') ? Math.min(region[3], room[3] + along * h) : room[3]]
  }

  /** Whether `ch` is a roof in a ⿵ rather than a frame: the opening its ink closes is narrower
   *  than half its width, as the slot between 入's legs is, so the part below hangs under it rather
   *  than sitting inside. */
  roof(ch, region) {
    if (typeof ch !== 'string') return false
    const glyph = this.drawnGlyph(ch)
    if (!glyph) return false
    const part = placed(glyph, glyph.box, fitted(glyph.box, region, this.C.STRETCH), this.ink(ch), `glyph ${ch}`)
    const room = this.room('⿵', [part], region)
    return !room || room[2] - room[0] < 0.5 * (region[2] - region[0])
  }

  /** A stack's neighbouring operands, remembered so their ink can be settled after weighting. */
  recordJoints(op, groups) {
    if (this.AXIS[op] !== 1 || groups.length < 2) return
    for (let k = 1; k < groups.length; k++) this.joints.push([groups[k - 1], groups[k]])
  }

  /** Two stacked operands whose bands share an edge but whose ink, lightened by `balance`, leaves a
   *  seam: raise the lower one until its ink meets the upper's. A gap wider than `FACING` down the
   *  stack is the layout's own, and stays. */
  settleJoints() {
    if (this.partial) return
    const C = this.C
    for (const [above, below] of this.joints) {
      if (!above.length || !below.length) continue
      const box = bounds(below), aboveBox = bounds(above)
      if (Math.abs(aboveBox[1] - box[3]) > 1) continue
      const gap = inkBounds(above)[1] - inkBounds(below)[3]
      if (!(gap > 0) || gap >= C.FACING[1]) continue
      const to = [box[0], box[1], box[2], box[3] + gap]
      if (stretchOf(box, to) > C.STRETCH) continue
      for (const part of below) part.target = targetFor(part, mapped(drawnBox(part), box, to))
    }
  }

  /** The height a cut keeps in a stack band the layout has no usual box for: the height its own
   *  proportion gives at the band's width, where the band is taller than `HOST_EXTENT` times that;
   *  zero where the band already fits it. */
  cutBand(box, source) {
    const width = box[2] - box[0], aspect = (source[3] - source[1]) / Math.max(source[2] - source[0], 1)
    if (!(width > 0 && aspect > 0)) return 0
    return (box[3] - box[1]) / width > this.C.HOST_EXTENT * aspect ? aspect * width : 0
  }
  /** Neighbouring parts moved apart where they face each other closer than `FACING` (`_space`), or,
   *  down a stack, closed on each other where the donor drew them into each other: two cuts from
   *  different glyphs meet where the layout put their boxes, which leaves the seam 芙 has no 夫 for
   *  and the gap below the 一 of ⿱一𧘇. The gap the donor itself drew says which stacks the designer
   *  closed, and the pair is settled one way or the other, never squeezed apart and then drawn back.
   *  A median gap can look clear while one stroke reaches into the other (𠂊's hook into 巾's bar);
   *  where the nearest ink overlaps, the pair is settled by that overlap instead. */
  space(axis, groups, nested = false) {
    if (this.partial) return
    const C = this.C
    for (let k = 0; k + 1 < groups.length; k++) {
      const a = groups[k], b = groups[k + 1]
      if (axis === 1 && a?.length && b?.length && this.closed(b, a, nested ? CLOSED_NESTED : 1)) continue
      const gaps = facing(a, b, axis)
      if (!gaps) continue
      const gap = gaps.min <= 0 ? gaps.min : gaps.median
      if (gap >= C.FACING[axis]) continue
      const half = (C.FACING[axis] - gap) / 2
      const [first, second] = axis === 0 ? [a, b] : [b, a]
      const limit = group => C.SQUEEZE * (Math.max(...group.map(p => p.target[axis + 2])) - Math.min(...group.map(p => p.target[axis])))
      squeeze(first, axis, 0, -Math.min(half, limit(first)))
      squeeze(second, axis, Math.min(half, limit(second)), 0)
    }
  }

  /** The parts of each operand, flattened, each part remembering the operand it came from in
   *  `branch`: the index within this node first, then the indices of the nodes below it. A caller
   *  that needs a node's own operands reads `branch[0]` before this runs on the node above. */
  flatten(groups) {
    groups.forEach((group, index) => {
      for (const part of [group].flat()) (part.branch ??= []).unshift(index)
    })
    return groups.flat()
  }

  /** Whether a component is 冖-shaped: a root, or a sequence ending in one. */
  isCover(ch, seen = new Set()) {
    if (typeof ch !== 'string') return false
    if (COVER_ROOTS.has(ch)) return true
    if (this.coverCache.has(ch)) return this.coverCache.get(ch)
    if (seen.has(ch)) return false
    seen.add(ch)
    let out = false
    const sequence = this.sequenceOf(ch)
    if (sequence) {
      try {
        const tree = this.parse(sequence)
        if (Array.isArray(tree) && tree[0] === '⿱' && typeof tree[2] === 'string') out = this.isCover(tree[2], seen)
      } catch { /* unreadable: not a cover */ }
    }
    this.coverCache.set(ch, out)
    return out
  }

  /** A roof below a stacked part (冖, 雨) sits on it: the roof's bar is its upper edge, and the part
   *  above rests on the bar, as 學 and 覺 set the 冖 on the 𦥑. Raise the roof where the layout left
   *  a seam narrower than `FACING`; a wider gap is the layout's own. */
  closeUnderCover(op, children, groups) {
    if (this.partial || op !== '⿱' || children.length !== 2) return
    if (!(typeof children[1] === 'string' && CLOSING_COVERS.has(children[1]))) return
    const above = groups[0], below = groups[1]
    if (!above?.length || !below?.length) return
    const gap = inkBounds(above)[1] - inkBounds(below)[3]
    if (!(gap > 0 && gap < this.C.FACING[1])) return
    const box = bounds(below)
    const to = [box[0], box[1] + gap, box[2], box[3] + gap]
    for (const part of below) part.target = targetFor(part, mapped(drawnBox(part), box, to))
  }

  /** A bar directly under a cover (宀, 冖, 穴, 雨) is drawn at `COVER_BAR` of the cover's width,
   *  centred on it; bars lower in the part and non-cover stacks are left alone. */
  fitUnderCover(op, children, groups) {
    if (this?.partial) return
    if (op === '⿱' && Array.isArray(children[0]) && keyOf(children[0]) === '⿱⺊冖' && groups[0].length === 2 && KRM_TOP[this.fontStyle]) {
      const { bar, height } = KRM_TOP[this.fontStyle]
      const ink = inkBounds(groups[0]), lower = inkBounds(groups[1]), whole = ink[3] - lower[1]
      if (height) {
        const bottom = ink[3] - height * whole
        const lengthen = y => ink[3] + (y - ink[3]) * (ink[3] - bottom) / (ink[3] - ink[1])
        for (const p of groups[0]) p.target = [p.target[0], lengthen(p.target[1]), p.target[2], lengthen(p.target[3])]
      }
      const roof = inkBounds([groups[0][1]])
      const top = roof[3] - bar * (roof[3] - roof[1]) - KRM_GAP * whole
      if (top > lower[3] || height) {
        const raise = y => lower[1] + (y - lower[1]) * (top - lower[1]) / (lower[3] - lower[1])
        for (const p of groups[1]) p.target = [p.target[0], raise(p.target[1]), p.target[2], raise(p.target[3])]
      }
      return
    }
    const cover = ch => COVER_ROOTS.has(ch) || COVERS.has(ch) || Boolean(this?.isCover?.(ch))
    const pairs = op === '⿱' ? (cover(children[0]) ? [[0, 1]] : [])
      : op === '⿳' ? [0, 1].filter(i => i + 1 < children.length && cover(children[i])).map(i => [i, i + 1]) : []
    // A cover on top of a three-band stack sets the bands: the roof, a taller middle that overlaps it
    // and a shorter, narrower bottom over the middle (害, 宴, and the 宀 over ㇒𰀁口 of C059). A roof
    // between the cover and a base (𠆢 over 又 in ⿳穴𠆢又, as 叜) is the body's head, not a block:
    // the base occupies the opening between the roof's legs and reaches the cell's foot.
    if (op === '⿳' && groups.length >= 3 && typeof children[0] === 'string' && cover(children[0])) {
      const coverBox = bounds(groups[0])
      const H = this.face[3] - this.face[1]
      const coverBottom = coverBox[3] - 0.30 * H
      const middleTop = coverBottom + 0.11 * H
      const middleBottom = middleTop - 0.43 * H
      const roofed = typeof children[1] === 'string' && ROOF_BODIES.has(children[1])
      const bottomTop = roofed ? middleTop - 0.32 * H : middleBottom - 0.065 * H
      const bottomBottom = roofed ? this.face[1] : bottomTop - 0.31 * H
      const width = coverBox[2] - coverBox[0], bottomWidth = roofed ? width * 0.64 : width * 0.66, centre = (coverBox[0] + coverBox[2]) / 2
      const middleWidth = roofed ? width * 0.90 : width
      const boxes = [
        [coverBox[0], coverBottom, coverBox[2], coverBox[3]],
        [centre - middleWidth / 2, middleBottom, centre + middleWidth / 2, middleTop],
        [centre - bottomWidth / 2, bottomBottom, centre + bottomWidth / 2, bottomTop],
      ]
      groups.forEach((group, i) => {
        const old = bounds(group)
        for (const p of group) p.target = targetFor(p, mapped(drawnBox(p), old, boxes[i]))
      })
    }
    for (const [above, below] of pairs) {
      const cover = groups[above] ?? [], lower = groups[below] ?? []
      if (!cover.length || !lower.length) continue
      const coverBox = bounds(cover), lowerBox = bounds(lower)
      const width = lowerBox[2] - lowerBox[0], height = lowerBox[3] - lowerBox[1]
      if (width <= 0 || height <= 0) continue
      for (const p of lower) {
        let best = null
        drawnContours(p).forEach((pts, index) => {
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
          for (let k = 0; k < pts.length; k += 2) {
            x0 = Math.min(x0, pts[k]); x1 = Math.max(x1, pts[k])
            y0 = Math.min(y0, pts[k + 1]); y1 = Math.max(y1, pts[k + 1])
          }
          const w = x1 - x0, h = y1 - y0
          if (w < 0.5 * width || h > 0.2 * width || y1 < lowerBox[3] - 0.3 * height) return
          if (!best || w > best.w) best = { w, index, centre: (x0 + x1) / 2 }
        })
        if (!best) continue
        const coverWidth = coverBox[2] - coverBox[0], want = COVER_BAR * coverWidth
        if (coverWidth <= 0 || best.w <= 0 || want >= best.w) continue
        const contours = p.part.contours.slice(), original = contours[best.index]
        const c = { ...original, light: original.light.slice(), heavy: original.heavy.slice() }
        contours[best.index] = c
        let minX = Infinity, maxX = -Infinity
        for (let k = 0; k < c.light.length; k += 2) {
          minX = Math.min(minX, c.light[k]); maxX = Math.max(maxX, c.light[k])
        }
        const centre = (minX + maxX) / 2, factor = want / best.w
        const shift = ((coverBox[0] + coverBox[2]) / 2 - best.centre) / scaleOf(p)[0]
        for (let k = 0; k < c.light.length; k += 2) {
          c.light[k] = centre + shift + (c.light[k] - centre) * factor
          c.heavy[k] = centre + shift + (c.heavy[k] - centre) * factor
        }
        p.part = derived(p.part, contours)
        break
      }
    }
    if (op === '⿳' && groups.length >= 3 && typeof children[0] === 'string' && children[1] === '冖') {
      const a = inkBounds(groups[0]), b = inkBounds(groups[1]), gap = a[1] - b[3]
      if (b[2] - b[0] >= 0.9 * (a[2] - a[0]) && a[2] - a[0] >= COVER_CLOSE_SHARE * (b[2] - b[0]) && gap > COVER_GAP) {
        const shift = Math.min(gap - COVER_GAP, 0.25 * (b[3] - b[1]))
        if (shift > 0) for (const group of groups.slice(1)) for (const p of group)
          p.target = [p.target[0], p.target[1] + shift, p.target[2], p.target[3] + shift]
      }
    }
    for (const [above, below] of pairs) {
      const cover = groups[above] ?? [], lower = groups[below] ?? []
      if (!cover.length || !lower.length) continue
      const coverInk = inkBounds(cover), lowerInk = inkBounds(lower), gap = coverInk[1] - lowerInk[3]
      if (op === '⿳' && children[1] === '冖' && lowerInk[2] - lowerInk[0] >= 0.9 * (coverInk[2] - coverInk[0]) && gap > COVER_GAP) {
        const shift = Math.min(gap - COVER_GAP, 0.25 * (lowerInk[3] - lowerInk[1]))
        for (const p of lower) p.target = [p.target[0], p.target[1] + shift, p.target[2], p.target[3] + shift]
      }
    }
    if (op === '⿱' && groups.length >= 2 && typeof children[0] === 'string' && cover(children[0])) {
      let topBox = null
      try {
        // The lower part written out, or named by a character whose sequence reads the same.
        // A written lower part drawn as one whole glyph keeps that glyph's own proportions.
        const tree = typeof children[1] === 'string' ? this.parse(this.sequenceOf(children[1]) ?? '')
          : groups[1].length > 1 ? children[1] : null
        if (Array.isArray(tree) && tree[0] === '⿱' && ['日', '曰', '田', '罒', '目', '四'].includes(tree[1])) topBox = tree[1]
      } catch { /* not a box-headed sequence */ }
      if (topBox) {
        const coverBox = bounds(groups[0]), lowerInk = inkBounds(groups[1]), height = lowerInk[3] - lowerInk[1]
        const split = lowerInk[3] - 0.45 * height
        const centre = (coverBox[0] + coverBox[2]) / 2
        // One map for the whole head: a box may be several contours (its counters, or a brush face's
        // separate strokes), and each must keep its place in it.
        // A counter inside a contour below stays with that contour.
        const above = b => (b[1] + b[3]) / 2 >= split
        const boxes = groups[1].flatMap(p => drawnContours(p).map(pointsBox)), below = boxes.filter(b => !above(b))
        const inHead = b => above(b) && !below.some(o => o[0] <= b[0] && o[1] <= b[1] && o[2] >= b[2] && o[3] >= b[3])
        // A lower part written out names its head: the first operand's part, whatever its height.
        const named = Array.isArray(children[1]) && groups[1].length > 1 ? groups[1][0] : null
        const headBoxes = named ? drawnContours(named).map(pointsBox) : boxes.filter(inHead)
        const headLeft = Math.min(...headBoxes.map(b => b[0])), headRight = Math.max(...headBoxes.map(b => b[2]))
        const head = (headLeft + headRight) / 2
        // A head already that narrow keeps its width.
        const factor = Math.min(BOX_HEAD * (coverBox[2] - coverBox[0]) / Math.max(headRight - headLeft, 1), 1)
        // What stands below takes one map of its own: left at its width, it outweighs the narrowed head.
        const isHead = (p, b) => named ? p === named : inHead(b)
        const bodyBoxes = groups[1].flatMap(p => drawnContours(p).map(pointsBox).filter(b => !isHead(p, b)))
        const bodyLeft = Math.min(...bodyBoxes.map(b => b[0])), bodyRight = Math.max(...bodyBoxes.map(b => b[2]))
        const body = (bodyLeft + bodyRight) / 2
        const bodyFactor = Math.min(BOX_BODY * (coverBox[2] - coverBox[0]) / Math.max(bodyRight - bodyLeft, 1), 1)
        for (const p of groups[1]) {
          const contours = p.part.contours.slice()
          let changed = false
          drawnContours(p).forEach((points, index) => {
            const b = pointsBox(points)
            const [from, by] = isHead(p, b) ? [head, factor] : [body, bodyFactor]
            const c = { ...contours[index] }
            let lo = Infinity, hi = -Infinity
            for (let k = 0; k < c.light.length; k += 2) { lo = Math.min(lo, c.light[k]); hi = Math.max(hi, c.light[k]) }
            const mid = (lo + hi) / 2, scale = (p.target[2] - p.target[0]) / Math.max(p.source[2] - p.source[0], 1)
            const middle = (b[0] + b[2]) / 2
            // A part mirrored across x moves the other way on the page than in its own coordinates.
            const side = (p.flips ?? []).reduce((sign, f) => f.x ? -sign : sign, 1)
            const shift = side * (centre + (middle - from) * by - middle) / scale
            const move = points => { const out = new Float64Array(points.length); for (let k = 0; k < points.length; k += 2) { out[k] = mid + shift + (points[k] - mid) * by; out[k + 1] = points[k + 1] } return out }
            c.light = move(c.light); c.heavy = move(c.heavy); contours[index] = c; changed = true
          })
          if (changed) p.part = derived(p.part, contours)
        }
      }
    }
  }

  /** The parts of the child's topmost operand, when the child is a vertical stack drawn as more
   *  than one operand. A child drawn as one piece has no operand to read, and a row (⿰, ⿲) has no
   *  single top. */
  topOperand(child, parts) {
    if (!isStack(child)) return null
    const top = parts.filter(part => part.branch?.[0] === 0)
    return top.length && top.length < parts.length ? top : null
  }

  /** Under a cover (宀, 冖) the component the child leads with carries the cover's width, the way
   *  the net 罒 does under the roof of 𡩲 and the block 旧 under the roof of 𭓿: a leading component
   *  with a wide flat top is drawn at `COVER_BAR` of the cover's width, centred on it, keeping the
   *  proportions it was drawn with: it loses as much height as width and stays against the cover.
   *  The rest of the child grows up into the room it gives up, from the child's own foot, so the
   *  stack reaches the cover as it does in the glyph and nothing passes below the child. 穴 and 雨
   *  hang a middle stroke where a component meeting it is drawn as it is. */
  clearUnderCover(op, children, groups) {
    if (this.partial || op !== '⿱' || children.length !== 2 || !SIDE_COVERS.has(children[0])) return
    const cover = groups[0], lower = groups[1]
    if (!cover?.length || !lower?.length) return
    const head = this.topOperand(children[1], lower)
    if (!head) return
    const coverBox = bounds(cover), want = COVER_BAR * (coverBox[2] - coverBox[0])
    const headBox = bounds(head)
    if (want <= 0 || headBox[2] - headBox[0] <= want || !flatTopped(head, headBox)) return
    const middle = (coverBox[0] + coverBox[2]) / 2, factor = want / (headBox[2] - headBox[0])
    const foot = headBox[3] - factor * (headBox[3] - headBox[1])
    const to = [middle - want / 2, foot, middle + want / 2, headBox[3]]
    for (const part of head) part.target = targetFor(part, mapped(drawnBox(part), headBox, to))
    const rest = lower.filter(part => !head.includes(part))
    if (!rest.length) return
    // Only into the room the component gave up: an operand already drawn against it stays put
    // rather than climbing over it.
    const restBox = bounds(rest), rise = Math.max(0, Math.min(foot - headBox[1], foot - restBox[3]))
    const risen = [restBox[0], restBox[1], restBox[2], restBox[3] + rise]
    if (rise && risen[3] > risen[1])
      for (const part of rest) part.target = targetFor(part, mapped(drawnBox(part), restBox, risen))
    this.hang(rest)
  }

  /** The last operand of the child under a cover closed on to the one above it, where it tapers to
   *  a point at the top, so it tucks under what it meets rather than running into it. The operand is
   *  the one cut the stack placed itself, read from its own stack's gap. */
  hang(rest) {
    const held = rest.filter(part => Number.isInteger(part.branch?.[0]))
    const operands = [...new Set(held.map(part => part.branch[0]))].sort((a, b) => a - b)
    if (held.length < rest.length || operands.length < 2) return
    const last = held.filter(part => part.branch[0] === operands.at(-1))
    const above = held.filter(part => part.branch[0] === operands.at(-2))
    if (last.length === 1) this.closed(last, above)
  }

  /** `below` raised until its top reaches the bottom of `above` by the overlap the donor drew, where
   *  it is a single cut a designer drew overlapping the component above it (`gap` below zero: 夫 as
   *  芙 cuts it, the lower half of 衣 as 袁 does). The overlap a donor records comes from either side,
   *  so a flat-topped operand stays where it is: there the gap is as likely to be a 艹 or a 亠
   *  hanging into the component below it, and raising a bar on to the bar above it welds the two. It
   *  grows no further than `STRETCH` allows: a wide gap is a sign the stack is not the one the donor
   *  drew. Two cuts whose boxes already meet still take the overlap, so a peak that merely touches a
   *  bar above it tucks under it. Answers whether the pair is settled. */
  closed(below, above, share = 1) {
    if (below.length !== 1 || !(below[0].gap < 0)) return false
    const box = bounds(below), aboveBottom = bounds(above)[1]
    if (box[3] <= box[1] || flatTopped(below, box)) return false
    // The overlap is measured in the donor's units, so it scales with the cut: the peak of ⿱一𧘇
    // reaches the 一's band but leaves a seam under the bar, which the 衣's own overlap closes.
    const reach = -below[0].gap * scaleOf(below[0])[1] * share
    if (reach < CLOSED_SHARE * Math.max(0, aboveBottom - box[3])) return false
    const meet = aboveBottom - below[0].gap * scaleOf(below[0])[1] * share
    if (meet <= box[3]) return true
    const to = [box[0], box[1], box[2], meet]
    if (stretchOf(box, to) > this.C.STRETCH) return false
    for (const part of below) part.target = targetFor(part, mapped(drawnBox(part), box, to))
    return true
  }

  /** A cover shortens what it covers, and the designer's own drawing leaves a band of white between
   *  the operands of the stack it holds: the 心 of 𡩬 stands clear of the 皿 under it. A pair drawn
   *  with less than `COVER_CLEAR` of the stack's height between them is drawn back until the band
   *  opens, each operand giving up no more than `COVER_TRIM` of its own height however many of its
   *  neighbours ask. The stack keeps the top and bottom the layout gave it, so only the crowding
   *  goes. Three kinds of pair are left alone: one whose boxes already cross, where there is no
   *  band to open and drawing back would only shrink both; one whose lower operand tapers to a
   *  point — the 八 of 㝙 — which stands clear of the bar above it already; and the pair the join
   *  is about to close. */
  openUnderCover(op, children, groups) {
    if (this.partial) return
    for (const [, below] of coverPairs(op, children, SIDE_COVERS)) {
      const parts = groups[below] ?? []
      const bands = operandBands(children[below], parts)
      if (!bands) continue
      const boxes = bands.map(bounds)
      const height = bounds(parts)[3] - bounds(parts)[1]
      if (height <= 0) continue
      const want = COVER_CLEAR * height, joined = joinedPair(bands, boxes)
      // `lift` raises an operand's foot, `drop` lowers its head; the composer's y points up, so
      // operand k stands above operand k + 1 and the band between them is k's foot less k + 1's head.
      const lift = bands.map(() => 0), drop = bands.map(() => 0)
      const left = boxes.map(box => COVER_TRIM * (box[3] - box[1]))
      for (let k = 0; k + 1 < bands.length; k++) {
        const band = boxes[k][1] - boxes[k + 1][3]
        if (band < 0 || band >= want || k === joined) continue
        if (topSpan(bands[k + 1], boxes[k + 1]) < COVER_BROAD) continue
        const give = Math.min((want - band) / 2, left[k], left[k + 1])
        if (give <= 0) continue
        lift[k] += give; left[k] -= give
        drop[k + 1] += give; left[k + 1] -= give
      }
      bands.forEach((band, k) => {
        const box = boxes[k]
        if (lift[k] + drop[k] <= 0 || box[3] - box[1] <= lift[k] + drop[k]) return
        const to = [box[0], box[1] + lift[k], box[2], box[3] - drop[k]]
        for (const part of band) part.target = targetFor(part, mapped(drawnBox(part), box, to))
      })
    }
  }

  /** A cover's side strokes mark how far what it covers may reach beside them: where the child
   *  rises alongside them — the 爿 of 㝲, the 爪 of 𭓹 — it stays within the cover's own ink. Only
   *  ink that high is measured, so the splayed foot of 木 in 宋 asks for nothing and that drawing
   *  stands; where a child does ask, the whole of it narrows about the cover's middle, foot
   *  included, rather than shearing at the line the measurement was taken on. Covers lower in a
   *  stack hold their children the same way. */
  containUnderCover(op, children, groups) {
    if (this.partial) return
    for (const [above, below] of coverPairs(op, children, SIDE_COVERS)) {
      const cover = groups[above] ?? [], lower = groups[below] ?? []
      if (!cover.length || !lower.length) continue
      const coverBox = bounds(cover), lowerBox = bounds(lower)
      const middle = (coverBox[0] + coverBox[2]) / 2, half = (coverBox[2] - coverBox[0]) / 2
      if (half <= 0) continue
      let reach = 0
      for (const part of lower) for (const points of drawnContours(part))
        for (let k = 0; k < points.length; k += 2) {
          if (points[k + 1] < coverBox[1]) continue
          reach = Math.max(reach, Math.abs(points[k] - middle))
        }
      const room = half * COVER_REACH
      if (reach <= room) continue
      const factor = room / reach
      const to = [middle + (lowerBox[0] - middle) * factor, lowerBox[1],
        middle + (lowerBox[2] - middle) * factor, lowerBox[3]]
      for (const part of lower) part.target = targetFor(part, mapped(drawnBox(part), lowerBox, to))
    }
  }

  /** A description often names the halves of one shape apart: the ⿳罒一𧘇 of 𡩲 ends in a 衣 drawn
   *  without its dot, whose middle bar the 一 spells on its own. Where the foot and the bar above it
   *  are one body by `joinedPair`, the foot is drawn over the whole of that bar rather than hung
   *  below it. A flat-topped foot — the base 一 of 𡩬 — keeps the room the stack gave it, so does a
   *  foot its donor drew clear, and so does one hanging from an operand with a body of its own
   *  rather than from a bar. */
  joinUnderCover(op, children, groups) {
    if (this.partial) return
    for (const [, below] of coverPairs(op, children, SIDE_COVERS)) {
      const bands = operandBands(children[below], groups[below] ?? [])
      if (!bands) continue
      const boxes = bands.map(bounds)
      const k = joinedPair(bands, boxes)
      if (k < 0) continue
      const foot = bands[k + 1], footBox = boxes[k + 1]
      const to = [footBox[0], footBox[1], footBox[2], boxes[k][3]]
      for (const part of foot) part.target = targetFor(part, mapped(drawnBox(part), footBox, to))
    }
  }

  // ---------------------------------------------------------------- weight
  /** Each part's strokes brought to the width the whole character's density calls for (`_balance`). */
  balance(group) {
    const C = this.C, stem = this.stem0
    const curve = (density, axis) => C.STEM_CURVE[axis][0] + C.STEM_CURVE[axis][1] * density / 1000
    const density = group.reduce((s, p) => { const [sx, sy] = scaleOf(p); return s + (p.inkLength ?? partInk(p.part)) * (sx + sy) / 2 }, 0)
    const ratio = [0, 1].map(axis => stem[axis][1] / stem[axis][0] - 1)
    // The stroke widths the whole drawing is brought to, which a placeholder's outline follows.
    this.stroke = [curve(density, 0), curve(density, 1)]
    for (const p of group) {
      if (p.empty !== undefined || p.fixed) continue
      const weight = [], target = p.target.slice(), scale = scaleOf(p)
      for (const axis of [0, 1]) {
        const box = p.balanceBox ?? p.source
        const extent = box[axis + 2] - box[axis]
        if (extent <= 2 * stem[axis][0]) {
          const width = extent * curve(density, axis) / curve(p.native, axis), middle = (target[axis] + target[axis + 2]) / 2
          target[axis] = middle - width / 2
          target[axis + 2] = middle + width / 2
          weight.push(0)
          continue
        }
        const measured = p.part.contours[0]?.width
        const own = measured ? measured[axis] : curve(p.native, axis)
        weight.push(Math.min(p.weightLimit?.[axis] ?? 1, Math.max(-0.6, (curve(density, axis) / (scale[axis] * own) - 1) / ratio[axis])))
      }
      p.target = target
      p.weight = weight
    }
  }
}

// -------------------------------------------------------------------- free functions
/** The box a group of placed parts is drawn in. */
function bounds(group) {
  const boxes = group.map(drawnBox)
  return [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])),
    Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))]
}

/** Whether a child is drawn as a vertical stack, so that its parts' `branch[0]` numbers its
 *  operands from the top down. A row (⿰, ⿲) numbers them across, and a leaf has none. */
function isStack(child) {
  return Array.isArray(child) && ['⿱', '⿳'].includes(child[0])
}

/** The operand pairs where one of `covers` stands directly above another operand. */
function coverPairs(op, children, covers) {
  if (op === '⿱') return covers.has(children[0]) ? [[0, 1]] : []
  if (op === '⿳') return [0, 1].filter(i => i + 1 < children.length && covers.has(children[i])).map(i => [i, i + 1])
  return []
}

/** The middle band of a three-band stack, narrowed to `MIDDLE_ACROSS` of the region when it is an
 *  enclosed box; bars and covers own the full width the way the font draws them. */
function narrowMiddleBand(child, groups, region) {
  if (!ENCLOSED_MIDDLE.has(child)) return
  const group = groups[1]
  if (!group?.length) return
  const box = bounds(group), width = box[2] - box[0], height = box[3] - box[1]
  if (!(width > 0 && height > 0) || width > BAR_ASPECT * height) return
  const want = (region[2] - region[0]) * MIDDLE_ACROSS
  if (want >= width) return
  const middle = (region[0] + region[2]) / 2
  const to = [middle - want / 2, box[1], middle + want / 2, box[3]]
  for (const part of group) part.target = targetFor(part, mapped(drawnBox(part), box, to))
}

/** The box of a group's ink, from the contours as drawn. */
function inkBounds(group) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of group) for (const points of drawnContours(p)) {
    const b = pointsBox(points)
    x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3])
  }
  return [x0, y0, x1, y1]
}

/** How much of its own width a group's ink spans within the top `COVER_HEAD` of its height: 1 for a
 *  component led by a bar the full width of itself, near 0 for one tapering to a point. */
function topSpan(group, box) {
  const height = box[3] - box[1], width = box[2] - box[0]
  if (height <= 0 || width <= 0) return 0
  const band = box[3] - COVER_HEAD * height
  let x0 = Infinity, x1 = -Infinity
  for (const part of group) for (const points of drawnContours(part))
    for (let k = 0; k < points.length; k += 2) {
      if (points[k + 1] < band) continue
      x0 = Math.min(x0, points[k]); x1 = Math.max(x1, points[k])
    }
  return x1 > x0 ? (x1 - x0) / width : 0
}

/** Whether a group leads with a wide flat top: its ink reaches both sides of its box within the
 *  top `COVER_HEAD` of its height, as the net 罒 and the block 旧 do and 王 and 心 do not. */
function flatTopped(group, box) {
  return topSpan(group, box) >= COVER_SPAN
}

/** A stack's operands as groups of parts, topmost first, or null where the child is not drawn as a
 *  stack of two or more. A part's `branch[0]` numbers its operand until the node above flattens. */
function operandBands(child, parts) {
  if (!isStack(child) || !parts.length) return null
  const indices = [...new Set(parts.map(part => part.branch?.[0]))]
    .filter(i => i !== undefined).sort((a, b) => a - b)
  if (indices.length < 2) return null
  return indices.map(i => parts.filter(part => part.branch?.[0] === i))
}

/** Which pair of a stack's operands the cover's join closes up, or −1 for none: always the last two,
 *  where the donor the foot was cut from drew it overlapping its neighbour (`gap` below zero), the
 *  foot rises to its join rather than leading with a bar of its own, what it hangs from is a bar
 *  rather than a body in its own right, and the layout left a gap between them. The band rule reads
 *  this too, so that it never opens a band the join is about to close. */
function joinedPair(bands, boxes) {
  const k = bands.length - 2
  if (k < 0) return -1
  const foot = bands[k + 1], footBox = boxes[k + 1], aboveBox = boxes[k]
  if (!foot.length || !bands[k].length || !foot.some(part => part.gap < 0)) return -1
  if (!(footBox[3] > footBox[1]) || aboveBox[1] <= footBox[3]) return -1
  if (flatTopped(foot, footBox)) return -1
  return aboveBox[3] - aboveBox[1] <= COVER_BARRED * (footBox[3] - footBox[1]) ? k : -1
}

/** The right outer edge of a vertical contour at `y`, from its flattened ring; -Infinity where the
 *  contour does not cross that height. */
function leftEdgeAt(contour, y) {
  const ring = rings([contour], [contour.light], 8)[0] ?? []
  let edge = Infinity
  for (let i = 0; i < ring.length; i += 2) {
    const j = (i + 2) % ring.length
    const x0 = ring[i], y0 = ring[i + 1], x1 = ring[j], y1 = ring[j + 1]
    if (y0 === y1) {
      if (y0 === y) edge = Math.min(edge, x0, x1)
      continue
    }
    if (y < Math.min(y0, y1) || y > Math.max(y0, y1)) continue
    edge = Math.min(edge, x0 + (x1 - x0) * (y - y0) / (y1 - y0))
  }
  return edge
}

function rightEdgeAt(contour, y) {
  const ring = rings([contour], [contour.light], 8)[0] ?? []
  let edge = -Infinity
  for (let i = 0; i < ring.length; i += 2) {
    const j = (i + 2) % ring.length
    const x0 = ring[i], y0 = ring[i + 1], x1 = ring[j], y1 = ring[j + 1]
    if (y0 === y1) {
      if (y0 === y) edge = Math.max(edge, x0, x1)
      continue
    }
    if (y < Math.min(y0, y1) || y > Math.max(y0, y1)) continue
    edge = Math.max(edge, x0 + (x1 - x0) * (y - y0) / (y1 - y0))
  }
  return edge
}

/** `part` with the middle horizontal of a `CONTAINED_MIDDLE_BARS` character cut back to its right vertical:
 *  the font lets 丑's third stroke run past that vertical, and the textbooks keep it inside. Answers
 *  `part` itself where it holds no separate middle bar and vertical to cut. */
/** Where a 丑's middle bar starts and ends across the glyph, as shares of its ink width: the font
 *  draws it from 222 to 764 in a glyph spanning 62 to 938. */
export const BAR_FROM = 0.18
export const BAR_TO = 0.80
/** How far inside the right vertical's outer edge the bar is cut, as a share of the part's width:
 *  the font ends 丑's bar at 764 with the vertical reaching 783, about 2% of the glyph. */
export const BAR_INSET = 0.02

function containedMiddleBar(part) {
  const boxes = part.contours.map(contour => pointsBox(contour.light))
  const wide = (box, times) => box[2] - box[0] > times * (box[3] - box[1])
  const bars = boxes.map((box, i) => ({ box, i })).filter(({ box }) => wide(box, BAR_ASPECT))
  if (bars.length !== 3) return part
  // Bars ordered by height, y up: the bottom one first and the top one last.
  bars.sort((a, b) => a.box[1] - b.box[1])
  const middle = bars[1].i
  const verticals = boxes.map((box, i) => ({ box, i })).filter(({ box }) => box[3] - box[1] > 2 * (box[2] - box[0]))
  if (!verticals.length) return part
  const right = verticals.reduce((a, b) => b.box[2] > a.box[2] ? b : a).i
  const contour = part.contours[middle]
  const light = Float64Array.from(contour.light), heavy = Float64Array.from(contour.heavy ?? contour.light)
  // The bar is also longer than the font draws a 丑's: a 丑 sets it from about a fifth of the glyph's
  // width in to four fifths, so the cut's bar is mapped onto that span before the right vertical
  // takes what still reaches past it.
  const ink = part.box, width = ink[2] - ink[0]
  const left = ink[0] + width * BAR_FROM, inset = width * BAR_INSET
  for (let k = 0; k < light.length; k += 2) {
    if (light[k] < left) { light[k] = left; if (heavy[k] < left) heavy[k] = left }
  }
  let cut = true
  for (let k = 0; k < light.length; k += 2) {
    const edge = rightEdgeAt(part.contours[right], light[k + 1]) - inset
    if (!Number.isFinite(edge) || light[k] <= edge) continue
    light[k] = edge
    if (heavy[k] > edge) heavy[k] = edge
    cut = true
  }
  if (!cut) return part
  const contours = part.contours.slice()
  contours[middle] = { ...contour, light, heavy }
  const out = derived(part, contours, part.box.slice())
  if (part.fixed) out.fixed = true
  if (part.strokes) out.strokes = part.strokes
  return out
}

/** A detached four-point horizontal spanning half the part that no native cut supports (`_extra_bar`). */
function extraBar(part, mask, references) {
  const size = 64, [x0, y0, x1, y1] = part.box, width = x1 - x0, height = y1 - y0
  for (const contour of part.contours) {
    const p = contour.light
    if (p.length !== 8) continue
    const b = pointsBox(p)
    if (b[2] - b[0] < 0.5 * width || b[3] - b[1] > 0.15 * height) continue
    const bar = fill(rings([contour], [p], 2), size, part.box).map((v, i) => v & mask[i])
    if (!count(bar) || !references.length) continue
    const others = part.contours.filter(c => c !== contour)
    const rest = fill(rings(others, others.map(c => c.light), 2), size, part.box).map((v, i) => v & mask[i])
    const near = grown(bar, size, 1)
    if (near.some((v, i) => v & rest[i])) continue
    const n = count(bar)
    if (references.every(ref => { let out = 0; for (let i = 0; i < bar.length; i++) out += bar[i] & (1 - ref[i]); return out > 0.25 * n })) return true
  }
  return false
}

/** The share of the inner parts' ink lying on the enclosing part's. */
export function collision(outer, inner, region, size = 64) {
  const a = fill(groupRings(outer), size, region), b = fill(groupRings(inner), size, region)
  let both = 0, total = 0
  for (let i = 0; i < a.length; i++) { both += a[i] & b[i]; total += b[i] }
  return both / Math.max(total, 1)
}

/** A group moved in from its low and high edges along `axis`, together. */
function squeeze(group, axis, low, high) {
  const lo = Math.min(...group.map(p => p.target[axis])), hi = Math.max(...group.map(p => p.target[axis + 2]))
  const newLo = lo + low, newHi = hi + high, scale = (newHi - newLo) / Math.max(hi - lo, 1)
  for (const p of group) {
    const t = p.target.slice()
    t[axis] = newLo + (p.target[axis] - lo) * scale
    t[axis + 2] = newLo + (p.target[axis + 2] - lo) * scale
    p.target = t
  }
}

/** The median gap between two groups along their facing edges, and the nearest gap, in font units
 *  (`_facing`). The median keeps one tapered stroke from widening every gap; the nearest tells
 *  whether one part reaches into the other anyway. */
function facing(a, b, axis, size = 250) {
  const ma = fill(groupRings(a), size, EM_BOX), mb = fill(groupRings(b), size, EM_BOX)
  const gaps = []
  for (let line = 0; line < size; line++) {
    // Side by side: per row, the last ink of the first and the first of the second, along columns.
    let lastA = -1, firstB = -1
    for (let k = 0; k < size; k++) {
      const i = axis === 0 ? line * size + k : k * size + line
      if (ma[i]) lastA = k
      if (mb[i] && firstB < 0) firstB = k
    }
    if (lastA >= 0 && firstB >= 0) gaps.push(firstB - lastA)
  }
  if (gaps.length < 5) return null
  gaps.sort((x, y) => x - y)
  const n = gaps.length, median = n % 2 ? gaps[(n - 1) / 2] : (gaps[n / 2 - 1] + gaps[n / 2]) / 2
  return { median: median * 1000 / size, min: gaps[0] * 1000 / size }
}

/**
 * The enclosed parts moved and scaled together to the largest size at which their ink fits the
 * enclosing part's opening, clear of its ink by `ROOM_MARGIN` stems, nearest where they stand
 * (`_fit_inside`). Answers whether a placement was found.
 */
export function fitInside(outer, inner, region, stem, C, { size = 64, room = null, anchor = null, bounds = null } = {}) {
  const w = (region[2] - region[0]) / size, h = (region[3] - region[1]) / size
  const margin = Math.max(1, pyRound(C.ROOM_MARGIN * stem / Math.max(w, h) / 2))
  const ink = grown(fill(groupRings(outer), size, region), size, margin)
  const words = (size + 31) >> 5
  const inkBits = new Uint32Array(size * words)
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (ink[r * size + c]) inkBits[r * words + (c >> 5)] |= 1 << (c & 31)
  const x0 = Math.min(...inner.map(p => p.target[0])), y0 = Math.min(...inner.map(p => p.target[1]))
  const x1 = Math.max(...inner.map(p => p.target[2])), y1 = Math.max(...inner.map(p => p.target[3]))
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const roomed = room ? Math.min(1.6, (room[2] - room[0]) / Math.max(x1 - x0, 1), (room[3] - room[1]) / Math.max(y1 - y0, 1)) : 1.6
  // A room can be narrower than `FIT_FLOOR` when the enclosure leaves little: start there anyway, and
  // keep walking below it, since the raster thins out and a scale can land on no ink at all.
  const top = Math.max(FIT_FLOOR, roomed)
  const steps = Math.ceil(top / 0.05 * 0.6) + 2
  for (let s = 0; s < steps; s++) {
    const scale = top + s * -0.05
    const hw = (x1 - x0) * scale / 2, hh = (y1 - y0) * scale / 2
    const box = [cx - hw, cy - hh, cx + hw, cy + hh]
    const moved = inner.map(p => ({ ...p, target: [cx + (p.target[0] - cx) * scale, cy + (p.target[1] - cy) * scale,
      cx + (p.target[2] - cx) * scale, cy + (p.target[3] - cy) * scale] }))
    const mask = fill(groupRings(moved), size, [box[0], box[3] - size * h, box[0] + size * w, box[3]])
    let r0 = size, r1 = -1, c0 = size, c1 = -1
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (mask[r * size + c]) {
      if (r < r0) r0 = r
      if (r > r1) r1 = r
      if (c < c0) c0 = c
      if (c > c1) c1 = c
    }
    if (r1 < 0) continue
    const mh = r1 - r0 + 1, mw = c1 - c0 + 1
    if (mh > size || mw > size) continue
    // The cropped mask shifted to every column, as bit rows.
    const shifted = []
    for (let C0 = 0; C0 + mw <= size; C0++) {
      const bits = new Uint32Array(mh * words)
      for (let i = 0; i < mh; i++) for (let j = 0; j < mw; j++) if (mask[(r0 + i) * size + c0 + j]) {
        const col = C0 + j
        bits[i * words + (col >> 5)] |= 1 << (col & 31)
      }
      shifted.push(bits)
    }
    const free = (R, C0) => {
      if (bounds && (region[0] + C0 * w < bounds[0] || region[0] + (C0 + mw) * w > bounds[2] ||
        region[3] - (R + mh) * h < bounds[1] || region[3] - R * h > bounds[3])) return false
      const bits = shifted[C0]
      for (let i = 0; i < mh; i++) for (let k = 0; k < words; k++) if (bits[i * words + k] & inkBits[(R + i) * words + k]) return false
      return true
    }
    const [ax, ay] = anchor ?? [cx, cy]
    const wantRow = (region[3] - (ay + hh)) / h + r0, wantCol = (ax - hw - region[0]) / w + c0
    // Free top-left corners in order of distance from where the parts stand, row-major among equals.
    const offsets = []
    for (let R = 0; R + mh <= size; R++) for (let C0 = 0; C0 + mw <= size; C0++) offsets.push([(R - wantRow) ** 2 + (C0 - wantCol) ** 2, R, C0])
    offsets.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]))
    const hit = offsets.find(([, R, C0]) => free(R, C0))
    if (!hit) continue
    const [, R, C0] = hit
    const topEdge = region[3] - (R - r0) * h, left = region[0] + (C0 - c0) * w
    const dx = left - (cx - hw), dy = topEdge - (cy + hh)
    for (const p of inner) {
      const t = p.target
      p.target = [cx + (t[0] - cx) * scale + dx, cy + (t[1] - cy) * scale + dy, cx + (t[2] - cx) * scale + dx, cy + (t[3] - cy) * scale + dy]
    }
    return true
  }
  return false
}

/**
 * A glyph drawn round the lower left of another part as a designer draws it there (`_swept`): its
 * strokes pressed left of `edge`, the stroke sweeping along its foot drawn out under the other part.
 */
export function sweptPart(p, edge, C, tail = null) {
  const contours = drawnContours(p)
  const boxes = contours.map(pointsBox)
  const x0 = Math.min(...boxes.map(b => b[0])), y0 = Math.min(...boxes.map(b => b[1]))
  const x1 = Math.max(...boxes.map(b => b[2])), y1 = Math.max(...boxes.map(b => b[3]))
  const [reach, foot] = C.SWEEP_REACH
  const sweeps = boxes.map((b, k) => [b, k]).filter(([b]) => b[2] >= x1 - reach * (x1 - x0) && b[1] <= y0 + foot * (y1 - y0)
    && b[3] - b[1] >= C.SWEEP_RISE * (y1 - y0)).map(([, k]) => k)
  if (sweeps.length !== 1 || contours.length < 2) return null
  const sweep = sweeps[0], pts = contours[sweep]
  // A glyph drawn as one outline with its counters (Klee One's 电) has no separate stroke to sweep:
  // the outline already runs round the lower left, and pressing its counters apart would lose the
  // 日. Press the whole glyph, counters and all.
  const sweepRing = rings([p.part.contours[sweep]], [pts])[0]
  if (contours.every((c, k) => k === sweep || insideRing(rings([p.part.contours[k]], [c])[0], sweepRing)))
    return [pressedEnclosure(p, sweep, ENCLOSURE_SHARE, tail) ?? { ...p, origin: `enclosure ${p.origin}` }]
  let lowMin = Infinity, lowMax = -Infinity
  for (let i = 0; i < pts.length; i += 2) if (pts[i + 1] <= y0 + 0.2 * (y1 - y0)) { lowMin = Math.min(lowMin, pts[i]); lowMax = Math.max(lowMax, pts[i]) }
  if (lowMax < lowMin || lowMax - lowMin < C.SWEEP_FOOT * (x1 - x0)) return null
  const head = Math.max(...boxes.filter((_, k) => k !== sweep).map(b => b[2]))
  if (head <= edge || edge <= x0 + (x1 - x0) / 4) return null
  edge = Math.max(edge, x0 + C.SWEEP_PRESSED * (head - x0))
  const pressed = (edge - x0) / (head - x0)
  const left = boxes[sweep][0], turn = left + C.STEM_SPAN, end = x1 - C.SWEEP_END * (x1 - x0)
  const shift = (left - x0) * pressed - (left - x0)
  if (end <= turn + shift) return null
  const start = turn + shift
  const drawnOut = points => {
    const out = points.slice()
    for (let i = 0; i < out.length; i += 2) {
      const x = points[i]
      out[i] = x <= turn ? x + shift : x <= end ? start + (x - turn) * (end - start) / (end - turn) : x
    }
    return out
  }
  const [sx, sy] = scaleOf(p)
  const cx = (p.source[0] + p.source[2]) / 2, cy = (p.source[1] + p.source[3]) / 2
  const gx = (p.target[0] + p.target[2]) / 2, gy = (p.target[1] + p.target[3]) / 2
  const at = (c, move) => {
    const map = src => { const out = new Float64Array(src.length); for (let i = 0; i < src.length; i += 2) { out[i] = (src[i] - cx) * sx + gx; out[i + 1] = (src[i + 1] - cy) * sy + gy } return move(out) }
    return { ops: c.ops, light: map(c.light), heavy: map(c.heavy), width: c.width }
  }
  const strokes = derived(p.part, p.part.contours.filter((_, k) => k !== sweep).map(c => at(c, q => q)))
  const box = strokes.box
  const pressedBox = [x0 + (box[0] - x0) * pressed, box[1], x0 + (box[2] - x0) * pressed, box[3]]
  const drawn = derived(p.part, [at(p.part.contours[sweep], drawnOut)])
  return [placed(strokes, strokes.box, pressedBox, p.native, `swept ${p.origin}`, p.weight),
    placed(drawn, drawn.box, drawn.box.slice(), p.native, `swept ${p.origin}`, p.weight)]
}

/**
 * A glyph drawn as one outline with its counters (Klee One's 电), pressed as a designer presses a
 * box round another part: the box keeps `share` of the width and the foot is drawn out to the right
 * edge, as Kureedo draws 巴 round 三 in 𠀧 (⿺巴三). Every contour takes the same x map, so the
 * counters stay inside the outline and the box keeps its windows.
 */
export function pressedEnclosure(p, sweep, share = ENCLOSURE_SHARE, tail = null) {
  // The map belongs to the glyph's own coordinates: the placement scales the pressed part whole.
  const boxes = p.part.contours.map(c => pointsBox(c.light))
  const x0 = Math.min(...boxes.map(b => b[0])), x1 = Math.max(...boxes.map(b => b[2]))
  // The box's right edge is its counter's right plus the thickness of the box's left frame.
  const windows = boxes.filter((_, k) => k !== sweep)
  const boxRight = Math.min(x1, Math.max(...windows.map(b => b[2])) + Math.min(...windows.map(b => b[0])) - x0)
  if (!(boxRight > x0 && boxRight < x1)) return null
  const width = x1 - x0, r = (boxRight - x0) / width
  const mapX = points => {
    const out = points.slice()
    for (let i = 0; i < out.length; i += 2) {
      const u = (out[i] - x0) / width
      // The box compresses linearly; its foot takes a Möbius map that starts steeper than the foot's
      // mean stretch and eases toward the tip, so the rising hook keeps its angle.
      const v = u <= r ? share * u / r : share + (1 - share) * footMap((u - r) / (1 - r))
      out[i] = x0 + width * v
    }
    return out
  }
  const mapped = p.part.contours.map(c => ({ ops: c.ops, light: mapX(c.light), heavy: mapX(c.heavy), width: c.width }))
  if (tail) {
    const grafted = graftTail(mapped, sweep, x0, width, tail)
    if (grafted) return placed(makePart(grafted, p.part.box.slice()), p.source, p.target, p.native, `enclosure ${p.origin}`, p.weight)
  }
  return placed(makePart(mapped, p.part.box.slice()), p.source, p.target, p.native, `enclosure ${p.origin}`, p.weight)
}

// How far the grafted tail's leg runs up inside the host's own leg, so the seam leaves no hairline;
// how far down the host's leg a cut is looked for, and how much wider than the leg the floor reads.
const GRAFT_OVERLAP = 8
const GRAFT_STEPS = 48
const GRAFT_FLARE = 1.3
// How far past a bottom stroke's measured edge a cut clears it, where that edge is not flat, and
// how far above a rising tip the donor's cut stays, so the cut crosses its leg alone.
const GRAFT_CLEAR = 1.15
const GRAFT_RISE = 4

/**
 * The tail of a pressed enclosure taken from a face's own ⿺ glyph: 电's 乚 — the leg hanging from
 * the stroke drawn between its counters, the floor and the rising tip — replaced by 巴's, as
 * Kureedo draws it round 三 in 𠀧. The host keeps everything above the cut, the donor's leg lands
 * on the host's, and the donor's tip reaches the glyph's right edge. Font units, y up.
 */
function graftTail(contours, sweep, x0, width, tail) {
  const others = contours.filter((_, k) => k !== sweep)
  if (tail.contours.length < 2 || others.length < 2) return null
  const masters = ['light', 'heavy']
  const plan = graftPlan(masters.map(m => flattenRing(contours[sweep], m)), masters.map(m => flattenRing(tail.contours[0], m)),
    masters.map(m => others.map(c => pointsBox(c[m]))), masters.map(m => tail.contours.slice(1).map(c => pointsBox(c[m]))))
  if (!plan) return null
  // Both masters are cut at the same places along their outlines, so their points stay paired.
  const light = graftPieces(contours[sweep], tail.contours[0], 'light', plan, x0, width)
  if (!light) return null
  const heavy = graftPieces(contours[sweep], tail.contours[0], 'heavy', plan, x0, width) ?? light
  const out = [ringContour(light.body, heavy.body)]
  for (const c of others) out.push(ringContour(flattenRing(c, 'light'), flattenRing(c, 'heavy'), false))
  out.push(ringContour(light.tail, heavy.tail))
  return out
}

/** Where the host and the donor are cut: the levels, and the places along each outline the cut
 *  falls, as [edge, position] pairs. The levels clear every master, since one cut serves them all. */
function graftPlan(hosts, donors, windows, donorWindows) {
  // The column between the host's counters, where 电's 乚 hangs from the stroke drawn through it.
  // A heavier master's counters stand closer together, so the column is the one they share.
  const gaps = windows.map(columnGap)
  if (gaps.some(g => !g)) return null
  const gap = [Math.max(...gaps.map(g => g[0])), Math.min(...gaps.map(g => g[1]))]
  if (!(gap[1] > gap[0])) return null
  const legAt = (ring, y) => spansAt(ring, y).find(([a, b]) => b > gap[0] && a < gap[1])
  // Under the thickest master's bottom stroke, so that level crosses the leg in all of them.
  const bar = Math.min(...hosts.map((ring, k) => {
    const barTop = Math.min(...windows[k].map(b => b[1]))
    return barTop - bottomStroke(ring, windows[k], barTop) * GRAFT_CLEAR
  }))
  const stems = hosts.map(ring => legAt(ring, bar))
  if (stems.some(s => !s || !(s[1] - s[0] > 0))) return null
  // The cut runs as far down the leg as the leg stays a leg in every master — it widens where the
  // floor leaves it — so the host keeps its left frame's own foot and hands over no more than the sweep.
  const lows = hosts.map(ring => Math.min(...ring.map(([, y]) => y)))
  const low = Math.min(...lows)
  let cut = bar
  for (let k = 1; k <= GRAFT_STEPS; k++) {
    const y = bar - (bar - low) * k / GRAFT_STEPS
    const spans = hosts.map(ring => legAt(ring, y))
    if (spans.some((s, i) => !s || s[1] - s[0] > GRAFT_FLARE * (stems[i][1] - stems[i][0]))) break
    cut = y
  }
  const inside = [(windows[0][0][0] + windows[0][0][2]) / 2, (windows[0][0][1] + windows[0][0][3]) / 2]
  const body = cutAt(hosts[0], cut, true).find(ring => inPoly(materialise(hosts[0], ring), inside))
  if (!body) return null
  // The donor's own bottom stroke, and below it the leg its sweep hangs from.
  const under = Math.min(...donors.map((ring, k) => {
    const donorBar = Math.min(...donorWindows[k].map(b => b[1]))
    return donorBar - bottomStroke(ring, donorWindows[k], donorBar) * GRAFT_CLEAR
  }))
  const legs = donors.map(ring => spansAt(ring, under))
  if (legs.some(spans => !spans.length)) return null
  // The donor is cut as low as its rising tip allows, so its leg lands on the host's own leg
  // without reaching up past the host's bottom stroke.
  const donorCut = Math.max(...donors.map((ring, k) => {
    const dy = lows[k] - Math.min(...ring.map(([, y]) => y))
    const hook = ring.filter(([x, y]) => x > legs[k][0][1] && y < under).map(([, y]) => y)
    return Math.max(cut + GRAFT_OVERLAP - dy, hook.length ? Math.max(...hook) + GRAFT_RISE : -Infinity)
  }))
  if (!(donorCut <= under) || donors.some(ring => spansAt(ring, donorCut).length !== 1)) return null
  const pieces = cutAt(donors[0], donorCut, false)
  if (pieces.length !== 1) return null
  return { gap, bar, cut, donorCut, body, tail: pieces[0] }
}

/** One master's two pieces: the host's body above the cut, and the donor's tail mapped under it. */
function graftPieces(outline, donorOutline, master, plan, x0, width) {
  const host = flattenRing(outline, master), donor = flattenRing(donorOutline, master)
  const { gap, bar, cut, donorCut } = plan
  const legAt = y => spansAt(host, y).find(([a, b]) => b > gap[0] && a < gap[1])
  const stem = legAt(bar), seam = legAt(cut)
  const donorLegs = spansAt(donor, donorCut)
  if (!stem || !seam || !donorLegs.length) return null
  const [legLeft, legRight] = donorLegs[0]
  const tail = materialise(donor, plan.tail)
  const tip = Math.max(...tail.map(([x]) => x))
  const x1 = x0 + width, run = (x1 - seam[1]) / (tip - legRight)
  if (!(seam[1] - seam[0] > 0) || !(legRight - legLeft > 0) || !(tip > legRight) || !(run > 0)) return null
  // Where the donor's leg runs up beside the host's it takes the host's own two edges at that level,
  // so the seam leaves no step and the leg reads one width from the counters down to the turn. Under
  // the cut it keeps the width the host ends on, and with it the donor's own brush shape.
  const column = y => {
    if (y <= cut) return seam
    const span = legAt(y)
    return span && span[1] - span[0] <= GRAFT_FLARE * (stem[1] - stem[0]) ? span : y > bar ? stem : seam
  }
  // The floor beyond the leg runs out to the glyph's right edge through the Möbius map, whose
  // stretch reaches 1 at the tip, so the hook keeps its width.
  const dy = Math.min(...host.map(([, y]) => y)) - Math.min(...donor.map(([, y]) => y))
  return {
    body: materialise(host, plan.body),
    tail: tail.map(([x, y]) => {
      const at = y + dy
      if (x > legRight) return [seam[1] + (x1 - seam[1]) * footMap((x - legRight) / (tip - legRight), run), at]
      const [left, right] = column(at)
      return [right - (legRight - x) * (right - left) / (legRight - legLeft), at]
    }),
  }
}

/** The first gap between the columns a glyph's counters stand in, where one stroke runs down. */
function columnGap(windows) {
  const cols = windows.map(b => [b[0], b[2]]).sort((a, b) => a[0] - b[0])
  let reach = cols[0][1]
  for (const [a, b] of cols.slice(1)) {
    if (a > reach) return [reach, a]
    reach = Math.max(reach, b)
  }
  return null
}

/** The x spans a polygon's ink covers along the line y = `cut`, left to right. */
function spansAt(poly, cut) {
  const xs = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    if ((a[1] <= cut) === (b[1] <= cut)) continue
    xs.push(a[0] + (b[0] - a[0]) * (cut - a[1]) / (b[1] - a[1]))
  }
  xs.sort((p, q) => p - q)
  const out = []
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]])
  return out
}

/** Whether a point lies inside a polygon (even-odd). */
function inPoly(poly, [x, y]) {
  let odd = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[j]
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) odd = !odd
  }
  return odd
}

/** The points a cut names, read off a polygon: a vertex, or a place along the edge leaving it. */
function materialise(poly, places) {
  return places.map(([i, t]) => {
    if (t === null) return poly[i]
    const a = poly[i], b = poly[(i + 1) % poly.length]
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  })
}

/**
 * A simple polygon cut by the horizontal line y = `cut`, keeping the side above or below it, as the
 * pieces it falls into, each named as [edge, position] pairs. Sutherland–Hodgman would join those
 * pieces along the line; a glyph's outline is concave — the 乚 of a pressed 电 leaves its hook
 * standing beside the leg — so the pieces are closed one by one instead, pairing the crossings
 * along the line as a scanline fills them.
 */
function cutAt(poly, cut, above) {
  const keep = y => above ? y > cut : y < cut
  const walk = [], crossings = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    if (keep(a[1])) walk.push({ at: [i, null] })
    if (keep(a[1]) === keep(b[1])) continue
    const t = (cut - a[1]) / (b[1] - a[1])
    const crossing = { at: [i, t], x: a[0] + (b[0] - a[0]) * t, id: crossings.length }
    crossings.push(crossing)
    walk.push(crossing)
  }
  if (!walk.length) return []
  if (!crossings.length) return [poly.map((_, i) => [i, null])]
  if (crossings.length % 2) return []
  // Chains of kept points, each running from the crossing that enters to the one that leaves.
  const start = walk.findIndex((v, i) => v.id !== undefined && walk[(i + 1) % walk.length].id === undefined)
  if (start < 0) return []
  const chains = []
  let chain = null
  for (let k = 0; k < walk.length; k++) {
    const v = walk[(start + k) % walk.length]
    if (v.id === undefined) chain?.push(v)
    else if (chain) { chain.push(v); chain = null }
    else { chain = [v]; chains.push(chain) }
  }
  // Along the line the ink lies between the crossings taken in pairs, left to right.
  const order = crossings.slice().sort((a, b) => a.x - b.x)
  const mate = new Map()
  for (let i = 0; i + 1 < order.length; i += 2) {
    mate.set(order[i].id, order[i + 1].id)
    mate.set(order[i + 1].id, order[i].id)
  }
  const byStart = new Map(chains.map(c => [c[0].id, c]))
  const out = [], used = new Set()
  for (const first of chains) {
    if (used.has(first[0].id)) continue
    const ring = []
    let at = first
    while (at && !used.has(at[0].id)) {
      used.add(at[0].id)
      for (const v of at) ring.push(v.at)
      at = byStart.get(mate.get(at.at(-1).id))
    }
    if (ring.length >= 3) out.push(ring)
  }
  return out
}

/** A contour flattened into a polygon of [x, y] points, its curve chains sampled in `steps`. */
function flattenRing(contour, master = 'light', steps = 24) {
  const [ring] = rings([contour], [contour[master]], steps)
  const out = []
  for (let i = 0; i + 1 < ring.length; i += 2) out.push([ring[i], ring[i + 1]])
  return out
}

const ringArea = poly => poly.reduce((sum, [x, y], i) => sum + (x * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * y), 0) / 2
/** How thick the bottom stroke under a glyph's counters is: the ink standing in the column under
 *  the left-hand counter, measured from that counter's bottom edge down to where the stroke ends.
 *  A floor sweeping past below is a separate span in that column and does not count. */
function bottomStroke(ring, windows, bottom) {
  const win = windows.reduce((a, b) => (b[0] < a[0] ? b : a))
  const cx = (win[0] + win[2]) / 2
  const ys = []
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length]
    if ((ax <= cx) === (bx <= cx)) continue
    ys.push(ay + (by - ay) * (cx - ax) / (bx - ax))
  }
  ys.sort((p, q) => p - q)
  for (let i = 0; i + 1 < ys.length; i += 2) if (ys[i] < bottom && ys[i + 1] > bottom) return Math.max(1, bottom - ys[i])
  return Math.max(1, bottom - Math.min(bottom, ...ys))
}

/** A closed polygon resampled to `n` points by arc length, so the light and heavy rings pair up. */
function resampleRing(poly, n) {
  const m = poly.length, sides = []
  let total = 0
  for (let i = 0; i < m; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % m]
    const len = Math.hypot(x1 - x0, y1 - y0)
    sides.push(len)
    total += len
  }
  const out = []
  for (let k = 0; k < n; k++) {
    let at = (k / n) * total, i = 0
    while (i < m - 1 && at > sides[i]) { at -= sides[i]; i++ }
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % m]
    const t = sides[i] ? Math.min(at / sides[i], 1) : 0
    out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t])
  }
  return out
}
/** A polygon as a part contour, wound as ink (clockwise) in both masters. */
function ringContour(light, heavy = null, clockwise = true) {
  const flip = (poly) => (ringArea(poly) > 0) === clockwise ? poly.slice().reverse() : poly
  let ring = flip(light)
  let twin = heavy ? flip(heavy) : ring
  const n = Math.max(ring.length, twin.length)
  if (ring.length !== n) ring = resampleRing(ring, n)
  if (twin.length !== n) twin = resampleRing(twin, n)
  return {
    ops: Array.from({ length: ring.length }, (_, i) => [i ? 'L' : 'M', 1, false]),
    light: Float64Array.from(ring.flat()),
    heavy: Float64Array.from(twin.flat()),
    width: null,
  }
}

/** The Möbius map along a pressed enclosure's foot: `s` runs from 0 at the box's right edge to 1 at
 *  the glyph's right, and the stretch starts `FOOT_RATIO` times its mean, easing to the reciprocal
 *  at the tip. */
export const footMap = (s, ratio = FOOT_RATIO) => ratio * s / (1 + (ratio - 1) * s)

/** Whether every point of `ring` lies inside the closed `outer` ring (font units, y up). */
function insideRing(ring, outer) {
  for (let i = 0; i < ring.length; i += 2) {
    const x = ring[i], y = ring[i + 1]
    let winding = 0
    for (let j = 0; j < outer.length; j += 2) {
      const k = (j + 2) % outer.length
      const x0 = outer[j], y0 = outer[j + 1], x1 = outer[k], y1 = outer[k + 1]
      const side = (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0)
      if (y0 <= y && y1 > y && side > 0) winding++
      else if (y0 > y && y1 <= y && side < 0) winding--
    }
    if (winding === 0) return false
  }
  return true
}

export { raster }
