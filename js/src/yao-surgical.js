// @ts-check
import constants from './constants.json' with { type: 'json' }
import hostsIndex from './yao-hosts.json' with { type: 'json' }
import { ASCENT, derived, fill, makePart, mapped, partInk, pathRings, placed, pointsBox, rings, svgPath, union } from './geometry.js'
import { prepareWeight } from './mix-contours.js'
import { tokens } from './tokens.js'
import { arity, splitToneMarks } from './tree.js'
import { svgPart, yaoPart } from './u26201-part.js'
import { resolveYaoForm, u26201Forms } from './yao-forms.js'
import { yaoDecomposition, yaoOccurrences } from './yao-occurrences.js'

/** @typedef {{ indices: number[], box: number[], score: number, rawScore: number }} YaoGroup */
/** @typedef {{ host: string, paths: number[][], edits: { index: number, path: number[], formId: string }[] }} CollapsedYaoHost */

/** @type {Record<string, [string, string, number]>} */
const hostDescriptions = /** @type {any} */ (hostsIndex.descriptions)
const variantTokens = u26201Forms.flatMap(form => [form.text, ...form.aliases])

/** Fast check before parsing whether a sequence contains any explicit 幺 variant token.
 * @param {string} text */
export function containsYaoVariant(text) {
  for (const token of variantTokens) if (text.includes(token)) return true
  return false
}

/** Lazily built reverse index from documented IDS expansion to its canonical single-character host.
 * @type {Map<string, string> | null} */
let reverseHosts = null
function hostByExpansion() {
  if (reverseHosts) return reverseHosts
  reverseHosts = new Map()
  for (const [ch, [ids]] of Object.entries(hostDescriptions)) {
    const single = [...ch].length === 1
    if (!single && !/^\{[0-9]+\}$/.test(ch)) continue
    const prev = reverseHosts.get(ids)
    // Prefer single BMP code points if two keys share one documented decomposition.
    if (!prev || (single && ([...prev].length !== 1 || /** @type {number} */ (ch.codePointAt(0)) < /** @type {number} */ (prev.codePointAt(0))))) {
      reverseHosts.set(ids, ch)
    }
  }
  return reverseHosts
}

const NUMBERED_ALIAS = /^&X-0*([0-9]{1,4});$/
/** Normalize a single token back to plain 幺 / {n} for reverse host lookup.
 * @param {string} token */
function normalizeLeaf(token) {
  if (resolveYaoForm(token)) return '幺'
  const numbered = NUMBERED_ALIAS.exec(token)
  return numbered ? `{${numbered[1]}}` : token
}

/** Parse `text` into a lightweight tree and collapse every subtree bottom-up to its documented host.
 * @param {string} text @param {((seq: string) => string | null) | null} [lookupEncoded]
 * @returns {{ key: string, hosts: Set<string> } | null} */
function collapseTree(text, lookupEncoded = null) {
  const list = tokens(text)
  if (!list.length) return null
  const byIds = hostByExpansion()
  const hosts = new Set()
  let at = 0
  /** @returns {string | null} */
  function read() {
    if (at >= list.length) return null
    const tok = list[at++]
    const count = arity(tok.text)
    if (count > 0) {
      const children = []
      for (let i = 0; i < count; i++) {
        const child = read()
        if (child === null) return null
        children.push(child)
      }
      const seq = tok.text + children.join('')
      const matched = byIds.get(seq) ?? lookupEncoded?.(seq) ?? null
      if (matched) {
        if ([...matched].length === 1) hosts.add(matched)
        return matched
      }
      return seq
    }
    const { rest, tones } = splitToneMarks(tok.text)
    if (tones) return null
    const norm = normalizeLeaf(rest)
    if (norm === '幺') hosts.add('幺')
    return norm
  }
  const key = read()
  if (key === null || at !== list.length) return null
  return { key, hosts }
}

/** Collect every documented host character (including `幺`) that any subtree of `text` collapses to,
 * so the loader can prefetch their native glyph shards in the initial pass.
 * @param {string} text @returns {string[]} */
export function collectYaoHosts(text) {
  if (!containsYaoVariant(text)) return []
  const collapsed = collapseTree(text)
  return collapsed ? [...collapsed.hosts] : ['幺']
}

