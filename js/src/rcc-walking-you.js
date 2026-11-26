import { cutContours, derived, mapped, partInk, partOf, placed, segments } from './geometry.js'
import { hexOf } from './sha256.js'

// The five glyphs in RCC sighting 2875 show the sweep crossing the last
// downstroke of ㇋. The folded stroke extends below the junction on the left.
// https://rare.glyphatlas.org/en/entry/2711#sighting-2875
export const walkingYou = '⿺#(㇋乀)由'
const operands = ['#(㇋乀)', '㇋', '乀', '由']
/** @type {Record<string, [string, string, number[], number[]][]>} */
const cuts = {
  regular: [['廸', '8a70c838e829ec6b5227d60619f140cfa0606d8e4b31b296c1b113920a8438de', [0], [1, 2, 3, 4, 5]]],
  fangsong: [
    ['廻', '63cf5ed51792c8cba15db0ca97d5c2bd758c2ad364a4e6fd2a966f89d71cae61', [0], []],
    ['迪', 'e1f6b56e37645cd7d2e544638b251e3ecb79ce27d7871ed80516cdd71c7d081e', [], [1, 3, 4, 5]],
  ],
  'pen-writing': [['廸', 'ef14dfc19db2f5da28a37af260d11ed1a975a5253f58219b5f8878c0523cd00e', [1], [0, 2, 3, 4, 5]]],
}

// Sighting 2875, sample 00Ad, has a short rising entry before the sweep
// descends through the folded stroke. IPAmj draws that entry in MJ011106.
// https://www.unicode.org/ivd/data/2022-09-13/IVD_Sequences.txt
// Commands run around each verified native contour, passing the sweep,
// the terminal, and the entry. Kureedo's contour runs in the other direction.
/** @type {Record<string, { sweep: number[], terminal: number[], entry: number[], tip: number[], origin: number[], joint: number, tail: number, terminalTop: number }>} */
const outline = {
  regular: {
    sweep: [35, 48], terminal: [38, 45], entry: [56, 63], tip: [57, 61],
    origin: [.056, .595], joint: .66, tail: .903, terminalTop: .857,
  },
  fangsong: {
    sweep: [53, 4], terminal: [58, 2], entry: [8, 17], tip: [10, 15],
    origin: [.049, .639], joint: .695, tail: .979, terminalTop: .885,
  },
  'pen-writing': {
    sweep: [21, 34], terminal: [25, 31], entry: [3, 13], tip: [5, 10],
    origin: [.023, .652], joint: .675, tail: 1, terminalTop: .899,
  },
}
const unit = [0, 0, 1, 1]
const slots = [[0, 0, 1, .975], [.385, .20, .945, 1]]

