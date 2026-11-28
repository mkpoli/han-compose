// @ts-nocheck
import { cutContours, derived, mapped, partInk, partOf, placed, union } from './geometry.js'
import { hexOf } from './sha256.js'

// R+07AB, Mika-jinja (Misato, Saitama) hanging plaque (photo by Taisuke.Kasuya, CC BY-SA 4.0).
// Assembles ⿱艹⿺夌玉 from native font outlines without warping the bottom sweep:
// 艹 from 菱, upper 土八 from 凌, enclosing 夂 from 麩 (or 处 in Zhuque Fangsong), and 玉.
// Related encoded forms 𦼆 (⿱艹⿺麦玉) and 𭐨 (⿺夌主) show the same enclosing structure.

const faces = {
  sans: {
    grass: { host: '菱', contours: [0, 3, 4], digest: '43439cecaec205e6cff69f7b1a448b5e8e14a10cbcb159a8c73331ed10253e99', box: [56, 668, 945, 855] },
    top: { host: '凌', contours: [1, 2, 3, 7, 8], digest: '391b235066c5082a03a8244ebf02048768114fd4d217e1e3c771b0d6866751f0', box: [56, 382, 488, 642] },
    foot: { host: '麩', contours: [1, 2, 4, 5], digest: '8464a5a2fc2961cb055948720a383d8133f8d370d4fef13517b5eb9270f3c5af', box: [31, -81, 972, 388] },
    jade: [528, 62, 946, 622],
  },
  serif: {
    grass: { host: '菱', contours: [8], digest: '5f2a0f14140808d1139b74cca6efe70b6a24f3372efe72f97a31b40419228ff0', box: [44, 665, 957, 855] },
    top: { host: '凌', contours: [0, 1, 2, 3, 10], digest: '2acc21c2eb592cfd0c7da2fb4800695160d8171ed5383fe46e9c7c995452ce78', box: [58, 376, 486, 642] },
    foot: { host: '麩', contours: [0, 2, 3, 4], digest: '72b60f366601a89859ea72d8db3f8e8eede58145a2d1d4c451ec1b167dd13ee6', box: [31, -78, 968, 386] },
    jade: [526, 66, 948, 625],
  },
  fangsong: {
    grass: { host: '菱', contours: [3], digest: 'ffa4c57a60cd3e2b446539cfc7e5f6241f4a8555b76c93803b8600f8efbf9dd3', box: [85, 595, 905, 845] },
    top: { host: '凌', contours: [0, 3], digest: '2aa723222f9a04f70917f858124ae3f1e9b79fe5e5fe9acacc709b08c67f1bf2', box: [88, 368, 488, 608] },
    foot: { host: '处', contours: [0, 2], digest: '9f0a3965c175b4ecde5b44b6626b47f2f9241831bc1fbf350e15ba8ce2a3cdd9', box: [42, -92, 955, 388] },
    jade: [535, 68, 938, 608],
  },
  regular: {
    grass: { host: '菱', contours: [3, 4], digest: 'b209240f1a7606d8d99c5704c5dcf0731813587cf51aa5de843eb248a8f6c9e2', box: [112, 608, 868, 848] },
    top: { host: '凌', contours: [3], digest: '7e3133d9ff1f21104bac35a19f0c5b0035c73ab10c2f3be9619c60793f073a2b', box: [96, 338, 486, 596] },
    foot: { host: '麩', contours: [2, 3], digest: 'ca020e2bccaf46e5af2703ab49491ce821a4d70a2ec639eb8d023cc5a2bf8aa4', box: [68, -68, 962, 338] },
    jade: [526, 102, 932, 610],
  },
  'pen-writing': {
    grass: { host: '菱', contours: [0], digest: '943627947ecafb8f5fad026ef1040565ee8e943d08072f11e6465e2bde0ea173', box: [105, 600, 895, 832] },
    top: { host: '凌', contours: [0], digest: 'f46beaf5e71dc2e806fd020829e371285351199b40dc6b9957e0f6bd8fae2309', box: [98, 332, 492, 592] },
    foot: { host: '麩', contours: [4, 5], digest: 'e40d346a612d9fc4b2f765d53aaef201eaa0f95edfa4e159b5534aec6132ca1f', box: [41, -87, 966, 333] },
    jade: [528, 82, 940, 602],
  },
}

export function isShrineJade(node) {
  return Array.isArray(node) && !node.note && node[0] === '⿱' && node[1] === '艹' &&
    Array.isArray(node[2]) && !node[2].note && node[2][0] === '⿺' && node[2][1] === '夌' && node[2][2] === '玉'
}

export function shrineJadeSources(style) {
  const spec = faces[style]
  return spec ? [spec.grass.host, spec.top.host, spec.foot.host, '玉'] : []
}

function pinnedCut(composer, entry) {
  const rec = composer.glyphRecord(entry.host)
  if (rec?.v !== 1 || rec.f || rec.k || hexOf(JSON.stringify(rec.p)) !== entry.digest) return null
  return cutContours(partOf(rec), entry.contours)
}

function fitContours(part, target) {
  const [sx0, sy0, sx1, sy1] = part.box
  const [tx0, ty0, tx1, ty1] = target
  const kx = (tx1 - tx0) / (sx1 - sx0), ky = (ty1 - ty0) / (sy1 - sy0)
  const mapPoints = points => {
    const out = new Float64Array(points.length)
    for (let i = 0; i < points.length; i += 2) {
      out[i] = tx0 + (points[i] - sx0) * kx
      out[i + 1] = ty0 + (points[i + 1] - sy0) * ky
    }
    return out
  }
  return part.contours.map(c => ({
    ...c,
    width: c.width && [c.width[0] * kx, c.width[1] * ky],
    light: mapPoints(c.light),
    heavy: mapPoints(c.heavy),
  }))
}

export function shrineJadeParts(composer, node, region) {
  const spec = isShrineJade(node) ? faces[composer.fontStyle] : null
  if (!spec) return null
  if (['艹', '夌', '玉', spec.grass.host, spec.top.host, spec.foot.host].some(c => composer.excluded(c))) return null
  const cap = pinnedCut(composer, spec.grass)
  const top = pinnedCut(composer, spec.top)
  const foot = pinnedCut(composer, spec.foot)
  const jade = composer.glyph('玉')
  if (!cap || !top || !foot || !jade) return null
  const body = derived(foot, [...fitContours(top, spec.top.box), ...fitContours(foot, spec.foot.box)])
  const bounds = union([spec.grass.box, body.box, spec.jade])
  const place = (part, box, origin) => ({
    ...placed(part, part.box, mapped(box, bounds, region), partInk(part), origin), fixed: true,
  })
  return [
    place(cap, spec.grass.box, `grass from ${spec.grass.host}`),
    place(body, body.box, `enclosing 夌 from ${spec.top.host}+${spec.foot.host}`),
    place(jade, spec.jade, 'glyph 玉'),
  ]
}