/** If `text` is an edited spelling of an encoded host character `H`, recover `H` and each edited 幺
 * site's occurrence index, path, and canonical form ID.
 * @param {string} text @param {((seq: string) => string | null) | null} [lookupEncoded]
 * @returns {CollapsedYaoHost | null} */
export function collapseYaoHost(text, lookupEncoded = null) {
  if (!containsYaoVariant(text)) return null
  const collapsed = collapseTree(text, lookupEncoded)
  if (!collapsed || [...collapsed.key].length !== 1) return null
  const host = collapsed.key
  const hostSites = yaoOccurrences(host)
  const textSites = yaoOccurrences(text)
  if (!hostSites.length || hostSites.length !== textSites.length) return null
  /** @type {{ index: number, path: number[], formId: string }[]} */
  const edits = []
  for (let i = 0; i < hostSites.length; i++) {
    const a = hostSites[i].path, b = textSites[i].path
    if (a.length !== b.length || !a.every((v, k) => v === b[k])) return null
    const formId = textSites[i].form
    if (formId) edits.push({ index: i, path: a, formId })
  }
  if (!edits.length) return null
  return { host, paths: hostSites.map(s => s.path), edits }
}

const GRID = 16
/** @param {number[]} b */
const boxWidth = b => b[2] - b[0]
/** @param {number[]} b */
const boxHeight = b => b[3] - b[1]

/** @param {any[]} contours @param {number[]} box */
function maskOfContours(contours, box) {
  return fill(rings(contours, contours.map(c => c.light), 4), GRID, box)
}
/** @param {Uint8Array} a @param {Uint8Array} b */
function iou(a, b) {
  let inter = 0, uni = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] && b[i]) inter++
    if (a[i] || b[i]) uni++
  }
  return uni ? inter / uni : 0
}
/** @param {Uint8Array} m */
function dilate(m) {
  const out = new Uint8Array(m.length)
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    let v = 0
    for (let dy = -1; dy <= 1 && !v; dy++) for (let dx = -1; dx <= 1 && !v; dx++) {
      const nx = x + dx, ny = y + dy
      if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID && m[ny * GRID + nx]) v = 1
    }
    out[y * GRID + x] = v
  }
  return out
}
/** @param {Uint8Array} a @param {Uint8Array} b */
function softScore(a, b) {
  const da = dilate(a), db = dilate(b)
  let hitA = 0, cntA = 0, hitB = 0, cntB = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i]) { cntA++; if (db[i]) hitA++ }
    if (b[i]) { cntB++; if (da[i]) hitB++ }
  }
  const p = cntA ? hitA / cntA : 0, r = cntB ? hitB / cntB : 0
  return (p + r ? 2 * p * r / (p + r) : 0) * 0.55 + iou(a, b) * 0.45
}

/** @type {Uint8Array[] | null} */
let yaoTemplates = null
function templates() {
  if (!yaoTemplates) {
    yaoTemplates = ['detached', 'folded', 'returning'].map(id => {
      const p = yaoPart(id)
      return maskOfContours(p.contours, p.box)
    })
  }
  return yaoTemplates
}
/** @param {any[]} contours @param {number[]} box */
function scoreYao(contours, box) {
  const mask = maskOfContours(contours, box)
  return Math.max(...templates().map(t => softScore(mask, t)))
}

/** Detect up to `expectedCount` 幺 contour groups in `part` (handles both stroke-separated and merged fonts).
 * @param {{ contours: any[], box: number[] }} part @param {number} expectedCount
 * @returns {YaoGroup[]} */