/** @typedef {[string, number[][]]} Segment */
/** @param {any} piece @param {string} style */
function walkingFrame(piece, style) {
  const contour = piece.contours[0], shape = outline[style], pen = style === 'pen-writing'
  const [left, bottom, right, top] = piece.box
  const width = right - left, height = top - bottom
  /** @param {number} x @param {number} y */
  const at = (x, y) => [left + x * width, top - y * height]
  /** @param {number[]} point */
  const normalized = point => [(point[0] - left) / width, (top - point[1]) / height]
  // Retain the angular top, extending the last fold down to the crossing.
  /** @param {number[]} point */
  const fold = point => {
    const [x, y] = normalized(point)
    if (y < .40) return point
    return at(x, y < shape.joint
      ? .40 + (y - .40) * .37 / (shape.joint - .40)
      : .77 + (y - shape.joint) * .226 / (shape.tail - shape.joint))
  }
  // Rotate the donor's entry tip onto the left end of the rising flick.
  /** @param {number[]} point */
  const tip = point => {
    const [x, y] = normalized(point), dx = x - shape.origin[0], dy = y - shape.origin[1]
    return at(.037 + .63 * dx + .71 * dy, .668 - .80 * dx + .58 * dy)
  }
  // Set the brush release along the baseline at its native winding.
  /** @param {number[]} point */
  const finish = point => {
    const [x, y] = normalized(point)
    return at(1 - (1 - x) * (pen ? 1 : .80), .910 + (y - shape.terminalTop) * (pen ? .75 : .60))
  }
  const lightPath = /** @type {Segment[]} */ (segments(contour.ops, contour.light))
  // Kureedo's second master moves inward. The shortened entry and leveled
  // sweep need only a fraction of its original displacement.
  const tipShare = pen ? .30 : 1, sweepShare = pen ? .60 : 1
  /** @param {'light' | 'heavy'} master @returns {Segment[]} */
  function draw(master) {
    const path = master === 'light' ? lightPath : /** @type {Segment[]} */ (segments(contour.ops, contour.heavy))
    /** @param {number} index */
    const end = index => path[index][1][path[index][1].length - 1]
    // Each side inherits the movement of its adjoining native brush edge.
    /** @param {number} index @param {(point: number[]) => number[]} transform */
    const movement = (index, transform) => {
      const points = lightPath[index][1], base = transform(points[points.length - 1]), actual = transform(end(index))
      return [actual[0] - base[0], actual[1] - base[1]]
    }
    /** @param {number} x @param {number} y @param {number[]} delta @param {number} [share] */
    const offset = (x, y, delta, share = 1) => [left + x * width + share * delta[0], top - y * height + share * delta[1]]
    /** @param {number[]} run @param {(point: number[]) => number[]} transform @param {Segment[]} [source] @returns {Segment[]} */
    const copy = ([first, last], transform, source = path) => {
      const run = first <= last ? source.slice(first + 1, last + 1) : [...source.slice(first + 1), ...source.slice(1, last + 1)]
      return run.map(([op, points]) => [op, points.map(transform)])
    }
    /** @param {number} join @param {number} terminal @param {boolean} lower @param {boolean} returning @returns {Segment[]} */
    const edge = (join, terminal, lower, returning) => {
      const root = fold(end(join)), stop = finish(end(terminal)), lane = lower ? .955 : .905
      const [x, y] = normalized(root), [terminalX] = normalized(stop)
      const delta = movement(terminal, finish)
      const bend = at(x + .075, y + .105)
      const ease = offset(.45, lane - .008, delta, sweepShare), middle = offset(.56, lane, delta, sweepShare)
      const settle = offset((.56 + terminalX) / 2, lane + .009, [delta[0] / 2, delta[1]], sweepShare)
      return returning ? [['Q', [settle, middle]], ['C', [ease, bend, root]]]
        : [['C', [bend, ease, middle]], ['Q', [settle, stop]]]
    }
    const [start, stop] = shape.sweep, [first, last] = shape.terminal, [from, to] = shape.entry
    const [tipStart] = shape.tip, join = fold(end(to))
    const tipPath = pen && master === 'heavy'
      ? /** @type {Segment[]} */ (segments(contour.ops, contour.light.map(
          /** @param {number} point @param {number} i */ (point, i) => point + tipShare * (contour.heavy[i] - point))))
      : path
    const tipIn = tip(tipPath[tipStart][1][tipPath[tipStart][1].length - 1])
    const nativeTip = copy(shape.tip, tip, tipPath)
    const [low, high] = (pen ? [...shape.tip].reverse() : shape.tip)
      .map(index => movement(index, tip).map(delta => delta * tipShare))
    const rise = offset(.129, .54, high, .65), turn = offset(.105, .596, low, .65)
    const hair = offset(.087, .606, high), shoulder = offset(.141, .671, high, .65)
    const brush = offset(.077, .647, low), heel = offset(.145, .718, low, .65)
    /** @type {Segment[]} */
    const flick = pen
      ? [['Q', [shoulder, rise]], ['Q', [hair, tipIn]], ...nativeTip, ['Q', [brush, turn]], ['Q', [heel, join]]]
      : [['Q', [heel, turn]], ['Q', [brush, tipIn]], ...nativeTip, ['Q', [hair, rise]], ['Q', [shoulder, join]]]
    return [['M', [fold(end(start))]], ...edge(start, first, pen, false), ...copy(shape.terminal, finish),
      ...edge(stop, last, !pen, true), ...copy([stop, from], fold), ...flick, ...copy([to, start], fold)]
  }
  const light = draw('light'), heavy = draw('heavy')
  const frame = { ...contour, ops: light.map(([op, points]) => [op, points.length, false]),
    light: Float64Array.from(light.flatMap(([, points]) => points.flat())),
    heavy: Float64Array.from(heavy.flatMap(([, points]) => points.flat())) }
  return { ...derived(piece, [frame]), strokes: piece.strokes }
}

/** @type {WeakMap<object, any[]>} */
const pieces = new WeakMap()

/** @param {string} style */
export const walkingYouDonors = style => Object.hasOwn(cuts, style) ? cuts[style].map(([char]) => char) : []

/** @param {import('./compose.js').Composer} composer @param {number[]} region */
export function walkingYouParts(composer, region) {
  const entries = Object.hasOwn(cuts, composer.fontStyle) && cuts[composer.fontStyle]
  if (!entries || [walkingYou, ...operands].some(ch => composer.excluded(ch))) return null
  const parts = []
  for (const [char, digest, outer, inner] of entries) {
    if (composer.excluded(char)) return null
    const record = composer.glyphRecord(char)
    if (record?.v !== 1 || hexOf(JSON.stringify(record.p)) !== digest) return null
    const glyph = partOf(record)
    let leaves = pieces.get(glyph)
    if (!leaves) pieces.set(glyph, leaves = [])
    for (const [rccLeaf, indices] of [outer, inner].entries()) {
      if (!indices.length) continue
      let piece = leaves[rccLeaf]
      if (!piece) {
        const native = cutContours(glyph, indices)
        piece = leaves[rccLeaf] = rccLeaf ? native : walkingFrame(native, composer.fontStyle)
      }
      const target = mapped(slots[rccLeaf], unit, region)
      const origin = (rccLeaf ? '由' : '#(㇋乀)') + ' from ' + char
      parts.push({ ...placed(piece, piece.box, target, partInk(piece), origin), rccLeaf, fixed: true })
    }
  }
  return parts
}
