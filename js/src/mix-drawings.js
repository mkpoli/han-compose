// @ts-check
import { contours } from 'd3-contour'
import {
  alignRings,
  groupRegions,
  matchRegions,
  prepareCorrespondence,
  sharedIslands,
  splitIslands,
  tangled,
  prepareWeight
} from './mix-contours.js'
import { inkPolygons, outlinePath, limitDisplacement } from './mix-outline.js'
import { STROKE } from './slot-placeholder.js'
import { ASCENT, fill, pathRings, pointsBox, union } from './geometry.js'
import { groupParts } from './group-parts.js'

/** @typedef {import('./index.js').Drawing} Drawing */

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

/** The expensive geometry depends only on the source paths. Bound the working set
 * across glyphs and instances; dragging a handle only supplies new coefficients.
 * @type {Map<string, ReturnType<typeof prepareInk>>} */
const outlines = new Map()

/** @param {string} d */
const pathSubpaths = (d) => d.match(/M/g)?.length ?? 0

/** Sets of strokes that can be blended on their own: in every face the set's contours
 * belong to no stroke outside it. Faces that draw each stroke as its own contour give
 * one unit per stroke; a face that fuses strokes into one contour joins them.
 * @param {([number, number[]][] | undefined)[]} labels each face's strokes and their contours
 * @param {number[]} counts each face's contour count
 * @returns {number[][][] | null} per unit, each face's contour indices */
function strokeUnits(labels, counts) {
  if (labels.some((strokes) => !strokes?.length)) return null
  const faces = /** @type {[number, number[]][][]} */ (labels)
  const ids = faces[0].map(([id]) => id).sort((a, b) => a - b)
  if (faces.some((strokes) => strokes.length !== ids.length || strokes.some(([id]) => !ids.includes(id))))
    return null
  /** @type {Map<number, number>} */
  const parent = new Map(ids.map((id) => [id, id]))
  const root = (/** @type {number} */ id) => {
    while (parent.get(id) !== id) id = /** @type {number} */ (parent.get(id))
    return id
  }
  for (const [f, strokes] of faces.entries()) {
    /** @type {Map<number, number>} */
    const owner = new Map()
    const covered = new Set(strokes.flatMap(([, contours]) => contours))
    // Contours no stroke claims would be left out of every unit.
    if (covered.size !== counts[f] || [...covered].some((c) => c < 0 || c >= counts[f])) return null
    for (const [id, contours] of strokes)
      for (const contour of contours) {
        const other = owner.get(contour)
        if (other === undefined) owner.set(contour, id)
        else parent.set(root(id), root(other))
      }
  }
  /** @type {Map<number, number[][]>} */
  const units = new Map()
  for (const id of ids)
    if (!units.has(root(id)))
      units.set(
        root(id),
        faces.map(() => [])
      )
  faces.forEach((strokes, f) => {
    for (const [id, contours] of strokes) {
      const list = /** @type {number[][]} */ (units.get(root(id)))[f]
      for (const contour of contours) if (!list.includes(contour)) list.push(contour)
    }
  })
  const all = [...units.values()]
  return all.length > 1 && all.every((unit) => unit.every((contours) => contours.length)) ? all : null
}

