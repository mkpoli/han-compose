// @ts-nocheck: the cut contours use the composer's placed parts.
import { cutContours, derived, drawnContours, groupRings, mapped, placed, pointsBox, union } from './geometry.js'

const ink = part => union(groupRings([part], 24).map(pointsBox))
const native = shape => placed(shape, shape.box, shape.box, 0, '')

function fittedContours(part, room) {
  const fitted = { ...part, target: mapped(part.target, ink(part), room) }
  const light = drawnContours(fitted), heavy = drawnContours({ ...fitted, weight: [1, 1] })
  return fitted.part.contours.map((c, i) => ({ ...c, light: light[i], heavy: heavy[i] }))
}

// Pen 䕋 draws 艹 over 土 and 唐. Its 土 supplies the left column and its 唐 the room
// for 屈. Pen 䓛 supplies the grass, the full 屈, and the vertical interval between them.
export function penGrassKu(parts, composer) {
  if (composer.fontStyle !== 'pen-writing' || composer.partial || parts.length !== 2 ||
      parts[0].origin !== 'learned 蔎' || parts[1].origin !== 'glyph 堀' ||
      ['艹', '堀', '䕋', '䓛'].some(ch => composer.excluded(ch))) return parts
  const tang = composer.glyph('䕋'), qu = composer.glyph('䓛')
  if (!tang || !qu) return parts
  const head = native(cutContours(qu, [2])), earth = native(cutContours(tang, [5]))
  const lower = native(cutContours(qu, [0, 3, 1]))
  const right = ink(native(cutContours(tang, [0, 1, 2, 3, 4])))
  const earthBox = ink(earth), lowerFrame = union([earthBox, right]), quBox = ink(lower)
  const alignY = box => {
    const [, bottom, , top] = mapped(box, lowerFrame, quBox)
    return [box[0], bottom, box[2], top]
  }
  // The four resulting contours correspond to the 土, 尸, 尸 counter and 出 of 堀.
  const body = native(derived(tang, [...fittedContours(earth, alignY(earthBox)), ...fittedContours(lower, [right[0], quBox[1], right[2], quBox[3]])]))
  const modelBox = union([ink(head), ink(body)])
  const keepHead = part => part
  const finishBody = (original, drawing) => {
    const cap = drawing.find(p => p.finishOutline === keepHead)
    if (!cap || [cap, original].some(p => p.cut || p.fixed || p.flips?.length)) return original
    const frame = union([ink(cap), ink(original)])
    const fit = p => ({ part: p.part, source: p.source, target: mapped(p.target, modelBox, frame), weight: [0, 0] })
    Object.assign(cap, fit(head), { origin: '艹 from 䓛' })
    const lower = fit(body)
    if (original.part.strokes) lower.part = { ...lower.part, strokes: original.part.strokes }
    return { ...lower, origin: '堀 from 䕋 and 䓛' }
  }
  return [{ ...parts[0], finishOutline: keepHead }, { ...parts[1], finishOutline: finishBody }]
}
