// Known constructs whose operands are one designed body, and characters whose body a font draws
// another way. A construct's body is a part record cut from the host glyph (han-compose's
// han-constructs.tsv), carried here so the browser composer needs no runtime cut; a construct with
// `contours` cuts the host glyph at drawing time, so it follows the export; a construct with
// `replace: 'top'` draws its first operand with the host's form of it; a construct with `draw` builds
// its parts from its hosts' glyphs. Outlines: Noto Sans CJK JP and its fallbacks, SIL OFL 1.1 / CC0.
import constants from './constants.json' with { type: 'json' }
import { centre, derived, fitted, mapped, partInk, partOf, placed, pointsBox, rings, union } from './geometry.js'
import { hexOf } from './sha256.js'


/**
 * The flesh form ⿵冂⺀: 冂 with two short slanting dots, as 兪 (⿱⿵入一⿰⿵冂⺀巜) draws its lower
 * left. Both parts come from glyphs every face draws at full size, so the form has the face's own
 * strokes at their own weight: the frame is its 冂, and the dots are 斗's two. `faces` names each
 * face by the digests of its 冂 and its 斗, with the contours of 斗 that are the dots, upper first.
 * An export drawing another 冂 or 斗 keeps the composer's own parts.
 *
 * The proportions are 兪's. The frame is `aspect` as wide as it is tall. The dots stand one above
 * the other, their centres `across` of the frame's width from its left and `heights` of its height
 * from its foot. `leg`, `slide` and `span` are how a frame is narrowed (`narrowed`).
 */
const FLESH = {
  frame: '冂',
  dots: '斗',
  faces: [
    // Noto Sans CJK JP.
    { frame: '48603871f396fef1e1f397eb0bf3cbe5d5d1fd43136db653c8cd2926e6e8b127',
      dots: '752e2007a0eb368d6c6133ea1179c9ca52de9606f0b798081cff58d47ca0b053', contours: [2, 3] },
    // Noto Serif CJK JP.
    { frame: '6e93dd63760a5f69f57b7d44645089d372acb81ec013beb49f13944c2990aba7',
      dots: 'f130606454c6fb3d9f071b9ac824915084da4682f30b0de059fd55be05574e26', contours: [0, 1] },
    // Zhuque Fangsong.
    { frame: '1540bc73b468535943737d402161078936ba09458e915935d0d5980e8f647576',
      dots: '285397283d5264531ba4133a51c70b7746daa7bf23d891a2df821fa92fc17c78', contours: [2, 1] },
    // The Kaisho export.
    { frame: '909af0cabf947cc9c4bddc13eccf8dadc5b9339cc1494e5c4141adf6afb70bff',
      dots: 'ce53c78da51036dd4d8929c0619245e2ed9b00ffa182896728024c875099e49d', contours: [1, 2] },
  ],
  aspect: 0.68,
  across: 0.48,
  heights: [0.68, 0.41],
  leg: 0.35,
  slide: 0.5,
  span: 0.8,
}