/** @param {string[]} paths @param {([number, number[]][] | undefined)[]} [strokes] */
function prepareInk(paths, strokes) {
  /** @type {number[][][]} */
  const shapes = paths.map((path) => pathRings(path, 12))
  const boxes = shapes.map((r) => (r.length ? union(r.map(pointsBox)) : null))
  const present = boxes.flatMap((b, i) => (b && b[2] > b[0] && b[3] > b[1] ? [i] : []))
  if (!present.length) return () => ''
  const bounds = present.map((i) => /** @type {number[]} */ (boxes[i]))
  const width = bounds.reduce((s, b) => s + b[2] - b[0], 0) / bounds.length
  const height = bounds.reduce((s, b) => s + b[3] - b[1], 0) / bounds.length
  const side = 256,
    pad = 16,
    scale = (side - 2 * pad) / Math.max(width, height)
  const spanX = width * scale,
    spanY = height * scale
  const registered = present.map((k, i) =>
    shapes[k].map((r) =>
      r.map((v, j) =>
        j % 2
          ? pad + ((bounds[i][3] - v) * spanY) / (bounds[i][3] - bounds[i][1])
          : pad + ((v - bounds[i][0]) * spanX) / (bounds[i][2] - bounds[i][0])
      )
    )
  )
  /** Regions whose islands were cut from larger ones. @type {WeakSet<object>} */
  const cuts = new WeakSet()
  /** Correspondences already worked out for a region. @type {WeakMap<object, ReturnType<typeof prepareCorrespondence>>} */
  const prepared = new WeakMap()
  const blendOf = (/** @type {number[][][][][]} */ region) => {
    if (!prepared.has(region)) prepared.set(region, prepareCorrespondence(region, cuts.has(region)))
    return prepared.get(region) ?? null
  }
  /** Faces that split the ink into different numbers of islands still match the
   * islands they share; only the groups that differ fall back to distance fields.
   * @param {number[][][][][]} polygons */
  const pairedRegions = (polygons) => {
    const matched = matchRegions(polygons, (p) => p[0])
    if (matched?.[0].length) return matched[0].map((_, i) => matched.map((p) => [p[i]]))
    let split = matched ? null : splitIslands(polygons)
    if (split) {
      for (const region of split) cuts.add(region)
      // The narrowest neck can lie partway along a stroke that runs into its neighbour, and
      // the piece left holding the rest of that stroke then matches nothing. Cutting at the
      // outline's notches instead is kept where it leaves more pieces with a counterpart.
      const unmatched = (/** @type {number[][][][][][]} */ regions) =>
        regions.filter((region) => !blendOf(region)).length
      const strain = (/** @type {number[][][][][][]} */ regions) =>
        regions.reduce((sum, region) => sum + (blendOf(region)?.strain ?? 0), 0)
      if (unmatched(split)) {
        const anchored = splitIslands(polygons, 'notch')
        if (anchored) {
          for (const region of anchored) cuts.add(region)
          if (unmatched(anchored) < unmatched(split)) split = anchored
        }
      }
      // Where the pieces still blend with strain, the nearest outline has likely put a
      // stroke with the wrong piece; a cut chosen by how the pieces fit is kept if it eases it.
      if (unmatched(split) || strain(split) > 0.08) {
        const fitted = splitIslands(polygons, 'fit')
        if (fitted) {
          for (const region of fitted) cuts.add(region)
          const fewer = unmatched(fitted) - unmatched(split)
          if (fewer < 0 || (!fewer && strain(fitted) < strain(split) - 0.03)) split = fitted
        }
      }
      return split
    }
    const grouped = matched ? [] : groupRegions(polygons, (p) => p[0], 0.06 * side)
    return grouped.length ? grouped : [polygons]
  }
  /** Each face can also run together strokes the other keeps apart, and its islands then
   * pair with islands that hold other strokes. Cutting both faces to the pieces they share
   * is kept where more of the ink then blends outline to outline, or blends with less strain.
   * @param {number[][][][][]} polygons */
  const regionsOf = (polygons) => {
    const paired = pairedRegions(polygons)
    const shared = sharedIslands(polygons)
    if (!shared) return paired
    const area = (/** @type {number[][][][][]} */ region) =>
      region[0].reduce(
        (sum, island) =>
          sum +
          Math.abs(
            island[0].reduce((twice, p, i, ring) => {
              const q = ring[(i + 1) % ring.length]
              return twice + p[0] * q[1] - q[0] * p[1]
            }, 0)
          ) /
            2,
        0
      )
    /** Ink left to the distance field, and the strain of the rest.
     * @param {number[][][][][][]} regions */
    const judged = (regions) => {
      let lost = 0,
        strain = 0
      for (const region of regions) {
        const blend = cuts.has(region) ? blendOf(region) : prepareCorrespondence(region, true)
        if (blend) strain += blend.strain
        else lost += area(region)
      }
      return { lost, strain }
    }
    const regions = shared.map(({ region }) => region)
    for (const { region, cut } of shared) if (cut) cuts.add(region)
    const was = judged(paired),
      now = judged(regions)
    const total = paired.reduce((sum, region) => sum + area(region), 0) || 1
    const gained = (was.lost - now.lost) / total
    return gained > 0.02 || (gained > -0.02 && now.strain < was.strain - 0.05) ? regions : paired
  }
  // Blend stroke by stroke where the faces label their strokes alike. A stroke is a
  // simple shape whose corners match reliably; the union of several is not.
  const units = strokeUnits(
    present.map((k) => strokes?.[k]),
    present.map((k) => (pathSubpaths(paths[k]) === shapes[k].length ? shapes[k].length : -1))
  )
  // Faces that number their strokes differently, or fuse a perpendicular stroke into
  // one unit (such as | vs ┌ on 口 or 門), would tear the shared bar apart if blended per unit.
  const alike =
    units?.every((unit) => {
      const boxes = unit.map((contours, f) => union(contours.map((c) => pointsBox(registered[f][c]))))
      const centres = boxes.map(([a, b, c, d]) => [(a + c) / 2, (b + d) / 2])
      for (let i = 0; i < centres.length; i++)
        for (let j = i + 1; j < centres.length; j++)
          if (Math.hypot(centres[i][0] - centres[j][0], centres[i][1] - centres[j][1]) >= 0.3 * side)
            return false
      const ws = boxes.map(([a, , c]) => Math.max(1, c - a))
      const hs = boxes.map(([, b, , d]) => Math.max(1, d - b))
      const minW = Math.min(...ws),
        maxW = Math.max(...ws)
      if (maxW - minW > 0.15 * side && maxW / minW > 3) return false
      const minH = Math.min(...hs),
        maxH = Math.max(...hs)
      if (maxH - minH > 0.15 * side && maxH / minH > 3) return false
      return true
    }) ?? false
  const regions =
    units && alike
      ? units.flatMap((unit) =>
          regionsOf(unit.map((contours, f) => inkPolygons(contours.map((c) => registered[f][c]))))
        )
      : regionsOf(registered.map(inkPolygons))
  // Regions without a contour correspondence share one distance field, which keeps
  // their strokes registered to each other.
  const matched = regions.map(blendOf)
  /** @type {((shares: number[], weight: number) => number[][][])[]} */
  const blenders = matched.flatMap((blend) => blend ?? [])
  const rest = regions.filter((_, i) => !matched[i])
  if (rest.length)
    blenders.push(
      prepareFields(
        registered.map((_, f) => rest.flatMap((region) => region[f].flat().map((r) => r.flat()))),
        side
      )
    )
  return (/** @type {number[]} */ shares, /** @type {number} */ weight) => {
    const total = present.reduce((n, i) => n + shares[i], 0)
    const proportion = present.map((i) => shares[i] / total)
    const b = mixBox(bounds, proportion)
    const box = [b[0], ASCENT - b[3], b[2] - b[0], b[3] - b[1]]
    // An absent donor contributes no ink. Scale the area by the occupied
    // share before tracing so a tiny new operand (or subtraction) grows in.
    const size = Math.sqrt(Math.min(1, total))
    box[0] += (box[2] * (1 - size)) / 2
    box[1] += (box[3] * (1 - size)) / 2
    box[2] *= size
    box[3] *= size
    const rings = blenders.flatMap((blend) => blend(proportion, weight))
    return rings.map((r) => outlinePath(r, box, box[2] / spanX, box[3] / spanY, pad)).join('')
  }
}

