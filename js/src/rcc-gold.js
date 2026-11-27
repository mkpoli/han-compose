import { derived, groupRings, mapped, partInk, partOf, placed, pointsBox, union } from './geometry.js'
import { hexOf } from './sha256.js'

// 行均《龍龕手鑑》, Southern Song Zhejiang edition, National Palace Museum collection.
// The six boxes follow the specimen reproduced at https://rare.glyphatlas.org/zh-Hans/entry/2015.
const crossed = '⿻[1:]丿口'
const lower = '⿸' + crossed + '乚'
const right = '⿳冖丷' + lower
const sequence = '⿰金' + right
const leaves = [...'金冖丷丿口乚']
const components = [sequence, right, lower, crossed, ...leaves, '針']
const slots = [[0, .035, .480, 1], [.480, .635, .940, .985], [.590, .655, .790, .848],
  [.470, .075, .738, .816], [.512, .410, .873, .714], [.748, 0, 1, .486]]

// The first one or two outlines in 針 belong to 十. The rest form its left-side 金.
// The four existing drawings retain their ink extents. In FangSong, which lacked 丷,
// the footprint comes from the same face's two-column ⿰金元.
/** @type {Record<string, [string, number, number[]]>} */
const faces = {
  sans: ['51d4073033c74dea83531ecc9536364557257e5b82f3b0d637eaa35c6f7dcba6', 2, [27.6, -87.1, 969.5, 840.6]],
  serif: ['1d569c347c6a4af9be79a29818605bf53a8815b133dc23d4b7243a32c6bd59c8', 2, [29, -84, 979.6, 836.1]],
  fangsong: ['9f3491fbf5f35c0e982ce48424a7c5e954a1ddeaaebb0126d2bf7860597671a3', 1, [39.4, -85.6, 956.6, 790.1]],
  regular: ['909e4f49c7952c904b76a71f5f5e240f814f25ca9d04db45bb8f33533ee8cb54', 1, [57.9, -86.2, 952.5, 770.8]],
  'pen-writing': ['5c19050c603aa161598488f0b65c255914e72513017fcb1060dcce5ce9ac97d9', 1, [46.4, -99.1, 961.7, 784.1]],
}

/** @param {string} key @param {string} style */
export function goldDonors(key, style) {
  return key === sequence ? (style === 'fangsong' ? ['針', '半', '儿'] : ['針']) : []
}

/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export function goldParts(composer, key, region) {
  if (key !== sequence || components.some(ch => composer.excluded(ch))) return null
  const face = faces[composer.fontStyle], needle = composer.glyphRecord('針')
  if (!face || !needle || hexOf(JSON.stringify(needle.p)) !== face[0]) return null
  const metal = partOf(needle)
  const gold = derived(metal, metal.contours.slice(face[1]))
  let dots
  if (composer.fontStyle === 'fangsong' && !composer.own('丷')) {
    if (composer.excluded('半')) return null
    const half = composer.glyphRecord('半')
    if (!half || hexOf(JSON.stringify(half.p)) !== '6afa742d24faf14d90417e7fcab34a3bc6f11f1894ba6d23c456ce1751870612') return null
    const donor = partOf(half)
    dots = derived(donor, donor.contours.slice(1))
  } else dots = composer.glyph('丷')
  let hook = composer.glyph('乚')
  if (!hook && composer.fontStyle === 'fangsong' && !composer.excluded('儿')) {
    const legs = composer.glyphRecord('儿')
    if (!legs || hexOf(JSON.stringify(legs.p)) !== '7e1c56ed3c64c221cc3d624c48eb4488aeff55dc75bf884ddacdfe29a2e99098') return null
    const donor = partOf(legs)
    hook = derived(donor, [donor.contours[0]])
  }
  const glyphs = [gold, composer.glyph('冖'), dots, composer.glyph('丿'), composer.glyph('口'), hook]
  if (glyphs.some(g => !g)) return null
  const parts = glyphs.map((g, i) => ({ ...placed(g, g.box, slots[i].map(v => v * 1000), partInk(g), 'R+07DF ' + leaves[i]), rccLeaf: i, fixed: false }))
  if (!composer.partial && composer.weighted) composer.balance(parts)
  if (!composer.partial && composer.staticFace) composer.staticBalance(parts)
  for (const part of parts) part.fixed = true
  const ink = union(groupRings(parts, 24).map(pointsBox))
  const frame = mapped(face[2], composer.C.face, region)
  for (const part of parts) part.target = mapped(part.target, ink, frame)
  return parts
}
