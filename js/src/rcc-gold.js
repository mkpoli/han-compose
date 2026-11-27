import { contourSections, cutContours, derived, groupRings, mapped, partInk, partOf, placed, pointsBox, union } from './geometry.js'
import { hexOf } from './sha256.js'

// 行均《龍龕手鑑》, Southern Song Zhejiang edition, National Palace Museum.
// https://rare.glyphatlas.org/zh-Hans/entry/2015
const crossed = '⿻[1:]丿口', lower = '⿸' + crossed + '乚', right = '⿳冖丷' + lower
const sequence = '⿰金' + right
const alternateLower = '⿻[1:]⿸丿乚口', alternateRight = '⿳冖丷' + alternateLower
const alternate = '⿰金' + alternateRight
const leaves = [...'金冖丷丿口乚']
const commonDonors = ['鋭', '兎']
const spellings = new Map([[sequence, [sequence, right, lower, crossed]],
  [alternate, [alternate, alternateRight, alternateLower, '⿸丿乚']]])

// Each group belongs to one editable IDS operand. In brush faces 兎 joins the walls,
// falling stroke and hook. The triples follow the Bézier commands between their junctions.
// The two inner edges of the native windows supply the sides of the crossing stroke.
/** @type {Record<string,{ crown: string, hashes: string[], gold: number[], cover: number[], dots: number[], tips: number[], join: number[], lower: (number | number[][])[][], frame: number[] }>} */
const faces = {
  'sans': {
    crown: '冞',
    hashes: [
      'ee9d9221366da16388f010d4d4b97c56d336e408d1dbfa40fb7fb6abb29444f2',
      '2a88b5b1b43dbce6d2a3731ddd228c1591c13e73a6911d1409ed4f076587c6f8',
      '533bb939788ddf6bac5e77a4ec87a188e4cb273417525dc2c87cfe2e29fd870e',
    ],
    gold: [5,6,7,8,9,10,12,13], cover: [0], dots: [6, 5],
    tips: [302, 677],
    join: [490, 590, 1, 29],
    lower: [
      [0],
      [2,3],
      [5],
    ],
    frame: [27.6, -87.1, 969.5, 840.6],
  },
  'serif': {
    crown: '冞',
    hashes: [
      'f1ef715fa6e67af55bbd4880e4b29c022e89c165c801edccb61bbcf71b91917c',
      '7250e545385bac4a242de90029adb7fe71379f59076d1e4d151d224b9d59bb28',
      '1038f2ac1b32760a881efef3d1831cfa9ee17c628668211bb40710371ac94e54',
    ],
    gold: [6,7,8,9,10,11,12,13], cover: [0, 1, 2], dots: [5, 4],
    tips: [317, 635],
    join: [488, 600, 8, 42],
    lower: [
      [6],
      [0,1,2],
      [5],
    ],
    frame: [29, -84, 979.6, 836.1],
  },
  'fangsong': {
    crown: '壶',
    hashes: [
      '275d6809c00c303cd7508d1903b7dce0c4dd9956cd0ed14465d364617ff1948d',
      '38e7fc4f99924bb7fd33ad9a79a7217c79af18015b7770965fb46071492f0b77',
      '9cd8924e2b5173069be29b3a1b4c60cd77c38c2c7ebe809deb674df509c52e39',
    ],
    gold: [1,2], cover: [2], dots: [1, 3],
    tips: [332, 619],
    join: [496, 498, 8, 68],
    lower: [
      [[[0,0,4],[1,3,4],[0,17,17],[0,42,42],[3,3,4],[0,91,96]]],
      [[[0,4,17],[0,42,58],[0,90,91]],[[1,0,3],[3,0,3]]],
      [[[0,58,90]]],
    ],
    frame: [39.4, -85.6, 956.6, 790.1],
  },
  'regular': {
    crown: '冞',
    hashes: [
      'b75c65b5ee520ad0606f9b72832f52cdc8a1f3bb9b4e7f85d5830806d1ea182f',
      'd7196448b0ae782bb974587734fcbb496dde2aaf089b14ca4b1f97c38a63cd51',
      '63b23e69d9451854292d13c8e72c43fc92adaaa88562230e5f3c79d13c76f326',
    ],
    gold: [0,1,2], cover: [1], dots: [2, 3],
    tips: [371, 584],
    join: [444, 539, 16, 71],
    lower: [
      [[[1,6,18],[2,0,1],[1,33,33],[1,58,58],[3,8,9],[3,0,1]]],
      [[[1,18,33],[1,58,72],[1,5,6]],[[2,1,6],[3,1,8]]],
      [[[1,72,95],[1,0,5]]],
    ],
    frame: [57.9, -86.2, 952.5, 770.8],
  },
  'pen-writing': {
    crown: '冞',
    hashes: [
      'c7752e722b04cab90e3c09298ee1d44f4f8f1789b46d97892520eefed0d743ca',
      'aab483f57fb530b6415b94d75ac9f96b74eccda17970017a1e9d9ec4f6201a1f',
      'e2f4e40474c23d2a88f681eda6ac2e493e8412f9d2afc6fafb1384a39915f0b2',
    ],
    gold: [0,4,5], cover: [1], dots: [2, 3],
    tips: [385, 570],
    join: [497, 529, 8, 36],
    lower: [
      [[[0,43,48],[1,2,3],[0,16,16],[0,29,29],[2,1,2]]],
      [[[0,8,16],[0,29,43],[0,48,49]],[[1,0,2],[2,2,3],[2,0,1],[1,3,3]]],
      [[[0,49,54],[0,0,8]]],
    ],
    frame: [46.4, -99.1, 961.7, 784.1],
  },
}