/** The bottom of 𱵺 (⿳𠆳𠚍禸): 𠚍禸, 离's lower body. */
const XIE_BOTTOM = {"b":[135.0,-69.0,872.0,538.0],"p":[["MLQ2LQ2","SATUBugEIAeoBcgGIAZkBoAFDAYQBXAGSATUBg==","U//6AP//awBMAFMA+QDw/+3/iv+w/6//wf+p/w=="],["MLQ2Q2LQ2Q2LQ2Q2Q2Q2Q2","0AScB3QF+AfABnQH4AfwBuAIhAeoCSwIiArsB6AJOAeYCJwGxAkMBsAKfAUUChAFHAmkBegHPAacBogFGAX4BNwEMAV0BGgF+AXwBTAHlAYYBhQH0AScBw==","O//xAPb/awA3AFkA+f9tAK//UADf/2sAMgEpAE8AsP8rAQkAQQBWABIBBAACAI7/vf+r/wMAk/86AKj/3/+Q/63/sf+k/hMAyP9ZAMH++v/I/6f/yv+m/w=="],["MLQ2LQ2","sAYQCEQHaAgACBQIhAi0B/AHVAd4B6wHsAYQCA==","Mv/uAPf/bQBHAFQA+QD7//v/iv+2/63/wf+p/w=="],["MLQ2LQ2","lAnIBjQKHAfwCsAGcAtYBtAKAAZgCmAGlAnIBg==","Rf/1AP7/bQBMAFIA+wDw/+7/i/+x/6//wP+q/w=="],["MLQ2LLQ2LQ2LQ2LQ2Q2Q2LQ2Q2Q2LLLLLQ2LLLLLQ2LQ2LLLLLLQ2LLQ3Q2Q2Q3","LAzQ/zQM0P90DND/dAwEAHQMcAIgB3AClAa4AQAGFAGYCVQBTAmwAfAIEALICVwC7ApAAYALSACUCvD/ZApEACgKmABEBkwApAU4AAQFIADkBBAA5AQUAMQEgACEBAQB4AQcAVAFrAGEBeQB6AVwAjwDcAI8A+z+HALs/hwCQAN0BkADqAaUA9gG7APsAuwD7ALcB/wD3Af8A8AERAjABNQHHAUUB4AFtAfMBWwIcAXwCAwFaAjABKQLwASkC9wHvAzcB7wM7AMgCOwD6AeUA7QHQAOgDUADoA0EAKANqP9gDTj/EA0g/3wM9P7UCvz+sApo/2wK0P8YC8z/+AvM/ywM0P8=","AAAVAQAAYQBz/2EAc/8AAHP/n/9GAJ//bQDC/1IBcQDl/lQAl//A/wP/KgAkAG8AbwA9ANAAzv/B/4j/if/M/7z/m/8OAKD/EwCg/ysAov9z/2P/c//y/3z/3f82/0AArv9VAJX/PwCT/z0A7v6f/40An/+NAJ//c/+f/3P/YQCy/2EAhv8xABP/n/9z/5//c/9hAI0AYQCNAGEAhf5dALL/r//E/gQAAgBsAEsAUwABAfT/hQFGAHP/YQBz/2EAjQBhAI0An/9NAJ//dwDM//0AYQCNAGEAjQAAAI0A5v9eAK7/KACj/xMAn/+a/6D/gP/V//j+ZQACAGEA+/9hAPX/YQA="]],"w":[71.66,51.79]}

/**
 * The glyphs 俞 (U+4FDE, ⿱亼⿰⺝刂) and 兪 (U+516A, ⿱⿵入一⿰⿵冂⺀巜) draw the two versions: 俞's
 * right half in this JP font is a flesh form with 刂, and 兪 pairs a flesh form with 巜. Each digest is the SHA-256 of that
 * glyph's outlines, so an export drawing another glyph keeps the composer's own parts.
 */
const YU_DIGESTS = {
  俞: '2f8ca6b4ea92ee80aa50d3ab72d8f8709dde4b00a5af553c803025a476fc9aef',
  兪: 'b0bef1b6e2a0f5eadf578075db74a73c2e6347b4d4c714e2c82ff114588a3950',
}

/** 兪's top: the 入 and the 一 it covers, contours 0–3 of 兪's glyph. */
const YU_IN_TOP = { host: '兪', label: '兪 top', contours: [0, 1, 2, 3], digest: YU_DIGESTS['兪'] }

/** 俞's top: 亼 as 俞's own glyph draws it, contours 0–1 of 俞's glyph. */
const YU_JI_TOP = { host: '俞', label: '俞 top', contours: [0, 1], digest: YU_DIGESTS['俞'] }

/** The JP 俞 contains flesh dots. Keep its frame and knife, then use ⺝'s actual bars. */
const YU_MONTH_ROW = [
  { host: '俞', label: '俞 月刂 frame', contours: [2, 3, 4, 7], digest: YU_DIGESTS['俞'] },
  { host: '⺝', label: '⺝ upper bar', contours: [1], box: [195, 229, 445, 292],
    digest: '7ba2ecdf2fe192c994f70f9a148cf1dc7624c34c97a1788f26651037ea8f35b7' },
  { host: '⺝', label: '⺝ lower bar', contours: [2], box: [195, 96, 445, 159],
    digest: '7ba2ecdf2fe192c994f70f9a148cf1dc7624c34c97a1788f26651037ea8f35b7' },
]

