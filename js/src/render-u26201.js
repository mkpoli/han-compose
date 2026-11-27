// @ts-check
import serif from '../data/rate-forms/serif.json' with { type: 'json' }
import clipper from 'clipper-lib'
import { u26201Forms } from './yao-forms.js'
import drawings from './yao-outlines.json' with { type: 'json' }
import { ASCENT, commands, segments } from './geometry.js'
import { parsePath, splitSubpaths } from './document-path.js'

/** The two occupied ink boxes in the WenJin Mincho 2.101 drawing, in its 1000-unit SVG em. */
const slots = [[86, 527, 496.15, 813.29], [604, 195, 849.49, 640.39]]
const native = serif.forms['𦈁'][0]
const viewBox = '0 0 1000 1000'

/** Copy a WenJin contour from the reviewed 率 drawings in font units into SVG coordinates.
 * @param {number} index */
function nativePath(index) {
  const [ops, coords] = serif.contours[index]
  const points = coords.split(' ').map(Number)
  const path = /** @type {[string, number[][]][]} */ (segments(commands(ops), points))
  return path.map(([kind, vertices]) =>
    kind + vertices.map(([x, y]) => x + ' ' + (ASCENT - y)).join(' ')
  ).join('') + 'Z'
}

// The first contour fuses the 幺 with the hook of 小. Close the hook between the
// two points where it meets the native cross stroke. Its three sides stay in place.
const hook = 'M257 779L257 877C257 894 252 899 236 899L152 899L152 915C227 921 236 940 236 962C314 962 320 898 320 878L320 771Z'
// The fourth dot also touches 幺. The reviewed alternate contains its separated outline.
const detachedDot = nativePath(serif.forms['𦈁'][2][13])
const nativeLeft = [nativePath(native[0]), nativePath(native[4])].join('')
const nativeRight = nativePath(native[9])
const surroundings = native.filter((_, i) => i !== 0 && i !== 4 && i !== 9).map(nativePath).join('')

/** @param {string} d */
function weightedRings(d) {
  // The KAGE paths have one decimal place. Offset their union by 4.2 units
  // in the 200-unit witness frame, before fitting the resulting ink to its slot.
  const polygons = splitSubpaths(d).map(path => parsePath(path).points.map(([x, y]) => ({
    X: Math.round(10 * x), Y: Math.round(10 * y),
  })))
  const joined = clipper.Clipper.SimplifyPolygons(polygons, clipper.PolyFillType.pftNonZero)
  const pen = new clipper.ClipperOffset(2, 1)
  pen.AddPaths(joined, clipper.JoinType.jtRound, clipper.EndType.etClosedPolygon)
  /** @type {clipper.Paths} */
  const weighted = []
  pen.Execute(weighted, 42)
  // Match the surrounding WenJin contours' winding where the strokes meet.
  return weighted.map(path => path.reverse().map(({ X, Y }) => [X, Y]))
}

/** @param {number[][][]} rings @param {number[]} slot */
function fitDrawing(rings, [x0, y0, x1, y1]) {
  const vertices = rings.flat()
  const xs = vertices.map(p => p[0]), ys = vertices.map(p => p[1])
  const xmin = Math.min(...xs), ymin = Math.min(...ys)
  const sx = (x1 - x0) / (Math.max(...xs) - xmin), sy = (y1 - y0) / (Math.max(...ys) - ymin)
  return rings.map(points => points.map(([x, y], i) =>
    (i ? 'L' : 'M') + (x0 + (x - xmin) * sx).toFixed(2) + ' ' + (y0 + (y - ymin) * sy).toFixed(2)
  ).join('') + 'Z').join('')
}

export { u26201Forms } from './yao-forms.js'

/** @type {Map<string,{rings:number[][][], paths:Map<number,string>}>} */
const fitted = new Map()
/** @typedef {string | {id:string} | null | undefined} Form */
/** @param {Form} form @param {number} site */
function component(form, site) {
  if (form == null) return site === 0 ? nativeLeft : nativeRight
  const id = typeof form === 'string' ? form : form.id
  let drawing = fitted.get(id)
  if (!drawing) {
    const choice = u26201Forms.find(option => option.id === id || option.text === id)
    const source = drawings.find(record => record.name === choice?.id)
    if (!choice || !source) throw new RangeError('Unknown 幺 form: ' + id)
    drawing = { rings: weightedRings(source.d), paths: new Map() }
    fitted.set(choice.id, drawing)
    fitted.set(choice.text, drawing)
  }
  let path = drawing.paths.get(site)
  if (!path) {
    path = fitDrawing(drawing.rings, slots[site])
    drawing.paths.set(site, path)
  }
  return (site === 0 ? hook : detachedDot) + path
}

/** Render either or both component choices in the original WenJin Mincho 𦈁.
 * Omit a choice to keep the complete native contour at that occurrence.
 * @param {Form} [left] @param {Form} [right] */
export function renderU26201(left, right) {
  return { viewBox, d: surroundings + component(left, 0) + component(right, 1) }
}