export function findYaoGroups(part, expectedCount) {
  const boxes = part.contours.map(c => pointsBox(c.light))
  const M = 96
  const cMasks = part.contours.map(c => fill(rings([c], [c.light], 4), M, part.box))
  /** @param {number} i @param {number} j */
  const touches = (i, j) => {
    const a = boxes[i], b = boxes[j]
    if (a[2] < b[0] - 8 || b[2] < a[0] - 8 || a[3] < b[1] - 8 || b[3] < a[1] - 8) return false
    const ma = cMasks[i], mb = cMasks[j]
    for (let k = 0; k < ma.length; k++) if (ma[k] && mb[k]) return true
    return false
  }
  // A wide horizontal crossbar (such as 亠's 一 in 牽 or 玄) separates contours strictly above it from 幺 below.
  /** @param {number[]} bi @param {number[]} bj */
  const hasBarrierBetween = (bi, bj) => {
    const cx = (bj[0] + bj[2]) / 2
    for (let k = 0; k < boxes.length; k++) {
      const bk = boxes[k]
      if (boxWidth(bk) > 450 && boxWidth(bk) > boxHeight(bk) * 4 &&
          bk[0] < cx && bk[2] > cx && bk[1] >= bi[1] && bk[3] <= bj[3] &&
          bk[1] > (bi[1] + bj[3]) / 2 && bj[1] >= bk[1] - 10) return true
    }
    return false
  }
  /** Absorb any touching contour inside the 幺 envelope without pulling in tall stems (小's 丨) or wide bars (亠/冖).
   * @param {number[]} idxs */
  const absorbTouching = idxs => {
    const set = new Set(idxs)
    let changed = true
    while (changed && set.size < 6) {
      changed = false
      const curBox = union([...set].map(i => boxes[i]))
      const cw = boxWidth(curBox), ch = boxHeight(curBox)
      for (let k = 0; k < boxes.length; k++) {
        if (set.has(k)) continue
        const bk = boxes[k]
        let hits = false
        for (const u of set) if (touches(u, k)) { hits = true; break }
        if (!hits) continue
        if (bk[1] < curBox[1] - Math.max(ch * 0.14, 30)) continue
        if (bk[3] > curBox[3] + Math.max(ch * 0.10, 25)) continue
        if (boxWidth(bk) > cw * 1.05 && boxHeight(bk) < ch * 0.35) continue
        const nextBox = union([curBox, bk])
        if (boxWidth(nextBox) > cw * 1.55 || boxHeight(nextBox) > ch * 1.15) continue
        const before = scoreYao([...set].map(i => part.contours[i]), curBox)
        const after = scoreYao([...set, k].map(i => part.contours[i]), nextBox)
        if (after >= before - 0.10 && after >= 0.54) { set.add(k); changed = true }
      }
    }
    return [...set].sort((a, b) => a - b)
  }

  /** @type {YaoGroup[]} */
  const candidates = []
  const seen = new Set()
  /** @param {number[]} idxs @param {boolean} [doAbsorb] */
  const consider = (idxs, doAbsorb = true) => {
    const finalIdxs = doAbsorb ? absorbTouching(idxs) : [...new Set(idxs)].sort((a, b) => a - b)
    if (!finalIdxs.length || finalIdxs.length > 6) return
    const key = finalIdxs.join(',')
    if (seen.has(key)) return
    seen.add(key)
    const box = union(finalIdxs.map(i => boxes[i]))
    const w = boxWidth(box), h = boxHeight(box)
    if (w < 60 || h < 100) return
    const aspect = w / h
    if (aspect < 0.20 || aspect > 3.8) return
    // Penalize leaving a touching inner stroke orphaned inside the candidate envelope.
    let orphaned = 0
    const set = new Set(finalIdxs)
    for (let k = 0; k < boxes.length; k++) {
      if (set.has(k)) continue
      const bk = boxes[k]
      if (bk[0] >= box[0] - w * 0.2 && bk[2] <= box[2] + w * 0.2 &&
          bk[1] >= box[1] - Math.max(h * 0.14, 30) && bk[3] <= box[3] + Math.max(h * 0.10, 25) &&
          !(boxWidth(bk) > w * 1.05 && boxHeight(bk) < h * 0.35)) {
        for (const u of set) if (touches(u, k)) { orphaned++; break }
      }
    }
    const rawScore = scoreYao(finalIdxs.map(i => part.contours[i]), box)
    const score = rawScore - orphaned * 0.06 + (finalIdxs.length === 5 ? 0.02 : 0)
    if (rawScore >= 0.54) candidates.push({ indices: finalIdxs, box, score, rawScore })
  }

  for (let i = 0; i < boxes.length; i++) consider([i], false)
  for (let i = 0; i < boxes.length; i++) {
    const bi = boxes[i]
    if (boxWidth(bi) < 55) continue
    for (let j = 0; j < boxes.length; j++) {
      if (i === j) continue
      const bj = boxes[j]
      if (bj[3] <= bi[3] + 25 || hasBarrierBetween(bi, bj)) continue
      const estW = Math.max(bi[2], bj[2]) - Math.min(bi[0], bj[0])
      const estH = bj[3] - bi[1]
      if (estW < 60 || estH < 100) continue
      if (estW / estH < 0.18 || estW / estH > 3.8) continue
      if (bj[0] < bi[0] - estW * 0.25 || bj[0] > bi[0] + estW * 0.65) continue
      if (bj[2] > bi[2] + estW * 0.35) continue
      const x0 = Math.min(bi[0], bj[0]) - estW * 0.16
      const x1 = Math.max(bi[2], bj[2]) + estW * 0.38
      const y0 = bi[1] - Math.max(estH * 0.14, 28)
      const y1 = bj[3] + estH * 0.08
      const inside = []
      for (let k = 0; k < boxes.length; k++) {
        const bk = boxes[k]
        if (bk[0] >= x0 && bk[2] <= x1 && bk[1] >= y0 && bk[3] <= y1) inside.push(k)
      }
      if (inside.length < 2 || inside.length > 8) continue
      consider(inside, true)
      let cur = inside.slice()
      let curScore = scoreYao(cur.map(k => part.contours[k]), union(cur.map(k => boxes[k])))
      while (cur.length > 4) {
        let bestDrop = -1, bestDropScore = curScore
        for (let m = 0; m < cur.length; m++) {
          const next = cur.filter((_, k) => k !== m)
          const ns = scoreYao(next.map(k => part.contours[k]), union(next.map(k => boxes[k])))
          if (ns > bestDropScore + 0.015) { bestDropScore = ns; bestDrop = m }
        }
        if (bestDrop < 0) break
        cur.splice(bestDrop, 1)
        curScore = bestDropScore
      }
      consider(cur, false)
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  /** @type {YaoGroup[]} */
  const picked = []
  const used = new Set()
  for (const c of candidates) {
    if (c.indices.some(i => used.has(i))) continue
    picked.push(c)
    c.indices.forEach(i => used.add(i))
    if (picked.length >= expectedCount) break
  }
  return picked
}

/** Subdivide normalized [x0, y0, x1, y1] (y up) for operand `index` of IDS operator `op`.
 * @param {string} op @param {number} index @param {number[]} box @returns {number[]} */
function childRegion(op, index, [x0, y0, x1, y1]) {
  const w = x1 - x0, h = y1 - y0
  if (op === '⿰') return index === 0 ? [x0, y0, x0 + w / 2, y1] : [x0 + w / 2, y0, x1, y1]
  if (op === '⿲') return [x0 + w * index / 3, y0, x0 + w * (index + 1) / 3, y1]
  if (op === '⿱') return index === 0 ? [x0, y0 + h / 2, x1, y1] : [x0, y0, x1, y0 + h / 2]
  if (op === '⿳') return [x0, y1 - h * (index + 1) / 3, x1, y1 - h * index / 3]
  if (op === '⿵' && index === 1) return [x0 + w * 0.15, y0, x1 - w * 0.15, y1 - h * 0.25]
  if (op === '⿶' && index === 1) return [x0 + w * 0.15, y0 + h * 0.25, x1 - w * 0.15, y1]
  if (op === '⿷' && index === 1) return [x0 + w * 0.25, y0 + h * 0.15, x1, y1 - h * 0.15]
  if (op === '⿸' && index === 1) return [x0 + w * 0.25, y0, x1, y1 - h * 0.25]
  if (op === '⿹' && index === 1) return [x0, y0, x1 - w * 0.25, y1 - h * 0.25]
  if (op === '⿺' && index === 1) return [x0 + w * 0.25, y0 + h * 0.25, x1, y1]
  if (op === '⿴' && index === 1) return [x0 + w * 0.15, y0 + h * 0.15, x1 - w * 0.15, y1 - h * 0.15]
  return [x0, y0, x1, y1]
}

/** Expected normalized [cx, cy] (0..1, y up) and whether another component sits below each 幺 site.
 * @param {string} host @returns {{ center: [number, number], hasBelow: boolean }[]} */
function expectedSites(host) {
  /** @type {{ center: [number, number], hasBelow: boolean }[]} */
  const sites = []
  /** @param {string} text @param {number[]} region @param {boolean} hasBelow */
  function walk(text, region, hasBelow) {
    const list = tokens(text)
    let at = 0
    /** @param {number[]} box @param {boolean} below */
    function read(box, below) {
      if (at >= list.length) return
      const tok = list[at++]
      const count = arity(tok.text)
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const childBelow = below || ((tok.text === '⿱' && i === 0) || (tok.text === '⿳' && i < 2))
          read(childRegion(tok.text, i, box), childBelow)
        }
        return
      }
      const { rest } = splitToneMarks(tok.text)
      if (rest === '幺' || resolveYaoForm(rest)) {
        sites.push({ center: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2], hasBelow: below })
        return
      }
      const sub = yaoDecomposition(rest)
      if (sub) walk(sub.ids, box, below)
    }
    read(region, hasBelow)
  }
  walk(host, [0, 0, 1, 1], false)
  return sites
}