/** 兪's 肉 form: the 冂 and the two dots of ⺀, contours 4–7 of 兪's glyph. */
const YU_FLESH_BODY = { host: '兪', label: '兪 肉', contours: [4, 5, 6, 7], digest: YU_DIGESTS['兪'] }

/** 俞's 刂, kept where 俞 places it beside the body. */
const YU_JIAN = { host: '俞', label: '俞 刂', contours: [2, 4], digest: YU_DIGESTS['俞'] }

/**
 * 㓞 (U+345E, ⿰⿻三丨刀): the component as the font draws it, all seven contours. The 刀 of 㓞 tucks
 * its left stroke under the 丰's bars; a 刀 cut from another character and stretched into its band
 * has neither that width nor that height, and the pair then reads as two parts stood apart.
 */
const JIE = { host: '㓞', keep: 'whole', keepParts: 0, contours: [0, 1, 2, 3, 4, 5, 6],
  digest: '751eb13018db2212efc045350a45782cea85daa9acea6fd267fe3e02eee678d5' }

/** 𣱪's 气 frame: its three bars, slant and hook. The glyph's other 气 contour is 票's 示 bar,
 *  which belongs to the inside and is left out. */
const QI_FRAME = {
  b: [24, -52, 968, 841],
  p: [
    ['MLLQ2Q2Q3LQ2', 'WAZYC1gGVAqQAlQKAAK8CDABnAcAAcgHYAAoCCgBKAkoAsALZAIkDUgDAA0cAyAM4AJYCw==', 'cgBgAHIAoP9RAKD/ZgDT/xEAcP+7/7P/V//m/5z/MACR/xkAov9uAIcATwBvAOn/mQBgAA=='],
    ['MLLLLQ2Q2Q3Q2LQ2Q2Q2Q3LQ3Q2Q2', 'MAG4BTABwAYgBcAGaAXUBjgGoAYcBnQGEAZUBrwD2AJkA9gBOANYATgDmADIA2AAWAQsACwFLAAkDCwAQA0sALANgAAgDtgAKA6cAYAOeAEgD1wB+A4YALgNMP/4CzD/cAUw/7ADMP8gAggAHALUABwCQAFIAtgBnAL0AlgEuAU=', 'jv+g/47/YADw/2AA/v9jALUAPQBnANX/ZgDU/2cA1f9sAOH/cgDw/3IAQgAoAFoAFABgAAAAYAAAAGAA2v9gALv/TACQ/zAAlf+NACAAXQB/AE8AawDL/yUAoP8AAKD/AACg/+P/oP+P/8b/jv///47/DgCT/xsAl/8oADL/oP8='],
    ['MLLL', 'VAIUCFQCHAnYBRwJ2AUUCA==', 'jv+g/47/YAByAGAAcgCg/w=='],
  ],
}


/**
 * Constructs drawn only where the description is a surround's enclosing part. `⿳𠂉一乙` is the 气
 * frame of 𣱪 (⿺⿳𠂉一乙票) as a left-bottom surround. The standalone form below uses
 * 气’s first three strokes followed by an actual 乙 closing stroke.
 */
export const SURROUND_CONSTRUCTS = {
  '⿳𠂉一乙': { host: '𣱪', keep: 'frame', keepParts: 0, body: QI_FRAME },
}

