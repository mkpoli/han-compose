// @ts-nocheck
import { derived, mapped, partInk, partOf, placed } from './geometry.js'
import { hexOf } from './sha256.js'

// The connected contextual sweep is from Zhuque Fangsong 0.212 尅 (SIL OFL 1.1).
// Zhuque lacks 𠀧, 𥪞 and 兛. For 巴 and 竜, retain the native head and
// join its upright to the low stroke and upturned tip from 尅.
const KE_DONOR = '59500d3d2cfd9d7852b3ae0ae80801610a2c76d676c333efed708021f9443979'
// ZhongYi FangSong 兛 and the cross-style Jigmo 𥪞 guide the inner placements.
const forms = {
  巴: { inner: '三', room: [515, 186, 882, 650],
    digest: '7b094ea2c516dd35dda099e75a0ccc9c4f28fc06323157702835d524abc018b9',
    contour: 0, join: [54, 83], left: 104, width: 363, tip: 950, floor: -49 },
  竜: { inner: '内', room: [493, 80, 800, 752],
    digest: 'e4b19e281efb1551db14b62c9cc96badbab08656a79a6a41e37832ee75284efe',
    contour: 1, join: [59, 87], left: 48, width: 445, tip: 946, floor: -92 },
  克: { inner: '千', room: [458, 45, 863, 738] },
}

// These offsets count points at command boundaries in the quadratic contours.
// In 尅 the selected stroke starts on the inner floor and ends along its outer edge.
function sliceOps(ops, from, to) {
  let offset = 0
  return ops.filter(([, count]) => {
    const inside = from <= offset && offset < to
    offset += count
    return inside
  })
}

function withSweep(glyph, sweep, form) {
  const [left, , right] = glyph.box
  const [from, to] = form.join
  return derived(glyph, glyph.contours.map((contour, index) => {
    const fit = points => points.map((v, i) => i % 2 ? v : form.left + (v - left) * form.width / (right - left))
    const light = fit(contour.light), heavy = fit(contour.heavy)
    if (index !== form.contour) return { ...contour, light, heavy }
    const join = (points, donor) => {
      const tail = donor.slice(48, 108)
      const startX = points[(from - 1) * 2]
      const endX = points[to * 2]
      for (let i = 0; i < tail.length; i += 2) {
        const inner = i < 44
        const seamX = inner ? startX : endX
        const seamY = points[(inner ? from - 1 : to) * 2 + 1]
        const progress = Math.max(0, Math.min(1, (tail[i] - 484) / (945 - 484)))
        const nearSeam = Math.max(0, 1 - progress * 5)
        const y = form.floor + (tail[i + 1] + 75) * 0.75
        const seamDonorY = form.floor + ((inner ? -13 : -74) + 75) * 0.75
        tail[i] = seamX + (form.tip - seamX) * progress
        tail[i + 1] = y + (seamY - seamDonorY) * nearSeam
      }
      return new Float64Array([...points.slice(0, from * 2), ...tail, ...points.slice(to * 2)])
    }
    return { ...contour, ops: [
      ...sliceOps(contour.ops, 0, from),
      ...sliceOps(sweep.ops, 24, 54),
      ...sliceOps(contour.ops, to, Infinity),
    ], light: join(light, sweep.light), heavy: join(heavy, sweep.heavy) }
  }))
}

function keFrame(glyph) {
  // 尅 separates 寸 (contours 0 and 5). Narrow the upper body of 克 to
  // clear 千, tapering the displacement to zero across the drawn sweep.
  const fit = (points, sweep) => points.map((v, i) => {
    if (i % 2) return v
    const narrowed = 45 + (v - 62) * 0.80
    if (!sweep) return narrowed
    const blend = Math.max(0, Math.min(1, (v - 447) / (945 - 447)))
    return narrowed + (v - narrowed) * blend
  })
  return derived(glyph, [1, 2, 3, 4].map(index => {
    const contour = glyph.contours[index]
    return { ...contour, light: fit(contour.light, index === 2), heavy: fit(contour.heavy, index === 2) }
  }))
}

export function hookParts(composer, node, region) {
  if (composer.fontStyle !== 'fangsong' || !Array.isArray(node) || node.note || node[0] !== '⿺') return null
  const [, outer, inner] = node
  if (typeof outer !== 'string' || !Object.hasOwn(forms, outer)) return null
  const form = forms[outer]
  if (form.inner !== inner || [outer, inner, '尅'].some(ch => composer.excluded(ch))) return null
  const donor = composer.glyphRecord('尅')
  const filling = composer.glyphRecord(inner)
  if (filling?.v !== 1 || donor?.v !== 1 || hexOf(JSON.stringify(donor.p)) !== KE_DONOR) return null
  const ke = partOf(donor)
  let frame
  if (outer === '克') {
    frame = keFrame(ke)
  } else {
    const record = composer.glyphRecord(outer)
    if (record?.v !== 1 || hexOf(JSON.stringify(record.p)) !== form.digest) return null
    frame = withSweep(partOf(record), ke.contours[2], form)
  }
  const place = (part, box, name) => ({ ...placed(part, part.box,
    mapped(box, [0, -120, 1000, 880], region), partInk(part), `glyph ${name}`), fixed: true })
  return [place(frame, frame.box, outer), place(partOf(filling), form.room, inner)]
}
