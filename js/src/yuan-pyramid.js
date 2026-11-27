// @ts-nocheck
import { contourSections, derived, drawnContours, groupRings, makePart, mapped, partInk, partOf, placed, pointsBox, union } from './geometry.js'
import { hexOf } from './sha256.js'

const expanded = '⿳白小⿰⿱白小⿱白小'
const grouped = '⿱⿱白小⿰⿱白小⿱白小'
const unit = [0, 0, 1, 1]
// Main's visible ink bounds for the enclosed and standalone IDS in each export.
// For the missing Pen literal, use its drawable expanded spelling.
const faces = {
  fangsong: { digest: 'd7cdc4e802fcf34bd5c3abd76c2dd908587646967cec42d39c8ad41552da3c2b',
    enclosed: [30, -77.6, 880, 767.7], inner: [47.8, -110, 954.2, 807.3],
    groupedEnclosed: [30.9, -85.5, 894.8, 762], groupedInner: [95.4, -103.3, 906.9, 798.7] },
  'pen-writing': { digest: '735b264cf90cd11213668d00c1750b9892066df257c62575be3a36e870aeb33d',
    enclosed: [38.2, -63.5, 874.8, 754.7], inner: [52.9, -89.4, 947.2, 813.4],
    groupedEnclosed: [38.2, -63.5, 874.8, 754.7], groupedInner: [64.5, -86.8, 949, 797.7] },
}

const encoded = {
  sans: { digest: '265b41d9c34f6df9803deb35bcb60c79e090b55b7dac28605f1fa979e15c0435',
    enclosed: [33, -80.7, 951.9, 796.5], inner: [40.7, -92.1, 965.3, 851.4],
    groupedEnclosed: [31.2, -78.7, 948.4, 795.7], groupedInner: [44.8, -89, 969.3, 821.9] },
  regular: { digest: '04a5aa68d4ac68d4e9f9a3ba91d78abe33e8adc0c8febc265361b35ce190b628',
    enclosed: [109, 31.2, 840.5, 787.6], inner: [89.4, -56.1, 914.5, 799.9],
    groupedEnclosed: [116.9, 30.2, 801.9, 762.1], groupedInner: [89.4, -40.7, 914.6, 784.5] },
}
export const yuanReference = '⿸厂𤿁'

export function usesYuan(key, style) {
  if (!faces[style] && !encoded[style]) return false
  const inner = key.startsWith('⿸厂') ? key.slice(2) : key
  return (Boolean(faces[style]) && inner === '𤿁') || inner === expanded || inner === grouped
}

// Keep the contact between the base of 白 and the hook of 小. FangSong also
// has a contact between the initial slash of 白 and the underside of 厂.
function yuanContours(donor, style) {
  const c = donor.contours
  if (style === 'fangsong') return [
    [contourSections(c, [3, 0, 25], [3, 86, 96])],
    [contourSections(c, [3, 25, 49], [3, 70, 86]), c[2]],
    [contourSections(c, [3, 49, 70]), c[0], c[1]],
  ]
  return [[c[0]], [contourSections(c, [1, 9, 35], [1, 0, 0]), c[2], c[3]],
    [contourSections(c, [1, 0, 9]), c[4], c[5]]]
}

function asOneLeaf(parts) {
  const contours = parts.flatMap(p => {
    const outline = drawnContours(p)
    return p.part.contours.map((c, i) => ({ ...c, light: outline[i], heavy: outline[i] }))
  })
  const body = makePart(contours, undefined, parts[0].part.reverse)
  return { ...placed(body, body.box, body.box, partInk(body), '𤿁 from 原'), fixed: true }
}

// Each glyph has three 白 outlines whose bottom edge continues into the hook of 小.
// A split follows the two junctions of the hook, retaining the counters and side dots.
function encodedContours(c, style) {
  if (style === 'sans') {
    const split = (host, counters, dots) => [
      [contourSections(c, [host, 2, 11]), ...counters.map(i => c[i])],
      [contourSections(c, [host, 11, c[host].ops.length - 1], [host, 0, 2]), ...dots.map(i => c[i])],
    ]
    return [...split(8, [5, 6], [1, 13]), ...split(4, [2, 3], [0, 7]), ...split(12, [10, 11], [9, 14])]
  }
  const split = (host, start, end, dots) => [
    [contourSections(c, [host, 0, start], [host, end, c[host].ops.length - 1]), c[host + 1], c[host + 2]],
    [contourSections(c, [host, start, end]), ...dots.map(i => c[i])],
  ]
  return [...split(0, 17, 32, [13, 14]), ...split(3, 16, 32, [9, 10]), ...split(6, 16, 33, [11, 12])]
}