export const CONSTRUCTS = {
  // Keep 气's 丿 and both upper bars; 乙 replaces only its closing stroke.
  // Apply at every depth so a side component has the same form as the standalone drawing.
  '⿳𠂉一乙': { host: '气', nested: true, cuts: [
    { host: '气', label: '气 first three strokes', contours: [0, 1, 3],
      digest: '22629c2788919f3c1b3471a77e9a1f8843583acd2fa8c0922d3703a030588d19' },
    { host: '乙', label: '乙 closing stroke', contours: [0, 1], box: [153.25, -78.75, 962.5, 447.75],
      digest: 'ad473c2c2cf293512d44377319d9421cfb26b8ca149417bebf81994b8a341679' },
  ] },
  '⿰⿻三丨刀': JIE,
  // ⿲𰀪丨⿱丶丶, 眔's lower half with 𰀪 and two dots, as the Kaisho export's 眔 draws it: its five
  // strokes stand apart (8 and 6 the 𰀪, 1 the stem, 7 and 5 the dots), one cut per leaf. The cuts
  // fill the description's place; alone, they stay where 眔 sets them.
  '⿲𰀪丨⿱丶丶': { host: '眔', nested: true, fill: true, cuts: [
    { host: '眔', label: '眔 𰀪', contours: [8, 6], digest: 'c64879c4a5b1ea6bab191c69549cfce19af842d496ddd279d505cd49f6b338f2' },
    { host: '眔', label: '眔 丨', contours: [1], digest: 'c64879c4a5b1ea6bab191c69549cfce19af842d496ddd279d505cd49f6b338f2' },
    { host: '眔', label: '眔 upper 丶', contours: [7], digest: 'c64879c4a5b1ea6bab191c69549cfce19af842d496ddd279d505cd49f6b338f2' },
    { host: '眔', label: '眔 lower 丶', contours: [5], digest: 'c64879c4a5b1ea6bab191c69549cfce19af842d496ddd279d505cd49f6b338f2' },
  ] },
  // The flesh form is a shape of 月, so a layout gives it the place it gives 月 (`like`).
  '⿵冂⺀': { host: FLESH.frame, hosts: [FLESH.frame, FLESH.dots], nested: true, like: '月', draw: fleshParts },
}

/** `contour` with each point of both masters moved by `move`.
 * @param {{ light: Float64Array, heavy: Float64Array }} contour @param {(x: number, y: number) => number[]} move */
const moved = (contour, move) => {
  /** @param {Float64Array} points */
  const at = points => {
    const out = new Float64Array(points.length)
    for (let i = 0; i < points.length; i += 2) [out[i], out[i + 1]] = move(points[i], points[i + 1])
    return out
  }
  return { ...contour, light: at(contour.light), heavy: at(contour.heavy) }
}

/**
 * A 冂 drawn `by` narrower with its strokes as wide as they were. The right leg and its hook slide
 * toward the left leg along the bar, which shortens over the opening between them and keeps its
 * slope. The opening is read below the frame's middle, in both masters, so it is open at every
 * weight: the left leg is what lies in the left `leg` of the width, and the opening runs from its
 * inner edge to the tip of the hook. The slide is spread over the middle `span` of the opening and
 * closes at most `slide` of it, so the hook stays clear of the left leg; what is left of `by` is
 * for the placement to scale.
 * @param {{ contours: any[], box: number[] }} frame @param {number} by
 */
function narrowed(frame, by) {
  const [x0, y0, x1, y1] = frame.box, legs = x0 + FLESH.leg * (x1 - x0), middle = (y0 + y1) / 2
  let inner = x0, tip = x1
  for (const { light, heavy } of frame.contours) for (const points of [light, heavy]) for (let i = 0; i < points.length; i += 2) {
    if (points[i + 1] > middle) continue
    if (points[i] < legs) inner = Math.max(inner, points[i])
    else tip = Math.min(tip, points[i])
  }
  const shift = Math.min(by, FLESH.slide * (tip - inner))
  if (!(shift > 0)) return frame
  const from = inner + (tip - inner) * (1 - FLESH.span) / 2, to = tip - (tip - inner) * (1 - FLESH.span) / 2
  const outline = rings(frame.contours, frame.contours.map(contour => contour.light))
  /** The bar's upper edge over `x`. @param {number} x */
  const top = x => {
    let y = -Infinity
    for (const ring of outline) for (let i = 0; i < ring.length; i += 2) {
      const j = (i + 2) % ring.length, ax = ring[i], bx = ring[j]
      if (ax !== bx && (ax - x) * (bx - x) <= 0) y = Math.max(y, ring[i + 1] + (ring[j + 1] - ring[i + 1]) * (x - ax) / (bx - ax))
    }
    return y
  }
  const rise = top(to) - top(from), slope = Number.isFinite(rise) ? rise / (to - from) : 0
  return derived(frame, frame.contours.map(contour => moved(contour, (x, y) => {
    const slid = shift * Math.min(1, Math.max(0, (x - from) / (to - from)))
    return [x - slid, y - slope * slid]
  })))
}