/** Map detected `groups` 1-to-1 onto `host`'s documented 幺 occurrences by minimum squared center distance.
 * @param {string} host @param {YaoGroup[]} groups @param {number[]} fullBox @returns {YaoGroup[]} */
function alignGroupsToSites(host, groups, fullBox) {
  const n = groups.length
  if (n <= 1) return groups
  const expected = expectedSites(host).map(s => s.center)
  if (expected.length !== n) return groups
  const fw = boxWidth(fullBox) || 1, fh = boxHeight(fullBox) || 1
  const actual = groups.map(g => [
    ((g.box[0] + g.box[2]) / 2 - fullBox[0]) / fw,
    ((g.box[1] + g.box[3]) / 2 - fullBox[1]) / fh,
  ])
  const cost = (/** @type {number} */ siteIdx, /** @type {number} */ grpIdx) => {
    const dx = expected[siteIdx][0] - actual[grpIdx][0]
    const dy = expected[siteIdx][1] - actual[grpIdx][1]
    return dx * dx + dy * dy
  }
  if (n <= 6) {
    let bestCost = Infinity
    /** @type {number[]} */
    let bestPerm = Array.from({ length: n }, (_, i) => i)
    const used = Array.from({ length: n }, () => false)
    const perm = Array.from({ length: n }, () => 0)
    /** @param {number} depth @param {number} sum */
    const search = (depth, sum) => {
      if (sum >= bestCost) return
      if (depth === n) { bestCost = sum; bestPerm = perm.slice(); return }
      for (let j = 0; j < n; j++) {
        if (used[j]) continue
        used[j] = true; perm[depth] = j
        search(depth + 1, sum + cost(depth, j))
        used[j] = false
      }
    }
    search(0, 0)
    return bestPerm.map(j => groups[j])
  }
  const taken = new Set()
  return expected.map((_, i) => {
    let bestJ = 0, bestD = Infinity
    for (let j = 0; j < n; j++) {
      if (taken.has(j)) continue
      const d = cost(i, j)
      if (d < bestD) { bestD = d; bestJ = j }
    }
    taken.add(bestJ)
    return groups[bestJ]
  })
}

