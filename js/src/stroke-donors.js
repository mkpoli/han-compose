import native from './stroke-native-records.json' with { type: 'json' }
import cuts from './stroke-donor-cuts.json' with { type: 'json' }
import { derived, makePart, partOf, pointsBox, rings, segments, wound } from './geometry.js'
import { hexOf } from './sha256.js'
import { chainForm } from './stroke-chain.js'

/**
 * @typedef {{ ops: [string, number, boolean][], light: Float64Array, heavy: Float64Array, width: number[] | null }} OutlineContour
 * @typedef {{ contours: OutlineContour[], box: number[], reverse?: boolean }} OutlinePart
 * @typedef {{ b: number[], p: string[][], v: number, w?: number[] }} StrokeRecord
 * @typedef {{ index: number, segments: number[][] }} BoundaryRanges
 * @typedef {{ host: string, digest: string, contours: number[], ranges?: BoundaryRanges }} StrokeCut
 * @typedef {[string, number[][]]} OutlineSegment
 */
/** @template T @typedef {Record<string, Record<string, T> | undefined>} FaceTable */

/** @type {FaceTable<StrokeRecord>} */
const nativeRecords = native.records
/** @type {FaceTable<string>} */
const aliases = native.aliases
/** @type {FaceTable<StrokeCut>} */
const strokeCuts = cuts.styles

// The four corners of the faces' ideographic zero, from their pinned primary fonts.
const quadrants = new Map([['◝', [1, 1]], ['◞', [1, -1]], ['◟', [-1, -1]], ['◜', [-1, 1]]])
/** @type {Map<string, OutlinePart & { strokeSource: string }>} */
const roundStrokes = new Map()
const digests = new WeakMap()

/** @param {string} char @param {string} style */
export function strokeDonor(char, style) {
  if (nativeRecords[style]?.['〇'] && quadrants.has(char)) return '〇'
  return strokeCuts[style]?.[char]?.host ?? aliases[style]?.[char]
}

// Sample the native curves densely, then clip both masters on the axes through
// their cardinal extrema. Opposite-winding counter and outer polygons stay paired.
/** @param {number[][]} vertices @param {0 | 1} axis @param {number} sign @param {number[]} centres */
function clip(vertices, axis, sign, centres) {
  if (!vertices.length) return []
  const out = []
  let before = vertices[vertices.length - 1]
  for (const after of vertices) {
    const a = sign * (before[axis] - centres[0])
    const b = sign * (after[axis] - centres[0])
    if ((a >= 0) !== (b >= 0)) {
      const ah = before[2 + axis] - centres[1]
      const bh = after[2 + axis] - centres[1]
      const lightAt = a / (a - b)
      const heavyAt = ah * bh < 0 ? ah / (ah - bh) : lightAt
      const vertex = before.map((value, i) => value + (after[i] - value) * (i < 2 ? lightAt : heavyAt))
      vertex[axis] = centres[0]
      vertex[2 + axis] = centres[1]
      out.push(vertex)
    }
    if (b >= 0) out.push(after)
    before = after
  }
  return out
}

/** @param {OutlinePart} part @param {number[]} sides */
function quarter(part, sides) {
  /** @type {number[][]} */
  const light = rings(part.contours, part.contours.map(c => c.light), 12)
  /** @type {number[][]} */
  const heavy = rings(part.contours, part.contours.map(c => c.heavy), 12)
  const boxes = [light, heavy].map(paths => pointsBox(paths.flat()))
  /** @param {0 | 1} axis */
  const centre = axis => boxes.map(box => (box[axis] + box[2 + axis]) / 2)
  const contours = light.flatMap((ring, j) => {
    const vertices = []
    for (let i = 0; i < ring.length; i += 2) {
      vertices.push([ring[i], ring[i + 1], heavy[j][i], heavy[j][i + 1]])
    }
    const kept = clip(clip(vertices, 0, sides[0], centre(0)), 1, sides[1], centre(1))
    if (kept.length < 3) return []
    return [{
      ops: kept.map((_, i) => [i ? 'L' : 'M', 1, false]),
      light: Float64Array.from(kept.flatMap(p => p.slice(0, 2))),
      heavy: Float64Array.from(kept.flatMap(p => p.slice(2))),
      width: part.contours[0].width,
    }]
  })
  return derived(part, contours)
}

// At a joined stroke, keep the verified runs of on-curve boundaries and
// reconnect them by a straight segment across the omitted ink.
/**
 * @param {OutlineContour[]} contours
 * @param {number[][]} runs
 * @returns {OutlineContour}
 */