/** The inverse cumulative ink profile. Registering row and column mass aligns nearby
 * stems even when a counter is open in one face. A uniform component bounds the warp.
 * @param {Float32Array} mass */
function quantileMap(mass) {
  const side = mass.length,
    total = mass.reduce((s, n) => s + n, 0),
    floor = Math.max(0.001, (total / side) * 0.55)
  const map = new Float32Array(side)
  let j = 0,
    sum = 0
  for (let i = 0; i < side; i++) {
    const q = ((i + 0.5) * (total + floor * side)) / side
    while (j < side - 1 && sum + mass[j] + floor < q) {
      sum += mass[j] + floor
      j++
    }
    map[i] = Math.min(side - 0.5, Math.max(0.5, j + (q - sum) / (mass[j] + floor)))
  }
  return map
}
/** @param {number} at @param {Float32Array} map */
function mappedPosition(at, map) {
  const u = Math.max(0, Math.min(map.length - 1, at - 0.5)),
    i = Math.floor(u)
  return map[i] + (u - i) * (map[Math.min(i + 1, map.length - 1)] - map[i])
}

/** Sample coverage at subpixel precision before tracing unrelated topologies.
 * @param {number[][][]} shapes @param {number} side */
function prepareFields(shapes, side) {
  const samples = 3,
    hi = side * samples
  const fields = shapes.map((rings) => {
    const up = fill(
      rings.map((r) => r.map((v, i) => (i % 2 ? -v : v))),
      hi,
      [0, -side, side, 0]
    )
    const coverage = new Float32Array(side * side)
    for (let y = 0; y < hi; y++)
      for (let x = 0; x < hi; x++)
        coverage[Math.floor(y / samples) * side + Math.floor(x / samples)] +=
          up[y * hi + x] / (samples * samples)
    const field = signedDistance(
      Uint8Array.from(coverage, (v) => Number(v >= 0.5)),
      side
    )
    let ink = 0
    for (let i = 0; i < field.length; i++) {
      ink += coverage[i]
      if (coverage[i] > 0 && coverage[i] < 0.9999) field[i] = coverage[i] - 0.5
    }
    const rows = new Float32Array(side),
      cols = new Float32Array(side)
    for (let i = 0; i < field.length; i++) {
      rows[Math.floor(i / side)] += coverage[i]
      cols[i % side] += coverage[i]
    }
    const xMap = quantileMap(cols),
      yMap = quantileMap(rows)
    const warped = new Float32Array(field.length)
    ink = 0
    for (let y = 0; y < side; y++) {
      const v = yMap[y] - 0.5,
        y0 = Math.floor(v) * side,
        y1 = Math.min(y0 + side, field.length - side),
        fy = v - Math.floor(v)
      for (let x = 0; x < side; x++) {
        const u = xMap[x] - 0.5,
          a = Math.floor(u),
          b = Math.min(a + 1, side - 1),
          fx = u - a
        const top = field[y0 + a] * (1 - fx) + field[y0 + b] * fx,
          bottom = field[y1 + a] * (1 - fx) + field[y1 + b] * fx
        const value = top + (bottom - top) * fy
        warped[y * side + x] = value
        ink += Math.max(0, Math.min(1, value + 0.5))
      }
    }
    return { field: warped, ink, xMap, yMap }
  })
  const trace = contours().size([side, side])
  let key = ''
  /** @type {number[][][]} */
  let rings = []
  /** @type {ReturnType<typeof prepareWeight>|undefined} */
  let weighted
  return (/** @type {number[]} */ shares, /** @type {number} */ weight) => {
    const next = shares.join(',')
    if (key !== next) {
      const combined = new Float32Array(side * side)
      let ink = 0
      fields.forEach(({ field, ink: area }, f) => {
        ink += area * shares[f]
        for (let i = 0; i < field.length; i++) combined[i] += field[i] * shares[f]
      })
      if (ink < 0.5) return []
      const ordered = combined.slice().sort(),
        i = ordered.length - Math.round(ink)
      const level = (ordered[i] + ordered[i - 1]) / 2
      const xMap = new Float32Array(side),
        yMap = new Float32Array(side)
      fields.forEach((f, k) => {
        for (let i = 0; i < side; i++) {
          xMap[i] += shares[k] * f.xMap[i]
          yMap[i] += shares[k] * f.yMap[i]
        }
      })
      rings = trace
        .contour(Array.from(combined), level)
        .coordinates.flat()
        .map((r) => r.map(([x, y]) => [mappedPosition(x, xMap), mappedPosition(y, yMap)]))
      weighted = undefined
      key = next
    }
    if (weight === 1) return rings
    weighted ??= prepareWeight(rings)
    return weighted(weight)
  }
}

