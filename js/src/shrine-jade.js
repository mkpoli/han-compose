// @ts-nocheck
import { cutContours, derived, fitted, mapped, partInk, partOf, placed, union } from './geometry.js'
import { hexOf } from './sha256.js'

// R+07AB (https://rare.glyphatlas.org/ja/entry/1963), Mika-jinja (Misato, Saitama)
// hanging plaque (Taisuke.Kasuya, CC BY-SA 4.0,
// https://commons.wikimedia.org/wiki/File:Mika-jinja(Misato,Saitama)_Hengaku.jpg).
// Assembles ⿱艹⿺夌玉 using each face's standard 艹, the upper ⿱土儿 of 夌
// (or 土八 of 菱 in Zhuque Fangsong), the native enclosing 夂 from 麩 (or 处
// in Zhuque Fangsong), and weight-balanced 玉.
// Related encoded forms 𦼆 (⿱艹⿺麦玉) and 𭐨 (⿺夌主) show the same enclosing structure.

const faces = {
  sans: {
    grass: [62, 637, 941, 840],
    top: { host: '夌', contours: [0, 1, 2, 7, 8], digest: '2af35d6a2656cd6734dd76098369a88f1b5668a597c8fa22f452db9f39c4e424', box: [42, 344, 502, 610], weight: [0.75, 0.65] },
    foot: { host: '麩', contours: [1, 2, 4, 5], digest: '8464a5a2fc2961cb055948720a383d8133f8d370d4fef13517b5eb9270f3c5af' },
    jade: [530, 64, 954, 610],
  },
  serif: {
    grass: [44, 638, 957, 837],
    top: { host: '夌', contours: [0, 1, 2, 3, 8], digest: '7aaa7594c18c9954eebb712bd3978c012a5f27170b943747394b6011b8c282fc', box: [42, 346, 500, 616], weight: [0.68, 0.58] },
    foot: { host: '麩', contours: [0, 2, 3, 4], digest: '72b60f366601a89859ea72d8db3f8e8eede58145a2d1d4c451ec1b167dd13ee6' },
    jade: [528, 66, 954, 618],
  },
  fangsong: {
    grass: [91, 584, 904, 828],
    top: { host: '菱', contours: [1, 2], digest: 'ffa4c57a60cd3e2b446539cfc7e5f6241f4a8555b76c93803b8600f8efbf9dd3', box: [52, 344, 522, 582] },
    foot: { host: '处', contours: [0, 2], digest: '9f0a3965c175b4ecde5b44b6626b47f2f9241831bc1fbf350e15ba8ce2a3cdd9', box: [42, -92, 955, 368] },
    jade: [536, 68, 944, 588],
    fixedWeight: true,
  },
  regular: {
    grass: [183, 602, 807, 816],
    top: { host: '夌', contours: [2], digest: '7f629b89013b0cd88c04391d2094c0a8d89fdb2ab49bc76a2c7692c3e8a8dda8', box: [82, 320, 496, 588] },
    foot: { host: '麩', contours: [2, 3], digest: 'ca020e2bccaf46e5af2703ab49491ce821a4d70a2ec639eb8d023cc5a2bf8aa4' },
    jade: [526, 96, 940, 592],
    fixedWeight: true,
  },
  'pen-writing': {
    grass: [108, 594, 890, 824],
    top: { host: '夌', contours: [0], digest: '1f6225db987f9a178fc4d8979c113c9bde1850d3360a70b5d84388e6abe98272', box: [70, 314, 504, 582] },
    foot: { host: '麩', contours: [4, 5], digest: 'e40d346a612d9fc4b2f765d53aaef201eaa0f95edfa4e159b5534aec6132ca1f' },
    jade: [528, 82, 944, 582],
    fixedWeight: true,
  },
}

const digests = new WeakMap()

function recordDigest(rec) {
  let d = digests.get(rec)
  if (!d) { d = hexOf(JSON.stringify(rec.p)); digests.set(rec, d) }
  return d
}

export function isShrineJade(node) {
  return Array.isArray(node) && !node.note && node[0] === '⿱' && node[1] === '艹' &&
    Array.isArray(node[2]) && !node[2].note && node[2][0] === '⿺' && node[2][1] === '夌' && node[2][2] === '玉'
}

