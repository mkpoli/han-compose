// @ts-nocheck
import { derived, joinedDrawing, mapped, partInk, placed } from './geometry.js'

// Measured ink boxes in a 1000-unit em. Each row belongs to one leaf of the written IDS.
const specimens = {
  // 𤬑
  '⿱㼌瓜': {
    styles: ['fangsong', 'pen-writing'],
    cells: [
      [['瓜', [46, 401, 472, 829]], ['瓜', [520, 401, 946, 829]]],
      [['瓜', [118, -72, 889, 361]]],
    ],
  },
  // JYN00001 (與 variant: 與/与 upper hook ⿺㇉一 enclosing lower-left 卄)
  '⿹⿺㇉一卄': {
    styles: ['sans', 'serif', 'fangsong', 'regular', 'pen-writing'],
    cells: [
      [['与', [250, -80, 920, 820]], ['㇉', [310, -75, 920, 800]]],
      [['一', [405, 595, 795, 690]]],
      [['卄', [55, -10, 620, 410]], ['艹', [55, 25, 620, 395]]],
    ],
  },
}
const roots = new Set(Object.keys(specimens).map(key => [...key][0]))
export const containsSpecimen = (key, style) => Object.entries(specimens).some(([seq, plan]) => plan.styles.includes(style) && key.includes(seq))

export function specimenFor(node, style, keyOf) {
  if (!Array.isArray(node) || !roots.has(node[0])) return null
  const spec = specimens[keyOf(node)]
  return spec?.styles.includes(style) ? spec.cells : null
}

// Per-face layout for JYN00001 (⿹⿺㇉一卄): use native 与's upper hook+bar (dropping its lower 一)
// paired with native 艹 (shortening the two vertical 丨 tips where tall so 艹 stays compact under ⿺㇉一).
const JYU_HOOK_SPECS = {
  sans: {
    hookContours: [0, 3, 4], barContours: [1],
    yuBox: [220, -80, 910, 835],
    grass: '艹', grassBox: [55, 48, 625, 338], grassWeight: [0.10, 0.12], stemScale: 0.78,
  },
  serif: {
    hookContours: [0, 2, 4], barContours: [3],
    yuBox: [220, -80, 920, 835],
    grass: '艹', grassBox: [50, 48, 635, 344], grassWeight: [0.28, 0.24], stemScale: 0.78,
  },
  fangsong: {
    hookContours: [0],
    yuBox: [235, -95, 915, 830],
    grass: '艹', grassBox: [50, 62, 625, 342], grassWeight: [0.32, 0.32], stemScale: 0.64,
  },
  regular: {
    hookContours: [0],
    yuBox: [245, -75, 910, 815],
    grass: '卄', grassBox: [55, 52, 635, 346], grassWeight: [0.24, 0.24], stemScale: 0.44,
  },
  'pen-writing': {
    useStrokes: true,
    hookBox: [275, -80, 915, 805],
    barBox: [358, 592, 785, 690],
    grass: '艹', grassBox: [55, 58, 625, 342], grassWeight: [-0.30, -0.32], stemScale: 0.70,
  },
}

/** Shorten the vertical 丨 extensions of 艹 outside its crossbar band without thinning the bar. */
function shortenGrassStems(part, scale) {
  if (!scale || scale >= 0.999) return part
  const [l, b, r, t] = part.box
  const w = r - l
  // Find y range occupied by the wide horizontal crossbar (> 60% of glyph width).
  const bins = new Map()
  for (const c of part.contours) {
    const pts = c.light
    for (let i = 0; i < pts.length; i += 2) {
      const yb = Math.round(pts[i + 1] / 12) * 12
      const cur = bins.get(yb) ?? [Infinity, -Infinity]
      if (pts[i] < cur[0]) cur[0] = pts[i]
      if (pts[i] > cur[1]) cur[1] = pts[i]
      bins.set(yb, cur)
    }
  }
  const wide = [...bins.entries()].filter(([, [lo, hi]]) => (hi - lo) > w * 0.6).map(([y]) => y).sort((a, z) => a - z)
  if (!wide.length) return part
  const barBot = wide[0] - 12, barTop = wide[wide.length - 1] + 12
  const squeeze = pts => {
    const out = Float64Array.from(pts)
    for (let i = 1; i < out.length; i += 2) {
      if (out[i] > barTop) out[i] = barTop + (out[i] - barTop) * scale
      else if (out[i] < barBot) out[i] = barBot - (barBot - out[i]) * scale
    }
    return out
  }
  return derived(part, part.contours.map(c => ({ ...c, light: squeeze(c.light), heavy: squeeze(c.heavy ?? c.light) })))
}