/** @param {string[]} paths @param {number[]} shares @param {number} weight
 * @param {([number, number[]][] | undefined)[]} [strokes] */
function drawInk(paths, shares, weight, strokes) {
  const same = paths.every((path) => path === paths[0])
  if (same && weight === 1) return paths[0]
  const key = JSON.stringify(strokes?.some(Boolean) ? [paths, strokes] : paths)
  let render = outlines.get(key)
  if (render) outlines.delete(key)
  else render = prepareInk(paths, strokes)
  outlines.set(key, render)
  if (outlines.size > 24) outlines.delete(/** @type {string} */ (outlines.keys().next().value))
  const drawing = render(shares, weight)
  // A single master uses its exact Béziers at neutral weight. Bound the small
  // rounding error of its reconstructed contour as the weight moves away.
  const change = Math.abs(weight - 1)
  if (same && change < 0.04 && drawing) {
    const radius = (200 * change) / (1 - change / 0.04)
    if (radius < 1000) return limitDisplacement(drawing, paths[0], radius)
  }
  return drawing
}

/** Bound how much a small contribution can move the visible edge, even if adding
 * its donor changes the topology or which master establishes correspondence.
 * @param {number[]} shares */
function* boundaries(shares) {
  const order = shares.map((_, i) => i).sort((a, b) => shares[b] - shares[a])
  let tail = 0
  for (let k = order.length - 1; k > 0; k--) {
    tail += shares[order[k]]
    if (tail >= 0.18) break
    const separation = 1 - shares[order[k]] / shares[order[k - 1]]
    const radius = (350 * tail) / ((1 - tail / 0.18) * separation)
    const indices = order.slice(0, k).sort((a, b) => a - b)
    const settled = 1 - (1 - tail / 0.18) * separation
    yield { indices, proportion: indices.map((i) => shares[i] / (1 - tail)), radius, settled }
  }
}

