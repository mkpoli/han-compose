// @ts-check
import { contours } from 'd3-contour'
import { correspondingInk, weightedField } from './mix-contours.js'
import { STROKE } from './slot-placeholder.js'
import { ASCENT, fill, pathRings, pointsBox, union } from './geometry.js'
import { groupParts } from './group-parts.js'
import { compose, sketch } from './loader.js'

export const FONT_STYLES = /** @type {const} */ (['sans', 'serif', 'fangsong', 'regular', 'pen-writing'])
/** @typedef {typeof FONT_STYLES[number]} FontStyle */
/** @typedef {{ shares: Partial<Record<FontStyle, number>>, weight?: number }} FontMix */
/** @typedef {import('./index.js').Drawing} Drawing */

/** Validate before requesting any export. Shares are relative, and weight is a stroke-width multiplier.
 * @param {FontMix} mix */
export function activeFaces({ shares, weight = 1 }) {
  if (!Number.isFinite(weight) || weight < 0.65 || weight > 1.5)
    throw new RangeError('Stroke weight must be between 0.65 and 1.5.')
  if (!shares || Object.keys(shares).some((key) => !FONT_STYLES.some((style) => style === key)))
    throw new TypeError('Unknown font style.')
  const active = FONT_STYLES.map((style) => ({ style, share: shares[style] ?? 0 }))
  if (active.some(({ share }) => !Number.isFinite(share) || share < 0))
    throw new RangeError('Font shares must be finite and nonnegative.')
  const max = Math.max(...active.map((face) => face.share))
  if (!max) throw new RangeError('Give at least one font a positive share.')
  const total = active.reduce((sum, face) => sum + face.share / max, 0)
  return active
    .filter((face) => face.share > 0)
    .map((face) => ({ style: face.style, share: face.share / max / total }))
}

/** Two chamfer passes measure the distance to the nearest pixel of the other colour.
 * @param {Uint8Array} mask @param {number} side */
function signedDistance(mask, side) {
  const d = new Float32Array(mask.length)
  for (let i = 0; i < d.length; i++) {
    const edge =
      (i % side && mask[i] !== mask[i - 1]) ||
      (i % side < side - 1 && mask[i] !== mask[i + 1]) ||
      (i >= side && mask[i] !== mask[i - side]) ||
      (i < d.length - side && mask[i] !== mask[i + side])
    d[i] = edge ? 0.5 : side
  }
  for (const step of [1, -1]) {
    for (let j = 0; j < d.length; j++) {
      const i = step === 1 ? j : d.length - 1 - j
      const prev = i - step,
        row = i - step * side
      const beside = step === 1 ? i % side > 0 : i % side < side - 1
      if (beside) d[i] = Math.min(d[i], d[prev] + 1)
      if (row < 0 || row >= d.length) continue
      d[i] = Math.min(d[i], d[row] + 1)
      if (beside) d[i] = Math.min(d[i], d[row - step] + Math.SQRT2)
      if (step === 1 ? i % side < side - 1 : i % side > 0) d[i] = Math.min(d[i], d[row + step] + Math.SQRT2)
    }
  }
  return d.map((value, i) => (mask[i] ? value : -value))
}

/** Register each outline to the weighted ink bounds before interpolating its distance field.
 * @param {string[]} paths @param {number[]} shares @param {number} weight */
function mixInk(paths, shares, weight) {
  if (weight === 1 && paths.every((path) => path === paths[0])) return paths[0]
  const shapes = paths.map((path) => pathRings(path))
  const bounds = shapes.map((rings) => (rings.length ? union(rings.map(pointsBox)) : null))
  const occupied = bounds.reduce((s, b, i) => s + (b ? shares[i] : 0), 0)
  if (!occupied) return ''
  const box = [0, 1, 2, 3].map((k) => bounds.reduce((s, b, i) => s + (b ? (b[k] * shares[i]) / occupied : 0), 0))
  const width = box[2] - box[0],
    height = box[3] - box[1]
  if (!(width > 0 && height > 0)) return ''
  const side = 256,
    pitch = (Math.max(width, height) * Math.max(1, weight)) / (side - 32)
  const left = (box[0] + box[2] - pitch * side) / 2,
    top = (box[1] + box[3] + pitch * side) / 2
  /** @type {{ mask: Uint8Array, share: number }[]} */
  const masks = []
  const tracer = contours().size([side, side])
  /** @type {number[][][][][]} */
  const polygonsByFace = []
  shapes.forEach((rings, i) => {
    const b = bounds[i]
    if (!b || b[2] <= b[0] || b[3] <= b[1]) return
    const sx = (b[2] - b[0]) / width,
      sy = (b[3] - b[1]) / height
    const x = b[0] + (left - box[0]) * sx,
      y = b[3] + (top - box[3]) * sy
    const mask = fill(rings, side, [x, y - pitch * side * sy, x + pitch * side * sx, y])
    polygonsByFace.push(tracer.contour(Array.from(mask), 0.5).coordinates)
    masks.push({ mask, share: shares[i] / occupied })
  })
  let polygons = polygonsByFace.length === shares.length ? correspondingInk(polygonsByFace, shares) : null
  if (!polygons) {
    const field = new Float32Array(side * side)
    let ink = 0
    for (const { mask, share } of masks) {
      const distances = signedDistance(mask, side)
      for (let k = 0; k < mask.length; k++) {
        field[k] += share * distances[k]
        ink += share * mask[k]
      }
    }
    if (ink < 1) return ''
    const levels = field.slice().sort(),
      at = levels.length - Math.round(ink)
    const level = (levels[at] + levels[Math.max(0, at - 1)]) / 2
    polygons = tracer.contour(Array.from(field), level).coordinates
  }
  if (weight !== 1) {
    const mask = fill(
      polygons.flat().map((ring) => ring.flatMap(([x, y]) => [x, -y])),
      side,
      [0, -side, side, 0]
    )
    polygons = tracer.contour(weightedField(mask, side, weight), 0).coordinates
  }
  const round = (/** @type {number} */ value) => Math.round(value * 10) / 10
  return polygons
    .flat()
    .map(
      (ring) =>
        ring
          .slice(0, -1)
          .reverse()
          .map(([x, y], i) => (i ? 'L' : 'M') + round(left + x * pitch) + ' ' + round(ASCENT - top + y * pitch))
          .join('') + 'Z'
    )
    .join('')
}