/** @param {string} key @param {string} style */
export const goldDonors = (key, style) => spellings.has(key) && faces[style] ? [...commonDonors, faces[style].crown] : []

/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export function goldParts(composer, key, region) {
  const spelling = spellings.get(key)
  const face = faces[composer.fontStyle]
  if (!spelling || !face) return null
  const donors = goldDonors(key, composer.fontStyle)
  if ([...spelling, ...leaves, ...donors].some(ch => composer.excluded(ch))) return null
  const records = donors.map(ch => composer.glyphRecord(ch))
  if (records.some((r, i) => r?.v !== 1 || hexOf(JSON.stringify(r.p)) !== face.hashes[i])) return null
  const [sharp, rabbit, nativeCrown] = records.map(r => partOf(r))
  const metal = cutContours(sharp, face.gold), cap = cutContours(nativeCrown, face.cover)
  const dots = cutContours(nativeCrown, face.dots)
  const base = face.lower.map(group => derived(rabbit, group.map(c =>
    typeof c === 'number' ? rabbit.contours[c] : contourSections(rabbit.contours, ...c))))
  // The first two coordinates locate the junction in the native 兎 outline. The last
  // two seat the crown’s left terminal on the box shoulder in the composed em.
  const [x, y, leftInset, drop] = face.join
  // In the print the second dot continues into the falling stroke. End the native
  // 兎 stroke at the top bar before joining the right-hand dab to it.
  if (composer.fontStyle === 'sans' || composer.fontStyle === 'serif')
    base[0] = bend(base[0], (a, b) => [a, Math.min(b, y)])
  const box = union(base.map(g => g.box)), baseRoom = [465, 0, 1000, 687]
  const [jx, jy] = mapped([x, y, x, y], box, baseRoom)
  const rooms = base.map(g => mapped(g.box, box, baseRoom))
  rooms[2][3] += 9 // Extend the start of the hook into the bottom rail.
  // 冞 supplies the roof and top dots of 米. FangSong 壶 supplies the roof and
  // the side dots of 业. In the print the inner tips converge in the space
  // occupied by the donor's upright strokes. The right dab reaches the box.
  const [cl, cb, cr, ct] = cap.box
  const [leftTip, rightTip] = face.tips
  const [leftDot, rightDot] = face.dots.map(i => cutContours(nativeCrown, [i]))
  const left = rooms[1][0] + leftInset, right = 957, height = 990 - jy
  const split = (leftDot.box[2] + rightDot.box[0]) / 2
  const leftDabTip = jx - (composer.fontStyle === 'sans' ? 78 : 63)
  const leftDabScale = Math.min(.62, (leftDabTip - left - 65) / (leftTip - leftDot.box[0]))
  const dabs = bend(dots, (a, b) => {
    const onRight = a > split
    const g = onRight ? rightDot : leftDot
    const fraction = (b - g.box[1]) / (g.box[3] - g.box[1])
    const x = onRight ? jx + (a - rightTip) * .66 : leftDabTip + (a - leftTip) * leftDabScale
    const y = onRight ? jy - 9 + height * .68 * fraction : jy + height * (.13 + .37 * fraction)
    return [x, y]
  })
  // The printed roof meets the box on the left. Extend only the lower part of
  // this terminal so that the original ridge keeps its native stroke weight.
  const terminal = rooms[1][3] - drop
  const roofScale = .79
  const knee = ct - .48 * (ct - cb), stretch = 990 - (ct - cb) * roofScale - terminal
  const cover = bend(cap, (a, b) => {
    const leftEnd = Math.max(0, Math.min(1, 1.5 - (a - cl) / (.24 * (cr - cl))))
    const below = Math.max(0, (knee - b) / (knee - cb))
    const rightEnd = Math.max(0, Math.min(1, 4 * (a - cl) / (cr - cl) - 3))
    return [left + (a - cl) * (right - left) / (cr - cl),
      990 + (b - ct) * roofScale - below * leftEnd * stretch + below * rightEnd * (ct - cb) * .21]
  })
  const allRooms = [mapped(metal.box, sharp.box, [0, 0, 1000, 1000]), cover.box, dabs.box, ...rooms]
  // The two recorded groupings visit 口 and 乚 in opposite orders.
  const order = key === alternate ? [0, 1, 2, 3, 5, 4] : [0, 1, 2, 3, 4, 5]
  const parts = [metal, cover, dabs, ...base].map((g, i) => ({
    ...placed(g, g.box, allRooms[i], partInk(g), 'R+07DF ' + leaves[i]), rccLeaf: order[i], fixed: true,
  }))
  const ink = union(groupRings(parts, 24).map(pointsBox)), frame = mapped(face.frame, composer.C.face, region)
  for (const part of parts) part.target = mapped(part.target, ink, frame)
  return parts
}

/** @param {any} glyph @param {(x:number,y:number)=>number[]} move */
function bend(glyph, move) {
  /** @param {Float64Array} points */
  const remap = points => {
    const out = new Float64Array(points.length)
    for (let i = 0; i < points.length; i += 2) out.set(move(points[i], points[i + 1]), i)
    return out
  }
  return derived(glyph, glyph.contours.map((/** @type {any} */ c) => ({ ...c, light: remap(c.light), heavy: remap(c.heavy) })))
}