export function shrineJadeSources(style) {
  const spec = faces[style]
  return spec ? [spec.top.host, spec.foot.host, '玉'] : []
}

function pinnedCut(composer, entry) {
  const rec = composer.glyphRecord(entry.host)
  if (rec?.v !== 1 || rec.f || rec.k || recordDigest(rec) !== entry.digest) return null
  return cutContours(partOf(rec), entry.contours)
}

function fitContours(part, target, weight = null) {
  if (!target && !weight) return part.contours
  const [sx0, sy0, sx1, sy1] = part.box
  const [tx0, ty0, tx1, ty1] = target ?? part.box
  const kx = (tx1 - tx0) / (sx1 - sx0), ky = (ty1 - ty0) / (sy1 - sy0)
  const [wx, wy] = weight ?? [0, 0]
  const mapPoints = (light, heavy) => {
    const out = new Float64Array(light.length)
    for (let i = 0; i < light.length; i += 2) {
      const px = light[i] + wx * (heavy[i] - light[i])
      const py = light[i + 1] + wy * (heavy[i + 1] - light[i + 1])
      out[i] = tx0 + (px - sx0) * kx
      out[i + 1] = ty0 + (py - sy0) * ky
    }
    return out
  }
  return part.contours.map(c => ({
    ...c,
    width: c.width && [c.width[0] * kx, c.width[1] * ky],
    light: weight ? mapPoints(c.light, c.heavy) : mapPoints(c.light, c.light),
    heavy: mapPoints(c.heavy, c.heavy),
  }))
}

function grassCap(composer, node, grassBox, capRegion) {
  const declared = composer.declaredParts('艹', capRegion, false)
  if (declared?.length) return declared
  const cut = composer.host('⿱', 0, '艹', [node[2]], grassBox, true)
  if (cut) return [placed(cut.piece, cut.piece.box, capRegion, composer.ink(cut.record.h), `host ${cut.record.h}`)]
  return composer.node('艹', capRegion)
}

export function shrineJadeParts(composer, node, region) {
  const spec = isShrineJade(node) ? faces[composer.fontStyle] : null
  if (!spec) return null
  if (['艹', '夌', '玉', spec.top.host, spec.foot.host].some(c => composer.excluded(c))) return null
  const top = pinnedCut(composer, spec.top)
  const foot = pinnedCut(composer, spec.foot)
  const jadeRec = composer.glyphRecord('玉')
  if (!top || !foot || jadeRec?.v !== 1 || jadeRec.f || jadeRec.k) return null
  const jade = partOf(jadeRec)
  const body = derived(foot, [
    ...fitContours(top, spec.top.box, spec.top.weight),
    ...fitContours(foot, spec.foot.box),
  ])
  const offset = top.contours.length
  const strokes = [
    ...(top.strokes ?? []).map(([id, cs]) => [id, [...cs]]),
    ...(foot.strokes ?? []).map(([id, cs]) => [id, cs.map(i => i + offset)]),
  ]
  if (strokes.length) body.strokes = strokes
  const bounds = union([spec.grass, body.box, spec.jade])
  const frame = fitted(bounds, region, composer.C.STRETCH)
  const capRegion = mapped(spec.grass, bounds, frame)
  const capParts = grassCap(composer, node, spec.grass, capRegion)
  if (capParts?.length !== 1) return null
  if (spec.fixedWeight) capParts[0].fixed = true
  const fullScale = frame[2] - frame[0] >= 0.85 * (composer.face[2] - composer.face[0]) &&
    frame[3] - frame[1] >= 0.85 * (composer.face[3] - composer.face[1])
  const bodyPart = placed(body, body.box, mapped(body.box, bounds, frame), partInk(body), `enclosing 夌 from ${spec.top.host}+${spec.foot.host}`)
  if (spec.fixedWeight || fullScale) bodyPart.fixed = true
  const jadePart = placed(jade, jade.box, mapped(spec.jade, bounds, frame), composer.ink('玉'), 'glyph 玉')
  if (spec.fixedWeight) jadePart.fixed = true
  return [...capParts, bodyPart, jadePart]
}