export function reconnectStroke(contours, runs) {
  /** @param {'light' | 'heavy'} master @returns {OutlineSegment[]} */
  const outline = master => runs.flatMap(([index, first, last], i) => {
    const contour = contours[index]
    const path = /** @type {OutlineSegment[]} */ (segments(contour.ops, contour[master]))
    const endpoint = path[first][1]
    /** @type {OutlineSegment} */
    const begin = [i ? 'L' : 'M', [endpoint[endpoint.length - 1]]]
    return [begin, ...path.slice(first + 1, last + 1)]
  })
  const light = outline('light')
  return {
    ops: light.map(([op, points]) => [op, points.length, false]),
    light: Float64Array.from(light.flatMap(([, points]) => points.flat())),
    heavy: Float64Array.from(outline('heavy').flatMap(([, points]) => points.flat())),
    width: contours[runs[0][0]].width,
  }
}

// The callback supplies only allowed records. For bundled strokes and 〇,
// the caller applies its exclusion policy to the returned stroke donor key.
/** @param {string} char @param {string} style @param {(char: string) => StrokeRecord | null | undefined} [recordOf] */
export function nativeStroke(char, style, recordOf = () => null) {
  const own = nativeRecords[style]
  if (own?.[char]) {
    const source = aliases[style]?.[char] ?? char
    return { ...partOf(own[char]), strokeSource: source }
  }
  const sides = quadrants.get(char)
  if (sides && own?.['〇']) {
    const key = style + char
    if (!roundStrokes.has(key)) {
      const part = quarter(partOf(own['〇']), sides)
      roundStrokes.set(key, { ...part, strokeSource: '〇' })
    }
    return roundStrokes.get(key) ?? null
  }

  const cut = strokeCuts[style]?.[char]
  if (!cut) return null
  const record = recordOf(cut.host)
  if (record?.v !== 1 || !Array.isArray(record.p)) return null
  if (!digests.has(record)) digests.set(record, hexOf(JSON.stringify(record.p)))
  if (digests.get(record) !== cut.digest) return null
  /** @type {OutlinePart} */
  const part = partOf(record)
  const contours = cut.contours.map(index => part.contours[index])
  if (cut.ranges) {
    const { index, segments } = cut.ranges
    contours.push(reconnectStroke(part.contours, segments.map(([start, end, source = index]) => [source, start, end])))
  }
  return { ...derived(part, contours), strokeSource: cut.host }
}


// Unicode 18.0 Appendix F, Table F-1, and the Bai stroke alphabet identify
// these directions and turns. The pieces still come from the selected face.
// https://www.unicode.org/versions/Unicode18.0.0/core-spec/appendix-f/
// https://nightfurysl2001.github.io/bai-ids/#5-%E7%AC%94%E7%94%BB%E4%B8%B2
/** @type {FaceTable<string>} */
const reconstructions = {
  fangsong: {
    乁: '#(一乀)',
    𠃋: '#(丿一)',
    𠄎: '#(一㇉)',
  },
  regular: {
    𠄎: '#(一㇉)',
  },
}
/** @type {Record<string, string | undefined>} */
const reflectedStrokes = { '㇘': '㇄', '㇢': '㇁' }

/** @param {OutlinePart} donor @param {number} slant */
function reflectedCut(donor, slant) {
  /** @param {Float64Array} points */
  const reflect = points => Float64Array.from(points, (value, i) =>
    i % 2 ? value : donor.box[0] + donor.box[2] - value + slant * (points[i + 1] - donor.box[1]))
  return wound(makePart(donor.contours.map(c => ({
    ...c,
    light: reflect(c.light),
    heavy: reflect(c.heavy),
  }))))
}

/** @param {string} char @param {string} style @param {(char: string) => OutlinePart | null | undefined} glyphOf */
export function reconstructStroke(char, style, glyphOf) {
  const recipe = reconstructions[style]?.[char]
  if (recipe) {
    const reconstructed = chainForm(recipe, glyphOf)
    if (!reconstructed) return null
    const part = wound(makePart(reconstructed.parts.flatMap(piece => piece.contours)))
    return { ...part, strokeSource: `reconstructed ${char} from ${recipe}` }
  }

  const reflected = style === 'fangsong' ? reflectedStrokes[char] : null
  const donor = reflected ? glyphOf(reflected) : null
  if (!donor) return null
  // The 撇 in ㇢ slopes to the left on its way down.
  return { ...reflectedCut(donor, char === '㇢' ? 0.5 : 0), strokeSource: `reconstructed ${char} from ${reflected}` }
}