/** @param {number[][]} boxes @param {number[]} shares */
const mixBox = (boxes, shares) => boxes[0].map((_, k) => boxes.reduce((n, b, i) => n + shares[i] * b[k], 0))

/** Match pieces by their IDS operand even when the faces chose different donor characters.
 * @param {Drawing} drawing @param {import('./index.js').SketchLeaf[] | null | undefined} leaves */
function groupedDrawing(drawing, leaves) {
  if (!leaves || !drawing.parts?.length) return drawing
  const pieces = drawing.parts
  const groups = groupParts(pieces, leaves)
  if (!groups) return drawing
  const parts = groups.flatMap((group) =>
    [false, true].flatMap((cut) => {
      const selected = group.parts.map((i) => pieces[i]).filter((p) => !!p.cut === cut)
      if (!selected.length) return []
      const boxes = selected.map((p) => p.box)
      const x = Math.min(...boxes.map((b) => b[0])),
        y = Math.min(...boxes.map((b) => b[1]))
      const box = [
        x,
        y,
        Math.max(...boxes.map((b) => b[0] + b[2])) - x,
        Math.max(...boxes.map((b) => b[1] + b[3])) - y
      ]
      return [
        {
          leaf: group.index,
          cut,
          box,
          d: selected.map((p) => p.d).join(''),
          origin: [...new Set(selected.map((p) => p.origin))].join(' / ')
        }
      ]
    })
  )
  return { ...drawing, parts }
}

/** Mix the composer's y-down outlines before the preview restores any text emoji.
 * @param {Drawing[]} drawings @param {number[]} shares @param {number} weight
 * @param {(import('./index.js').SketchLeaf[] | null)[]} [sketches] */
export function mixDrawings(drawings, shares, weight, sketches = []) {
  if (drawings.length === 1 && weight === 1) return drawings[0]
  drawings = drawings.map((drawing, i) => groupedDrawing(drawing, sketches[i]))
  const first = drawings[0]
  const parts = first.parts ?? []
  const matched =
    parts.length > 0 &&
    drawings.every(
      (d) =>
        d.parts?.length === parts.length &&
        d.parts.every(
          (p, i) =>
            p.leaf === parts[i].leaf &&
            !!p.cut === !!parts[i].cut &&
            (Number.isInteger(p.leaf) || p.origin === parts[i].origin)
        )
    )
  const mixed = matched
    ? parts.map((p, i) => {
        const pieces = drawings.map((d) => /** @type {NonNullable<Drawing['parts']>} */ (d.parts)[i])
        return {
          leaf: p.leaf,
          cut: p.cut,
          origin: [...new Set(pieces.map((piece) => piece.origin))].join(' / '),
          box: mixBox(
            pieces.map((piece) => piece.box),
            shares
          ),
          d: mixInk(
            pieces.map((piece) => piece.d),
            shares,
            weight
          )
        }
      })
    : []
  const ink = (/** @type {boolean} */ cut) =>
    matched
      ? mixed
          .filter((p) => !!p.cut === cut)
          .map((p) => p.d)
          .join('')
      : mixInk(
          drawings.map((d) => (cut ? d.cut : d.d) ?? ''),
          shares,
          weight
        )
  return {
    d: ink(false),
    cut: ink(true),
    parts: mixed,
    origins: [...new Set(drawings.flatMap((d) => d.origins ?? []))],
    slots: first.slots?.map((slot, i) => ({
      ...slot,
      box: mixBox(
        drawings.map((d) => d.slots?.[i]?.box ?? slot.box),
        shares
      )
    })),
    leaves: first.leaves,
    normalization: { capped: drawings.some(d => d.normalization?.capped) },
    ...(drawings.every(d => d.cells) ? {cells:true} : {}),
    kanjivg: drawings.some((d) => d.kanjivg),
    approximate: [...new Set(drawings.flatMap((d) => d.approximate ?? []))],
    missing: [...new Set(drawings.flatMap((d) => d.missing ?? []))],
    stroke: [0, 1].map(
      (k) => weight * drawings.reduce((sum, d, i) => sum + shares[i] * (d.stroke?.[k] ?? STROKE), 0)
    )
  }
}

/** Compose from any combination of the five face exports, in a browser or on the server.
 * @param {Partial<Record<FontStyle, Parameters<typeof compose>[0]>>} sources
 * @param {string} sequence @param {FontMix} mix @param {Parameters<typeof compose>[2]} [options] */
export async function composeMixed(sources, sequence, mix, options) {
  const faces = activeFaces(mix)
  const results = await Promise.all(
    faces.map(async ({ style }) => {
      if (!sources[style]) throw new TypeError('Missing source for ' + style)
      const config = { ...options, fontStyle: style }
      const drawing = await compose(sources[style], sequence, config)
      const leaves = faces.length === 1 && (mix.weight ?? 1) === 1 ? null : await sketch(sources[style], sequence, config)
      return { drawing, leaves }
    })
  )
  return mixDrawings(
    results.map((r) => r.drawing),
    faces.map((face) => face.share),
    mix.weight ?? 1,
    results.map((r) => r.leaves)
  )
}