/** @param {number[][]} ringList @param {number[]} box */
function inkDensity(ringList, box) {
  const mask = fill(ringList, 96, box)
  return mask.reduce((s, v) => s + v, 0) / mask.length
}

/** @type {Map<string, ReturnType<typeof makePart>>} */
const matchedCache = new Map()

/** Fit `yaoPart(formId)` to `targetBox` and adjust its stroke weight isotropically in target
 * coordinates to match the ink density of `originalPart`.
 * @param {string} formId @param {{ contours: any[], box: number[] }} originalPart @param {number[]} targetBox */
export function matchedYaoForTarget(formId, originalPart, targetBox) {
  const targetInk = inkDensity(pathRings(svgPath([placed(originalPart, originalPart.box, targetBox, 0, '')]), 8), targetBox)
  const key = [formId, ...targetBox.map(Math.round), Math.round(targetInk * 1000)].join(':')
  const cached = matchedCache.get(key)
  if (cached) return cached
  const base = yaoPart(formId)
  const fittedSvg = svgPath([placed(base, base.box, targetBox, 0, '')])
  const ringPts = pathRings(fittedSvg, 10).map(flat => {
    const pts = []
    for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]])
    return [...pts, pts[0]]
  })
  const wfn = prepareWeight(ringPts)
  let lo = 0.45, hi = 2.0
  const grows = inkDensity(wfn(hi).map(r => r.flat()), targetBox) > inkDensity(wfn(lo).map(r => r.flat()), targetBox)
  let bestRings = wfn(1)
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2
    bestRings = wfn(mid)
    if ((inkDensity(bestRings.map(r => r.flat()), targetBox) < targetInk) === grows) lo = mid
    else hi = mid
  }
  const d = bestRings.map(r => r.slice(0, -1).map(([x, y], i) =>
    (i ? 'L' : 'M') + x.toFixed(2) + ' ' + (ASCENT - y).toFixed(2)).join('') + 'Z').join('')
  const part = svgPart(d)
  if (matchedCache.size > 512) matchedCache.clear()
  matchedCache.set(key, part)
  return part
}