function fitInk(pieces, face, key, fullFace, region) {
  const enclosed = key.startsWith('⿸厂'), nested = key.endsWith(grouped)
  const footprint = enclosed ? (nested ? face.groupedEnclosed : face.enclosed) : (nested ? face.groupedInner : face.inner)
  const frame = mapped(footprint, fullFace, region)
  const ink = union(groupRings(pieces, 24).map(pointsBox))
  for (const part of pieces) part.target = mapped(part.target, ink, frame)
}

function encodedParts(composer, key, region, measure) {
  const style = composer.fontStyle, face = encoded[style], record = composer.glyphRecord('𤿁')
  if (!record || hexOf(JSON.stringify(record.p)) !== face.digest) return null
  const enclosed = key.startsWith('⿸厂')
  const ref = measure(enclosed ? yuanReference : '𤿁')
  if (!ref || ref.length !== (enclosed ? 2 : 1)) return null
  const source = ref.at(-1)
  if (source.origin !== 'glyph 𤿁' || source.part !== partOf(record)) return null
  const weight = style === 'sans' ? [source.weight[0], Math.min(source.weight[1], .2)] : source.weight
  const pieces = encodedContours(source.part.contours, style).map((contours, i) => {
    const p = derived(source.part, contours)
    return { ...placed(p, p.box, mapped(p.box, source.source, source.target), source.native,
      (i % 2 ? '小' : '白') + ' from 𤿁', weight), fixed: true }
  })
  if (enclosed) pieces.unshift({ ...ref[0], fixed: true })
  fitInk(pieces, face, key, composer.C.face, region)
  return pieces
}

export function yuanParts(composer, key, region, measure) {
  const style = composer.fontStyle
  if (!usesYuan(key, style) || ['原', '白', '小', '𤿁'].some(ch => composer.excluded(ch))) return null
  const enclosed = key.startsWith('⿸厂'), literal = key.endsWith('𤿁')
  if ((enclosed && composer.excluded('厂')) || (literal && composer.own('𤿁'))) return null
  if (encoded[style]) return encodedParts(composer, key, region, measure)
  const record = composer.glyphRecord('原'), face = faces[style]
  if (!record || hexOf(JSON.stringify(record.p)) !== face.digest) return null
  const donor = partOf(record)
  const [shell, white, small] = yuanContours(donor, style).map(contours => derived(donor, contours))
  const pair = derived(donor, [...white.contours, ...small.contours])
  const fit = (part, box, name) => placed(part, part.box, box, partInk(donor), name + ' from 原')
  const outer = fit(shell, mapped(shell.box, donor.box, composer.face), '厂')
  const body = enclosed ? mapped([.235, 0, 1, .885], unit, composer.face) : composer.face
  // The upper 小 occupies the notch between the two lower 白 heads, as in 𤿁.
  const cells = [[.17, .505, .855, 1], [0, 0, .476, .48], [.524, .005, 1, .485]]
  const pairs = cells.map(box => fit(pair, mapped(box, unit, body), '白小'))
  if (composer.staticFace && !composer.partial) composer.staticBalance(enclosed ? [outer, ...pairs] : pairs)
  const inside = pairs.flatMap(p => [white, small].map((part, i) => ({
    ...fit(part, mapped(part.box, pair.box, p.target), i === 0 ? '白' : '小'), weight: p.weight, fixed: true,
  })))
  outer.fixed = true
  const pieces = enclosed ? [outer, ...inside] : inside
  fitInk(pieces, face, key, composer.C.face, region)
  if (!literal) return pieces
  const inner = asOneLeaf(inside)
  return enclosed ? [outer, inner] : [inner]
}