/**
 * The flesh form's two parts, the frame and the dots, one for each leaf. Alone it is as tall as the
 * face and keeps its proportions; in a character it takes the place it is given as a glyph of its
 * proportions would, within `STRETCH`. The frame is narrowed to the place's proportions before it
 * is scaled, so its strokes thin only as far as the place is smaller. The dots keep their own
 * proportions: they scale with the frame's width, or between its width and height where the place
 * is wider than the form. Empty where the export lacks a glyph or draws another 冂 or 斗.
 * @param {Record<string, { b: number[], p: any[] } | null> | null} records
 * @param {number[]} region
 * @param {boolean} atRoot
 */
function fleshParts(records, region, atRoot) {
  const frameRecord = records?.[FLESH.frame], dotsRecord = records?.[FLESH.dots]
  if (!frameRecord || !dotsRecord) return []
  const digests = [frameRecord, dotsRecord].map(record => hexOf(JSON.stringify(record.p)))
  const indices = FLESH.faces.find(face => face.frame === digests[0] && face.dots === digests[1])?.contours
  if (!indices) return []
  const glyph = partOf(frameRecord), donor = partOf(dotsRecord)
  const [x0, y0, x1, y1] = glyph.box, height = y1 - y0, width = FLESH.aspect * height
  const own = [(x0 + x1 - width) / 2, y0, (x0 + x1 + width) / 2, y1]
  const place = fitted(own, region, atRoot ? 1 : constants.STRETCH)
  const frame = narrowed(glyph, x1 - x0 - height * (place[2] - place[0]) / (place[3] - place[1]))
  const dots = derived(donor, indices.map((index, k) => {
    const contour = donor.contours[index], [cx, cy] = centre(pointsBox(contour.light))
    const dx = own[0] + FLESH.across * width - cx, dy = y0 + FLESH.heights[k] * height - cy
    return moved(contour, (x, y) => [x + dx, y + dy])
  }))
  const sx = (place[2] - place[0]) / width, sy = (place[3] - place[1]) / height
  const scale = Math.min(sx, Math.sqrt(sx * sy))
  const [cx, cy] = centre(mapped(dots.box, own, place))
  const w = (dots.box[2] - dots.box[0]) * scale / 2, h = (dots.box[3] - dots.box[1]) * scale / 2
  return [
    placed(frame, frame.box, place, partInk(glyph), `construct ${FLESH.frame}`),
    placed(dots, dots.box, [cx - w, cy - h, cx + w, cy + h], partInk(donor), `construct ${FLESH.dots} ⺀`),
  ]
}

/** The characters whose glyphs a construct is drawn from. @param {{ host: string, hosts?: string[], cuts?: { host: string }[] }} spec */
export const constructHosts = spec => new Set([spec.host, ...(spec.hosts ?? []), ...(spec.cuts ?? []).map(cut => cut.host)])

/** A construct's stored body drawn in `box`, or null where it has none.
 * @param {{ body?: any, host?: string, keep?: string } | null} spec @param {number[]} box */
export function constructBody(spec, box) {
  if (!spec?.body) return null
  const body = partOf(spec.body)
  return placed(body, body.box, box, 0, `construct ${spec.host} ${spec.keep}`)
}

/**
 * A construct's parts. A `cuts` entry draws the composition from its hosts' own outlines: each cut
 * names a glyph, the contours it keeps and the digest of that glyph, and the host's frame gives every
 * cut its place in the face, so the host's spacing between the top and the row holds. Another entry
 * keeps `keepParts` operands and fits a `body` (or the host's own `contours`) into the box the rest
 * filled. A digest names the outline a cut was made for; an export drawing another glyph keeps its
 * own parts. A `draw` entry builds its parts itself from the glyphs of its `hosts`.
 * @param {{ host: string, fill?: boolean, draw?: (records: Record<string, { b: number[], p: any[] } | null> | null, region: number[], atRoot: boolean) => any[], cuts?: { host: string, label: string, contours: number[], digest: string, box?: number[] }[], keep?: string, keepParts?: number, skipTail?: number, body?: any, contours?: number[], digest?: string }} spec
 * @param {any[]} out
 * @param {Record<string, { b: number[], p: any[] } | null> | null} [records] The glyphs the construct is drawn from.
 * @param {number[] | null} [face]
 * @param {boolean} [atRoot] Whether the construct is the whole character; a `fill` construct inside one fills `face`.
 */