/** @type {WeakMap<object, Map<string, YaoGroup[] | null>>} */
const detectedCache = new WeakMap()

/** Cached site-aligned 幺 groups for `glyph` (or null if fewer than `siteCount` clean matches exist,
 * or if a candidate swallows a lower stacked sibling such as 小/{86} in a fused fallback glyph).
 * @param {{ contours: any[], box: number[] }} glyph @param {string} host @param {number} siteCount
 * @returns {YaoGroup[] | null} */
export function alignedYaoGroups(glyph, host, siteCount) {
  let byHost = detectedCache.get(glyph)
  if (!byHost) { byHost = new Map(); detectedCache.set(glyph, byHost) }
  const cacheKey = `${host}:${siteCount}`
  if (byHost.has(cacheKey)) return byHost.get(cacheKey) ?? null
  const found = findYaoGroups(glyph, siteCount)
  let result = found.length === siteCount ? alignGroupsToSites(host, found, glyph.box) : null
  if (result) {
    const meta = expectedSites(host)
    if (meta.length === result.length) {
      const boxes = glyph.contours.map(c => pointsBox(c.light))
      const valid = result.every((group, idx) => {
        if (!meta[idx].hasBelow) return true
        const cut = new Set(group.indices)
        const [gx0, gy0, gx1, gy1] = group.box
        const limit = gy0 + (gy1 - gy0) * 0.20
        return boxes.some((b, k) => !cut.has(k) && b[2] > gx0 && b[0] < gx1 && b[1] < limit)
      })
      if (!valid) result = null
    }
  }
  byHost.set(cacheKey, result)
  return result
}

/** Replace only the edited 幺 occurrence(s) inside `glyph`, keeping every other stroke and layout
 * proportion native to `host`. Returns null when `glyph` has no clean match for the host's sites.
 * @param {{ contours: any[], box: number[] }} glyph @param {string} host
 * @param {number[][]} paths @param {{ index: number, path: number[], formId: string }[]} edits
 * @param {number[]} region @param {boolean} atRoot */
export function replaceYaoInPart(glyph, host, paths, edits, region, atRoot) {
  const groups = alignedYaoGroups(glyph, host, paths.length)
  if (!groups) return null
  const cut = new Set()
  /** @type {{ group: YaoGroup, formId: string }[]} */
  const swaps = []
  for (const edit of edits) {
    const group = groups[edit.index]
    if (!group) return null
    group.indices.forEach(i => cut.add(i))
    swaps.push({ group, formId: edit.formId })
  }
  const keep = glyph.contours.filter((_, i) => !cut.has(i))
  const pieces = []
  if (keep.length) pieces.push(placed(derived(glyph, keep, glyph.box), glyph.box, glyph.box, partInk(glyph), `glyph ${host}`))
  for (const { group, formId } of swaps) {
    const orig = makePart(group.indices.map(i => glyph.contours[i]))
    const rep = matchedYaoForTarget(formId, orig, group.box)
    pieces.push(placed(rep, rep.box, group.box, partInk(rep), `幺 · ${formId}`))
  }
  const merged = svgPart(svgPath(pieces))
  const target = atRoot ? mapped(glyph.box, constants.face, region) : region
  return [{ ...placed(merged, glyph.box, target, partInk(merged), `${host} · 幺`), fixed: true }]
}
