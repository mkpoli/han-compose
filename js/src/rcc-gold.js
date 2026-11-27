import { contourSections, cutContours, derived, drawnContours, groupRings, mapped, partInk, partOf, placed, pointsBox, union } from './geometry.js'
import { hexOf } from './sha256.js'

// 行均《龍龕手鑑》, Southern Song Zhejiang edition, National Palace Museum.
// https://rare.glyphatlas.org/zh-Hans/entry/2015
const crossed = '⿻[1:]丿口', lower = '⿸' + crossed + '乚', right = '⿳冖丷' + lower
const sequence = '⿰金' + right
const alternateLower = '⿻[1:]⿸丿乚口', alternateRight = '⿳冖丷' + alternateLower
const alternate = '⿰金' + alternateRight
const leaves = [...'金冖丷丿口乚']
const donors = [...'鋭冥半兎']
const components = [...leaves, ...donors]
const spellings = new Map([[sequence, [sequence, right, lower, crossed]],
  [alternate, [alternate, alternateRight, alternateLower, '⿸丿乚']]])

// Each group belongs to one editable IDS operand. In brush faces 兎 joins the walls,
// falling stroke and hook. The triples follow the Bézier commands between their junctions.
// The two inner edges of the native windows supply the sides of the crossing stroke.
/** @type {Record<string,{ hashes: string[], gold: number[], cover: number[], dots: number[], join: number[], lower: (number | number[][])[][], frame: number[] }>} */
const faces = {
  'sans': {
    hashes: [
      'ee9d9221366da16388f010d4d4b97c56d336e408d1dbfa40fb7fb6abb29444f2',
      '1d8b4d5dc30ad73fc7b869b87054d24b4397c658b130c6efdeb1de1c80a1809b',
      '9454c5e105ef16d418ab8f2edf9b3b118da52659e22bddb2f4dba014eeeaa070',
      '2a88b5b1b43dbce6d2a3731ddd228c1591c13e73a6911d1409ed4f076587c6f8',
    ],
    gold: [5,6,7,8,9,10,12,13], cover: [2], dots: [0,1],
    join: [490, 590, 1, 29],
    lower: [
      [0],
      [2,3],
      [5],
    ],
    frame: [27.6, -87.1, 969.5, 840.6],
  },
  'serif': {
    hashes: [
      'f1ef715fa6e67af55bbd4880e4b29c022e89c165c801edccb61bbcf71b91917c',
      '6f6d08b53e566fea4f8a1cfe7bb9b2886a022cf961014b11f2bf6f302a75bc33',
      'f5cd36ee8fa0a484b5f2b7c9126a4ef0d854ba87e3911d2002d3203b01c19768',
      '7250e545385bac4a242de90029adb7fe71379f59076d1e4d151d224b9d59bb28',
    ],
    gold: [6,7,8,9,10,11,12,13], cover: [7,8,9], dots: [0,4],
    join: [488, 600, 8, 42],
    lower: [
      [6],
      [0,1,2],
      [5],
    ],
    frame: [29, -84, 979.6, 836.1],
  },
  'fangsong': {
    hashes: [
      '275d6809c00c303cd7508d1903b7dce0c4dd9956cd0ed14465d364617ff1948d',
      'f8ca992db1fd4bc3662ee926df21310aec470a014014cd99f4695d4e11e6a517',
      '6afa742d24faf14d90417e7fcab34a3bc6f11f1894ba6d23c456ce1751870612',
      '38e7fc4f99924bb7fd33ad9a79a7217c79af18015b7770965fb46071492f0b77',
    ],
    gold: [1,2], cover: [4], dots: [1,2],
    join: [496, 498, 8, 68],
    lower: [
      [[[0,0,4],[1,3,4],[0,17,17],[0,42,42],[3,3,4],[0,91,96]]],
      [[[0,4,17],[0,42,58],[0,90,91]],[[1,0,3],[3,0,3]]],
      [[[0,58,90]]],
    ],
    frame: [39.4, -85.6, 956.6, 790.1],
  },
  'regular': {
    hashes: [
      'b75c65b5ee520ad0606f9b72832f52cdc8a1f3bb9b4e7f85d5830806d1ea182f',
      '044edbe32125d1b7ed7d2e62632de4be76138ebc4abb513f89b8e8dbd58e68ef',
      '5d1da882e939f7fa9350e039f0e14e3172c98ec1b1c6a283207fc72cc83f7d6e',
      'd7196448b0ae782bb974587734fcbb496dde2aaf089b14ca4b1f97c38a63cd51',
    ],
    gold: [0,1,2], cover: [1], dots: [1,2],
    join: [444, 539, 16, 71],
    lower: [
      [[[1,6,18],[2,0,1],[1,33,33],[1,58,58],[3,8,9],[3,0,1]]],
      [[[1,18,33],[1,58,72],[1,5,6]],[[2,1,6],[3,1,8]]],
      [[[1,72,95],[1,0,5]]],
    ],
    frame: [57.9, -86.2, 952.5, 770.8],
  },
  'pen-writing': {
    hashes: [
      'c7752e722b04cab90e3c09298ee1d44f4f8f1789b46d97892520eefed0d743ca',
      '7211b2d5aadda4c91938e613ed33f3897d82615cb0044ffef9d6ed7ab88eb389',
      '2caa1135cda89de44cf4a9e1cecb24f4f9e75a1708995968e4a1b34c384afb03',
      'aab483f57fb530b6415b94d75ac9f96b74eccda17970017a1e9d9ec4f6201a1f',
    ],
    gold: [0,4,5], cover: [0], dots: [1,2],
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
export const goldDonors = (key, style) => spellings.has(key) && faces[style] ? donors : []

/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export function goldParts(composer, key, region) {
  const spelling = spellings.get(key)
  if (!spelling || [...spelling, ...components].some(ch => composer.excluded(ch))) return null
  const face = faces[composer.fontStyle]
  if (!face) return null
  const records = donors.map(ch => composer.glyphRecord(ch))
  if (records.some((r, i) => r?.v !== 1 || hexOf(JSON.stringify(r.p)) !== face.hashes[i])) return null
  const [sharp, dark, half, rabbit] = records.map(r => partOf(r))
  const metal = cutContours(sharp, face.gold), cap = cutContours(dark, face.cover)
  const base = face.lower.map(group => derived(rabbit, group.map(c =>
    typeof c === 'number' ? rabbit.contours[c] : contourSections(rabbit.contours, ...c))))
  // The first two coordinates locate the junction in the native 兎 outline. The last
  // two seat the crown’s left terminal on the box shoulder in the composed em.
  const [x, y, leftInset, drop] = face.join
  // In the print the second dot continues into the falling stroke. End the native
  // 兎 stroke at the top bar before joining the right-hand dot of 半 to it.
  if (composer.fontStyle === 'sans' || composer.fontStyle === 'serif')
    base[0] = bend(base[0], (a, b) => [a, Math.min(b, y)])
  const box = union(base.map(g => g.box)), baseRoom = [465, 0, 1000, 687]
  const [jx, jy] = mapped([x, y, x, y], box, baseRoom)
  const rooms = base.map(g => mapped(g.box, box, baseRoom))
  rooms[2][3] += 9 // Extend the start of the hook into the bottom rail.
  // In the print only the left end of the crown touches the box. Shorten the right
  // terminal below its ridge while preserving the width of the horizontal stroke.
  const [cl, cb, cr, ct] = cap.box
  const cover = bend(cap, (a, b) => [a, b + .78 * (a - cl) / (cr - cl) * Math.max(0, ct - b - .32 * (ct - cb))])
  const coverRoom = [rooms[1][0] + leftInset, rooms[1][3] - drop, 957, 990]
  const dots = face.dots.map(i => cutContours(half, [i])).sort((a, b) => a.box[0] - b.box[0])
  const dabRooms = [[jx - 97, jy + 22, jx - 37, jy + 113], [jx - 20, jy - 12, jx + 64, jy + 128]]
  const dabs = derived(half, dots.flatMap((g, i) => {
    const piece = placed(g, g.box, dabRooms[i], 0, '')
    const light = drawnContours(piece), heavy = drawnContours({ ...piece, weight: [1, 1] })
    return g.contours.map((c, k) => ({ ...c, light: light[k], heavy: heavy[k] }))
  }))
  const allRooms = [mapped(metal.box, sharp.box, [0, 0, 1000, 1000]), coverRoom, dabs.box, ...rooms]
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