export function constructParts(spec, out, records = null, face = null, atRoot = true) {
  if (spec.draw) return spec.draw(records, face ?? constants.face, atRoot)
  if (spec.cuts) {
    const host = records?.[spec.host]
    if (!host) return out
    const target = face ?? partOf(host).box
    /** @type {[{ label: string, box?: number[] }, any][]} */
    const pieces = []
    for (const cut of spec.cuts) {
      const record = records[cut.host]
      if (!record || hexOf(JSON.stringify(record.p)) !== cut.digest) return out
      const source = partOf(record)
      pieces.push([cut, derived(source, (cut.contours ?? []).map(i => source.contours[i]))])
    }
    // A `fill` construct is part of a character: inside one its cuts fill the place they are given.
    const frame = spec.fill && !atRoot ? union(pieces.map(([cut, piece]) => cut.box ?? piece.box)) : partOf(host).box
    const parts = pieces.map(([cut, piece]) => placed(piece, piece.box, mapped(cut.box ?? piece.box, frame, target), 0, `construct ${cut.label}`))
    // A `keepParts` entry replaces that many drawn parts with the cuts and leaves the rest.
    if (!spec.keepParts) return parts
    const kept = out.slice(spec.keepParts)
    // `skipTail` names parts the host's own cut already draws.
    return [...parts, ...(spec.skipTail ? kept.slice(0, kept.length - spec.skipTail) : kept)]
  }
  const at = spec.keepParts ?? 0
  const kept = out.slice(0, at)
  const rest = out.slice(at)
  if (!rest.length) return out
  const record = records?.[spec.host]
  if (!spec.body && !record) return out
  // A stored cut names the outline it was made for: another export keeps its own drawing.
  if (!spec.body && spec.digest && (!record || hexOf(JSON.stringify(record.p)) !== spec.digest)) return out
  const body = spec.body ? partOf(spec.body)
    : (() => {
        const glyph = partOf(record), contours = (spec.contours ?? []).map(i => glyph.contours[i]).filter(Boolean)
        if (!contours.length) return null
        return derived(glyph, contours, union(contours.map(contour => pointsBox(contour.light))))
      })()
  if (!body) return out
  const box = [
    Math.min(...rest.map(p => p.target[0])), Math.min(...rest.map(p => p.target[1])),
    Math.max(...rest.map(p => p.target[2])), Math.max(...rest.map(p => p.target[3])),
  ]
  return [...kept, placed(body, body.box, box, 0, `construct ${spec.host} ${spec.keep}`)]
}

/**
 * A character whose font glyph draws its body another way: 囪's inside is written 夕-like, and Noto
 * Sans CJK JP draws it as 乂. Its frame, ㇒ and lower bar (contours 0–2) are kept and the 夕 of 囱
 * (contours 0–3) is set in their place. The digests name the outlines the cuts were made for: an
 * export of another font or style keeps the glyph it draws.
 */
export const BODY_FORMS = {
  '囪': {
    host: '囱',
    keep: { 'f3b630d190dd20c70130b2b037955a13dc05833fc5f72ddc3a059dac1beee9b2': [0, 1, 2] },
    body: { '2e76d4d2c8063f3277e1ba9bacba05ff555239d79aa05ab9a8d3979569d0933c': [0, 1, 2, 3] },
  },
}

/**
 * A description the font draws from an ideographic variation sequence. 者 U+8005 + VS18 U+E0101 is
 * the dotted 者 in Noto Sans CJK JP 2.004 (NotoSansCJK-Regular.ttc, sha256 b76b0433…) and Noto
 * Serif CJK JP 2.002 (NotoSerifCJK-Regular.ttc, sha256 93069d8e…); VS1 U+FE00 selects the same
 * glyph, and U+FA5B draws it too. The outlines below are that sequence's, not the plain 者's.
 * `digest` is the SHA-256 of the export's own 者 glyph, so an export of another font or style keeps
 * the composer's drawing.
 */