/** The outline part-way from the mix its larger shares give alone to the full mix.
 * A face with a small share can change which strokes are matched together, so the two
 * outlines differ by more than that share; moving between them point by point keeps
 * the edge whole where clipping one to the other leaves scraps. Islands the two
 * outlines do not share one-to-one are clipped to the band as before.
 * @param {string} edge @param {string} full @param {number} amount 0 gives `edge`, 1 gives `full`
 * @param {number} radius the band for islands that cannot be moved */
function settleOutline(edge, full, amount, radius) {
  if (amount < 1e-4) return edge
  // A band this wide bounds nothing.
  const bound = (/** @type {string} */ d) => (radius < 1000 ? limitDisplacement(d, edge, radius) : d)
  if (!edge || !full) return bound(full)
  const scale = 256 / 1000
  const polygons = [edge, full].map((d) =>
    inkPolygons(
      pathRings(d, 12).map((/** @type {number[]} */ r) => r.map((v, i) => (i % 2 ? ASCENT - v : v) * scale))
    )
  )
  const place = (/** @type {number} */ v) => Math.round((v / scale) * 100) / 100
  const path = (/** @type {number[][]} */ ring) =>
    ring
      .slice()
      .reverse()
      .map(([x, y], n) => (n ? 'L' : 'M') + place(x) + ' ' + place(y))
      .join('') + 'Z'
  let moved = '',
    rest = ''
  for (const [from, to] of groupRegions(polygons, (p) => p[0], 0.06 * 256)) {
    const counters =
      from.length === 1 && to.length === 1 && from[0].length === to[0].length
        ? matchRegions([from[0].slice(1), to[0].slice(1)], (r) => r)
        : null
    const rings = counters && [from, to].map((island, f) => [island[0][0], ...counters[f]])
    const aligned = rings?.[0].map((ring, j) => alignRings([ring, rings[1][j]]))
    const between =
      aligned?.every(Boolean) &&
      /** @type {number[][][][]} */ (aligned).map((pair) =>
        pair[0].map((p, n) => [
          p[0] + (pair[1][n][0] - p[0]) * amount,
          p[1] + (pair[1][n][1] - p[1]) * amount
        ])
      )
    // Matched points can still carry a counter across its frame part of the way.
    if (between && !tangled(between)) for (const ring of between) moved += path(ring)
    else for (const island of to) for (const ring of island) rest += path(ring.slice(0, -1))
  }
  return moved + (rest && bound(rest))
}

