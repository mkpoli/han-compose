// Known constructs whose operands are one designed body, and characters whose body a font draws
// another way. A construct's body is a part record cut from the host glyph (han-compose's
// han-constructs.tsv), carried here so the browser composer needs no runtime cut; a construct with
// `contours` cuts the host glyph at drawing time, so it follows the export; a construct with
// `replace: 'top'` draws its first operand with the host's form of it. Outlines: Noto Sans CJK JP
// and its fallbacks, SIL OFL 1.1 / CC0.
import { derived, mapped, partInk, partOf, placed, pointsBox, union } from './geometry.js'
import { hexOf } from './sha256.js'


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
}

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
 * own parts.
 * @param {{ host: string, cuts?: { host: string, label: string, contours: number[], digest: string, box?: number[] }[], keep?: string, keepParts?: number, skipTail?: number, body?: any, contours?: number[], digest?: string }} spec
 * @param {any[]} out
 * @param {Record<string, { b: number[], p: any[] } | null> | null} [records] The glyphs the cuts name.
 * @param {number[] | null} [face]
 */
export function constructParts(spec, out, records = null, face = null) {
  if (spec.cuts) {
    const host = records?.[spec.host]
    if (!host) return out
    const frame = partOf(host), target = face ?? frame.box
    const parts = []
    for (const cut of spec.cuts) {
      const record = records[cut.host]
      if (!record || hexOf(JSON.stringify(record.p)) !== cut.digest) return out
      const source = partOf(record)
      const piece = derived(source, (cut.contours ?? []).map(i => source.contours[i]))
      parts.push(placed(piece, piece.box, mapped(cut.box ?? piece.box, frame.box, target), 0, `construct ${cut.label}`))
    }
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