export const IVD_FORMS = {
  '⿻者丶': {
    base: '者',
    label: '者 U+E0101',
    sequence: '者\u{E0101}',
    forms: {
      sans: {
        font: 'Noto Sans CJK JP 2.004',
        digest: 'e735d8c416d947ebe873f00a8277d10b34600cb12322ae8fa5ceb2ee6fd4ea8b',
        body: {"b":[32,-80,950,840],"p":[["MQ2Q2LLLLLLLLLLLLQ2Q2Q2Q2Q2Q2Q2LLLLLLLLLQ2Q2Q2LQ2Q2Q2LQ2Q2LLLQ2Q2","FA2YDKsMDgw4DIgLxgsCC0gLhApICygLZAcoC2QHIA08BiANPAYoCzgCKAs4AiAKPAYgCjwGQAjMAEAIzAA0BzQHNAerBTIG+gNfBUgCjASAAPADngDQA8MAoQPoAHIDCgFDAywBFANAAfQC+gE8A7MCiwNsA9oDIAQ0BCAEwP5MBcD+TAVE/6gLRP+oC9D+3AzQ/twMZAWsC2QFHAzgBdgLFAZxC08GCQuKBpUKwAYgCvYGtAkcByQJhAZ+CWAG4QkwBkQKAAagCssF/AqWBUALZAVYBmQFDwfQBcAHQwZwCLYGGAk0B9gONAfYDkAIbApACHQLGwlgDA4KSw0BCxQODAw=","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="],["MLLQ2","ZAdACGQHIArkCiAK3AkkCbAIQAg=","AAAAAAAAAAAAAAAAAAAAAAAAAAA="],["MLLL","TAXoAagL6AGoC0gATAVIAA==","AAAAAAAAAAAAAAAAAAAAAA=="],["MLLL","TAXYAkwFZASoC2QEqAvYAg==","AAAAAAAAAAAAAAAAAAAAAA=="]]},
      },
      serif: {
        font: 'Noto Serif CJK JP 2.002',
        digest: 'bb54b23a604baa92944b75b214089e4e51d01bc26b0474f0bcf229741643e795',
        body: {"b":[26,-78,956,838],"p":[["MLQ2Q2LQ2Q2LLQ2Q2Q2LLLLQ2Q2Q2LQ2Q2LLLQ2Q2LQ2Q2Q2Q2Q2Q2Q2Q2Q2LLQ2Q2Q2Q2Q2LLQ2Q2Q2Q2LQ2Q2Q2Q2Q2Q2LLLQ2Q2LLLLLLLLLQ2L","XARoBVwEXAVmA8kEaAJGBGoBxANoAFgDiAAYA4QBbwN6AtYDbwM+BFwEsARcBMj+hATI/roEyP7sBNj+HQXo/jwF/f5cBRL/XAUg/1wFxP+EC8T/hAvo/qwL6P7WC+j+CQz5/jsMCv9hDB//hgw0/4gMQP+IDMAExwzMBPMM4gQfDfgENA0QBewLCAZcC2gFvAVoBZQG3QVeB1wGJwjbBuQIXAfMCEQHEgkYB1gJ1gaeCZQG1QlJBgwK/gUkCrgFZAqVBZcKogXLCq4F5graBQELBgb4CkIG8Ap+BroKuwaECvgGFgooB6cJVwf0CGgHPAmcB4QOnAffDpwH8A7cB7wOCgh9Dj4IPw5xCAgOngjQDcwIrA3oCIgNBAmIDQQJxAwQCNwJEAj8CugI7gvGCd8MowqcDXgL4Q1aCwUOXgspDmELRA58C+wMjAySDBcMKgyiC8ELLAtMC7QKHAveCugKCQuzCjQLhgpYC1kKfAs8CpILIAqoCyAKqAtkCbwKXAe8ClwHiAyhB5QMvgeuDNoHyQzgB/AMVAYYDVQGvAoEArwKJAJIClQGSApUBhAIsAAQCNQAnAe8B5wHZAaYBuAErAVcBOgF","AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"],["MLQ2L","XAdICuAKSAq2CSQJVAgQCFwHEAg=","AAAAAAAAAAAAAAAAAAAAAAAAAAA="],["MLLL","hAv0BIQL6AJcBegCXAX0BA==","AAAAAAAAAAAAAAAAAAAAAA=="],["MLLL","XAV0AoQLdAKECzgAXAU4AA==","AAAAAAAAAAAAAAAAAAAAAA=="]]},
      },
    },
  },
}

