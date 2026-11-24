// @ts-check
// Stroke groups from han-compose's export (format 6, `G.sg`): which contours belong to which
// KanjiVG stroke. A stroke whose contours are all its own can be detached and moved without
// cutting; a stroke sharing a contour with another (口's top and right) needs a cut first.
import { drawnContours, makePart, placed, runsBack } from './geometry.js'

/**
 * A placed part split at `strokeId`: the stroke as its own placed part and the rest.
 *
 * The two parts are in the drawing's coordinates, not the source glyph's, so the caller can
 * transform the stroke and recombine. A part without stroke groups, an unknown stroke, or a stroke
 * sharing a contour with another returns null. The returned parts carry no `strokes`: their
 * contour indices no longer describe the original glyph.
 *
 * @param {{ part: any, source: number[], target: number[], weight?: number[], native?: number, origin?: string, flips?: any[] }} item
 * @param {number} strokeId
 * @returns {{ stroke: any, rest: any } | null}
 */
export function splitStroke(item, strokeId) {
  const groups = /** @type {[number, number[]][] | undefined} */ (item.part.strokes)
  if (!groups) return null
  const target = groups.find(([id]) => id === strokeId)
  if (!target) return null
  const others = new Set(groups.filter(([id]) => id !== strokeId).flatMap(([, contours]) => contours))
  if (target[1].some(contour => others.has(contour))) return null

  const points = drawnContours(item)
  const contours = /** @type {{ ops: any, width?: number | null }[]} */ (item.part.contours).map((contour, index) => ({
    ops: contour.ops,
    light: points[index],
    heavy: points[index],
    width: contour.width ?? null,
  }))
  const keep = new Set(target[1])
  // The contours are the drawing's, flips and all, so the two parts carry its drawn winding.
  const reverse = runsBack(item)
  const strokePart = makePart(contours.filter((_, index) => keep.has(index)), undefined, reverse)
  const restPart = makePart(contours.filter((_, index) => !keep.has(index)), undefined, reverse)
  if (!strokePart.contours.length || !restPart.contours.length) return null
  /** @param {any} part */
  const at = part => placed(part, part.box, part.box, item.native ?? 0, `${item.origin ?? 'part'} stroke ${strokeId}`, [0, 0])
  return { stroke: at(strokePart), rest: at(restPart) }
}