function jyuHookParts(composer, region) {
  const spec = JYU_HOOK_SPECS[composer.fontStyle]
  if (!spec) return null
  const toRegion = box => mapped(box, [0, -120, 1000, 880], region)
  const rawGrass = (!composer.excluded(spec.grass) && composer.glyph(spec.grass)) ||
    (!composer.excluded('卄') && composer.glyph('卄'))
  if (!rawGrass) return null
  const grass = shortenGrassStems(rawGrass, spec.stemScale)
  const grassPart = {
    ...placed(grass, grass.box, toRegion(spec.grassBox), partInk(grass), `glyph ${spec.grass}`, spec.grassWeight),
    fixed: true,
  }
  if (spec.useStrokes) {
    const hook = composer.glyph('㇉'), bar = composer.glyph('一')
    if (!hook || !bar) return null
    return [
      { ...placed(hook, hook.box, toRegion(spec.hookBox), partInk(hook), 'glyph ㇉', [0, 0]), fixed: true },
      { ...placed(bar, bar.box, toRegion(spec.barBox), partInk(bar), 'glyph 一', [0, 0]), fixed: true },
      grassPart,
    ]
  }
  if (composer.excluded('与')) return null
  const yu = composer.glyph('与')
  if (!yu || yu.contours.length <= Math.max(...spec.hookContours, ...(spec.barContours ?? [0]))) return null
  const frameContours = [...spec.hookContours, ...(spec.barContours ?? [])].map(i => yu.contours[i])
  const framePart = derived(yu, frameContours)
  const frameTarget = toRegion(spec.yuBox)
  if (spec.barContours) {
    const hook = derived(yu, spec.hookContours.map(i => yu.contours[i]))
    const bar = derived(yu, spec.barContours.map(i => yu.contours[i]))
    return [
      { ...placed(hook, hook.box, mapped(hook.box, framePart.box, frameTarget), partInk(hook), '㇉ from 与', [0, 0]), fixed: true },
      { ...placed(bar, bar.box, mapped(bar.box, framePart.box, frameTarget), partInk(bar), '一 from 与', [0, 0]), fixed: true },
      grassPart,
    ]
  }
  return [
    { ...placed(framePart, framePart.box, frameTarget, partInk(framePart), '⿺㇉一 from 与', [0, 0]), fixed: true },
    grassPart,
  ]
}

export function specimenParts(composer, node, region, keyOf) {
  const cells = specimenFor(node, composer.fontStyle, keyOf)
  if (!cells) return null
  for (const ch of node.flat(Infinity)) if (composer.excluded(ch)) return null
  if (keyOf(node) === '⿹⿺㇉一卄') return jyuHookParts(composer, region)
  const out = []
  for (const cell of cells) {
    const pieces = []
    for (const [ch, box] of cell) {
      if (composer.excluded(ch)) return null
      const glyph = composer.glyph(ch)
      if (!glyph) return null
      const weight = ch === '瓜' && composer.fontStyle === 'pen-writing' && cell.length === 1 ? [0.54, 0] : [0, 0]
      pieces.push({ ...placed(glyph, glyph.box, mapped(box, [0, -120, 1000, 880], region),
        partInk(glyph), `glyph ${ch}`, weight), fixed: true })
    }
    out.push(pieces.length === 1 ? pieces[0] : joinedDrawing(pieces, `components ${cell.map(([ch]) => ch).join('')}`))
  }
  return out
}