/**
 * `text` drawn from the variation sequence its font draws it as: one part at the font's own em when
 * `atRoot`, or in `region` when nested. Null where the style has no form, or the export's `base`
 * glyph is not the one the outline was read against, so the composer draws its own parts instead.
 * @param {{ base: string, label: string, sequence: string, forms: Record<string, { font: string, digest: string, body: any }> }} spec
 * @param {string} text
 * @param {{ p: any[] } | null} record
 * @param {string} style
 * @param {number[]} region
 * @param {boolean} atRoot
 */
export function ivdParts(spec, text, record, style, region, atRoot) {
  const form = spec.forms[style]
  if (!form || !record || hexOf(JSON.stringify(record.p)) !== form.digest) return null
  const part = partOf(form.body)
  const target = atRoot ? part.box.slice() : region
  return [{ ...placed(part, part.box, target, partInk(part), `IVS ${spec.label} (${form.font}): ${text}`), fixed: true }]
}

/**
 * A contour of `from` carried into `into`, its light and heavy masters alike.
 * @param {{ light: Float64Array, heavy: Float64Array }} contour
 * @param {number[]} from
 * @param {number[]} into
 */
function carried(contour, from, into) {
  const sx = (into[2] - into[0]) / Math.max(from[2] - from[0], 1)
  const sy = (into[3] - into[1]) / Math.max(from[3] - from[1], 1)
  const light = new Float64Array(contour.light.length), heavy = new Float64Array(contour.heavy.length)
  for (let i = 0; i < light.length; i += 2) {
    light[i] = into[0] + (contour.light[i] - from[0]) * sx
    light[i + 1] = into[1] + (contour.light[i + 1] - from[1]) * sy
    heavy[i] = into[0] + (contour.heavy[i] - from[0]) * sx
    heavy[i + 1] = into[1] + (contour.heavy[i + 1] - from[1]) * sy
  }
  return { ...contour, light, heavy }
}

/**
 * `record` drawn with the body of `host`: its own `keep` contours and the `body` contours of the
 * host, carried into its box. Null when either glyph is not the one the cut was made for.
 * @param {{ p: any[] }} record
 * @param {{ p: any[] } | null} host
 * @param {{ host: string, keep: Record<string, number[]>, body: Record<string, number[]> }} spec
 */
export function bodyForm(record, host, spec) {
  if (!record || !host) return null
  const keep = spec.keep[hexOf(JSON.stringify(record.p))]
  const body = spec.body[hexOf(JSON.stringify(host.p))]
  if (!keep || !body) return null
  const frame = partOf(record), source = partOf(host)
  return derived(frame, [
    ...keep.map(i => frame.contours[i]),
    ...body.map(i => carried(source.contours[i], source.box, frame.box)),
  ], frame.box)
}

/** Join the bundled 𰀉冖木 form's wood to the roof underside. The source cut left
 * the space occupied by the holders' enclosed body between 冖 and 木.
 * @param {string} text @param {string} style @param {any[]} parts @returns {any[]} */
export function joinedComponentForm(text, style, parts) {
  if (text !== '⿳𰀉冖木' || style !== 'sans' || parts.length !== 1) return parts
  const body = parts[0]
  if (body.contours.length !== 4) return parts
  const wood = body.contours[3], box = pointsBox(wood.light)
  // Lift the wood's bar and branches without thickening them. Extend only the
  // central stem slightly into the roof, keeping its foot at y-79. A shared
  // boundary can leave an antialiased white seam when the form is scaled down.
  /** @param {Float64Array} points */
  const map = points => Float64Array.from(points, (value, i) => i % 2
    ? value === box[1] ? value : value === box[3] ? 489 : value + 120 : value)
  const contours = [...body.contours.slice(0, 3), { ...wood, light: map(wood.light), heavy: map(wood.heavy ?? wood.light) }]
  return [derived(body, contours, body.box)]
}