/** @param {string[]} paths @param {number[]} shares @param {number} weight
 * @param {([number, number[]][] | undefined)[]} [strokes] */
function mixInk(paths, shares, weight, strokes) {
  let d = drawInk(paths, shares, weight, strokes)
  for (const { indices, proportion, radius, settled } of boundaries(shares)) {
    const edge = drawInk(
      indices.map((i) => paths[i]),
      proportion,
      weight,
      strokes && indices.map((i) => strokes[i])
    )
    d = settleOutline(edge, d, settled, radius)
  }
  return d
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
          // Contour indices stay valid only while the piece stands alone.
          strokes: selected.length === 1 ? selected[0].strokes : undefined,
          origin: [...new Set(selected.map((p) => p.origin))].join(' / ')
        }
      ]
    })
  )
  return { ...drawing, parts }
}

/** Mix the composer's y-down outlines before the preview restores any text emoji.
 * @param {Drawing[]} drawings @param {number[]} shares @param {number} weight
 * @param {(import('./index.js').SketchLeaf[] | null)[]} [sketches]
 * @returns {Drawing} */
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
            weight,
            pieces.map((piece) => piece.strokes)
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
      : drawInk(
          drawings.map((d) => (cut ? d.cut : d.d) ?? ''),
          shares,
          weight
        )
  let d = ink(false),
    cut = ink(true)
  if (!matched)
    for (const { indices, proportion, radius, settled } of boundaries(shares)) {
      // Losing a donor may restore operand-level matching. Use that actual drawing
      // as the limit, not a whole-glyph approximation of the remaining faces.
      const edge = mixDrawings(
        indices.map((i) => drawings[i]),
        proportion,
        weight
      )
      if (d || edge.d) d = settleOutline(edge.d, d, settled, radius)
      if (cut || edge.cut) cut = settleOutline(edge.cut ?? '', cut, settled, radius)
    }
  return {
    d,
    cut,
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
    normalization: { capped: drawings.some((d) => d.normalization?.capped) },
    ...(drawings.every((d) => d.cells) ? { cells: true } : {}),
    kanjivg: drawings.some((d) => d.kanjivg),
    approximate: [...new Set(drawings.flatMap((d) => d.approximate ?? []))],
    missing: [...new Set(drawings.flatMap((d) => d.missing ?? []))],
    stroke: [0, 1].map(
      (k) => weight * drawings.reduce((sum, d, i) => sum + shares[i] * (d.stroke?.[k] ?? STROKE), 0)
    )
  }
}
