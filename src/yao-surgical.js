// @ts-check
import constants from './constants.json' with { type: 'json' }
import decomposeCuts from './yao-decompose-cuts.json' with { type: 'json' }
import hostsIndex from './yao-hosts.json' with { type: 'json' }
import { ASCENT, derived, fill, fitted, makePart, partInk, pathRings, placed, pointsBox, rings, svgPath, union } from './geometry.js'
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

/** @type {Record<string, [number, number[][]]>} */
const verifiedSerifCuts = /** @type {any} */ (decomposeCuts.cuts)

/** Look up `han-decompose`-verified contour indices for `host` on primary Source Han Serif glyphs,
 * returning site-aligned groups without running geometric search, or null when uncatalogued.
 * @param {{ contours: any[], box: number[] }} glyph @param {string} host @param {number} siteCount
 * @param {string} [fontStyle] @param {boolean} [isPrimary] @returns {YaoGroup[] | null} */
export function decomposedYaoGroups(glyph, host, siteCount, fontStyle = 'serif', isPrimary = true) {
  if (fontStyle !== 'serif' || !isPrimary) return null
  const entry = verifiedSerifCuts[host]
  if (!entry || entry[0] !== glyph.contours.length || entry[1].length !== siteCount) return null
  const groups = []
  for (const indices of entry[1]) {
    if (!indices.length || indices.some(i => i < 0 || i >= glyph.contours.length)) return null
    const box = union(indices.map(i => pointsBox(glyph.contours[i].light)))
    groups.push({ indices, box, score: 1, rawScore: 1 })
  }
  return alignGroupsToSites(host, groups, glyph.box)
}

/** @type {WeakMap<object, Map<string, YaoGroup[] | null>>} */
const detectedCache = new WeakMap()

/** Cached site-aligned 幺 groups for `glyph`: prefers `han-decompose`'s verified contour cuts on
 * primary Source Han Serif glyphs, falling back to geometric detection on uncatalogued hosts or
 * other faces (rejecting fused glyphs that swallow a lower stacked sibling).
 * @param {{ contours: any[], box: number[] }} glyph @param {string} host @param {number} siteCount
 * @param {string} [fontStyle] @param {boolean} [isPrimary]
 * @returns {YaoGroup[] | null} */
export function alignedYaoGroups(glyph, host, siteCount, fontStyle = 'serif', isPrimary = true) {
  let byHost = detectedCache.get(glyph)
  if (!byHost) { byHost = new Map(); detectedCache.set(glyph, byHost) }
  const cacheKey = `${host}:${siteCount}:${fontStyle}:${isPrimary ? 1 : 0}`
  if (byHost.has(cacheKey)) return byHost.get(cacheKey) ?? null
  const verified = decomposedYaoGroups(glyph, host, siteCount, fontStyle, isPrimary)
  if (verified) { byHost.set(cacheKey, verified); return verified }
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

/** Extract [x, y] vertices of a contour's light path.
 * @param {{ light: ArrayLike<number> }} contour @returns {[number, number][]} */
function contourPoints(contour) {
  /** @type {[number, number][]} */
  const pts = []
  for (let i = 0; i < contour.light.length; i += 2) pts.push([contour.light[i], contour.light[i + 1]])
  return pts
}

/** Affine/smooth coordinate remap of a contour, preserving its exact native Bezier commands.
 * @param {{ ops: any[], light: ArrayLike<number> }} contour
 * @param {(x: number, y: number) => [number, number]} fn */
function mapContour(contour, fn) {
  const light = []
  for (let i = 0; i < contour.light.length; i += 2) {
    const [nx, ny] = fn(contour.light[i], contour.light[i + 1])
    light.push(nx, ny)
  }
  return { ops: contour.ops, light, heavy: light }
}

/** Centerline x of the middle diagonal stroke at height `y`.
 * @param {{ c: { light: ArrayLike<number> }, b: number[] }} midDiag @param {number} y */
function midXAtY(midDiag, y) {
  const pts = contourPoints(midDiag.c)
  const band = (midDiag.b[3] - midDiag.b[1]) * 0.14
  let minX = Infinity, maxX = -Infinity
  for (const [px, py] of pts) {
    if (Math.abs(py - y) <= band) {
      if (px < minX) minX = px
      if (px > maxX) maxX = px
    }
  }
  if (minX <= maxX) return (minX + maxX) / 2
  const t = Math.max(0, Math.min(1, (y - midDiag.b[1]) / Math.max(1, midDiag.b[3] - midDiag.b[1])))
  return midDiag.b[0] + t * (midDiag.b[2] - midDiag.b[0])
}

/**
 * Identify the 5 separate Noto Serif strokes of a native detached 幺 (`bar`, `dot`, `midDiag`,
 * `topDiag`, `shortDot`). Returns null for merged/non-5-contour or non-detached faces so callers
 * fall back cleanly to whole-幺 replacement.
 * @param {{ contours: any[] }} glyph @param {number[]} indices @param {number[]} box
 */
export function classifyDetachedYao5(glyph, indices, box) {
  if (indices.length !== 5) return null
  const [x0, y0, x1, y1] = box
  const w = x1 - x0, h = y1 - y0
  if (w <= 0 || h <= 0) return null
  const items = indices.map(ci => {
    const c = glyph.contours[ci]
    const b = pointsBox(c.light)
    const nx0 = (b[0] - x0) / w, ny0 = (b[1] - y0) / h, nx1 = (b[2] - x0) / w, ny1 = (b[3] - y0) / h
    return { ci, c, b, nx0, ny0, nx1, ny1, nw: nx1 - nx0, nh: ny1 - ny0 }
  })
  const bar = items.find(it => it.nx0 < 0.15 && it.ny0 < 0.12 && it.nw > 0.65 && it.ny1 < 0.42)
  if (!bar) return null
  const rem1 = items.filter(it => it !== bar)
  const dot = rem1.find(it => it.nx1 > 0.80 && it.nx0 > 0.50 && it.ny0 < 0.12 && it.ny1 < 0.65)
  if (!dot) return null
  const rem2 = rem1.filter(it => it !== dot)
  rem2.sort((a, b) => (b.nx1 - b.ny0) - (a.nx1 - a.ny0))
  const midDiag = rem2[0]
  if (midDiag.nx1 < 0.65 || midDiag.ny0 > 0.30) return null
  const rem3 = rem2.slice(1)
  rem3.sort((a, b) => b.ny1 - a.ny1)
  const topDiag = rem3[0], shortDot = rem3[1]
  if (topDiag.ny1 < 0.88 || shortDot.nx0 > 0.25 || shortDot.nx1 > 0.72) return null
  // Confirm `shortDot` slopes downward-right (detached stroke, not an already-folded rising bar).
  const pts = contourPoints(shortDot.c)
  const midX = (shortDot.b[0] + shortDot.b[2]) / 2
  let leftSum = 0, leftN = 0, rightSum = 0, rightN = 0
  for (const [px, py] of pts) {
    if (px < midX) { leftSum += py; leftN++ } else { rightSum += py; rightN++ }
  }
  if (!leftN || !rightN || leftSum / leftN <= rightSum / rightN) return null
  return { bar, dot, midDiag, topDiag, shortDot, box }
}

/** Construct the folded (&VR-5E7A-02;) form directly from the host's native 5-contour 幺:
 * keeps bar, dot, and midDiag untouched, extends topDiag's lower tip to the fold corner, and
 * clones the native rising bar into the upper-left fold so all curves and stroke weights stay native.
 * @param {NonNullable<ReturnType<typeof classifyDetachedYao5>>} cls */
function foldedContoursFromNative(cls) {
  const { bar, dot, midDiag, topDiag, box } = cls
  const [x0, y0, x1, y1] = box
  const w = x1 - x0, h = y1 - y0
  const bh = Math.max(1, bar.b[3] - bar.b[1])
  const bw = Math.max(1, bar.b[2] - bar.b[0])
  const cornerX = x0 + w * 0.06
  const cornerY = y0 + h * 0.48
  const tdX0 = topDiag.b[0], tdY0 = topDiag.b[1], tdY1 = topDiag.b[3]
  const dxCorner = (cornerX + w * 0.01) - tdX0
  const dyCorner = cornerY - tdY0
  const newTopDiag = mapContour(topDiag.c, (x, y) => {
    const t = Math.max(0, Math.min(1, (tdY1 - y) / Math.max(1, tdY1 - tdY0)))
    const ease = t * t
    return [x + dxCorner * ease, y + dyCorner * ease]
  })
  const endY = cornerY + bh * 0.48
  const midX = midXAtY(midDiag, endY)
  const targetBar = [
    cornerX - w * 0.025,
    cornerY - bh * 0.30,
    midX + w * 0.025,
    endY + bh * 0.28,
  ]
  const tbw = targetBar[2] - targetBar[0], tbh = targetBar[3] - targetBar[1]
  const upperBar = mapContour(bar.c, (x, y) => [
    targetBar[0] + (x - bar.b[0]) * (tbw / bw),
    targetBar[1] + (y - bar.b[1]) * (tbh / bh),
  ])
  return [bar.c, dot.c, midDiag.c, newTopDiag, upperBar]
}

/** Construct the returning (&VR-5E7A-03;) form directly from the host's native 5-contour 幺:
 * keeps bar, dot, midDiag, and topDiag untouched, extends shortDot into midDiag, and places a
 * returning cap stroke derived from shortDot into midDiag's upper-right head.
 * @param {NonNullable<ReturnType<typeof classifyDetachedYao5>>} cls */
function returningContoursFromNative(cls) {
  const { bar, dot, midDiag, topDiag, shortDot, box } = cls
  const [x0, y0, x1, y1] = box
  const w = x1 - x0, h = y1 - y0
  const sdX0 = shortDot.b[0], sdX1 = shortDot.b[2], sdY0 = shortDot.b[1], sdY1 = shortDot.b[3]
  const sdw = Math.max(1, sdX1 - sdX0), sdh = Math.max(1, sdY1 - sdY0)
  const targetCrossY = y0 + h * 0.40
  const targetCrossX = midXAtY(midDiag, targetCrossY) + w * 0.02
  const dx = Math.max(0, targetCrossX - sdX1)
  const dy = Math.min(0, targetCrossY - sdY0)
  const newShortDot = mapContour(shortDot.c, (x, y) => {
    const t = Math.max(0, Math.min(1, (x - sdX0) / sdw))
    const ease = t * t
    return [x + dx * ease, y + dy * ease]
  })
  const midPts = contourPoints(midDiag.c)
  const midRightCutoff = midDiag.b[0] + (midDiag.b[2] - midDiag.b[0]) * 0.65
  let headX = midDiag.b[2], headY = midDiag.b[3], best = -Infinity
  for (const [px, py] of midPts) {
    if (px < midRightCutoff) continue
    const s = py * 1.2 + px * 0.4
    if (s > best) { best = s; headX = px; headY = py }
  }
  // Keep the returning cap modest in height and clear of topDiag so narrow 幺 (機/幼) stays crisp.
  const capX0 = Math.max(x0 + w * 0.50, headX - w * 0.28)
  const capX1 = Math.max(capX0 + w * 0.12, headX + w * 0.01)
  const capY1 = Math.min(y1 - h * 0.05, headY + h * 0.085)
  const capY0 = Math.min(capY1 - h * 0.07, headY - h * 0.045)
  const cap = mapContour(shortDot.c, (x, y) => [
    capX0 + (x - sdX0) * ((capX1 - capX0) / sdw),
    capY0 + (y - sdY0) * ((capY1 - capY0) / sdh),
  ])
  return [bar.c, dot.c, midDiag.c, topDiag.c, newShortDot, cap]
}

/** Replace only the edited 幺 occurrence(s) inside `glyph`, keeping every other stroke and layout
 * proportion native to `host`. On 5-contour native detached 幺 glyphs (Noto Serif CJK JP), keeps
 * native strokes untouched for `detached` and edits only the upper turn for `folded`/`returning`;
 * falls back to weight-matched whole-幺 replacement on merged/other glyphs.
 * @param {{ contours: any[], box: number[] }} glyph @param {string} host
 * @param {number[][]} paths @param {{ index: number, path: number[], formId: string }[]} edits
 * @param {number[]} region @param {boolean} atRoot
 * @param {{ fontStyle?: string, isPrimary?: boolean, nativeInk?: number | null }} [opts] */
export function replaceYaoInPart(glyph, host, paths, edits, region, atRoot, opts = {}) {
  const { fontStyle = 'serif', isPrimary = true, nativeInk = null } = opts
  const groups = alignedYaoGroups(glyph, host, paths.length, fontStyle, isPrimary)
  if (!groups) return null
  const cut = new Set()
  /** @type {any[]} */
  const nativeAdditions = []
  /** @type {{ group: YaoGroup, formId: string }[]} */
  const wholeSwaps = []
  for (const edit of edits) {
    const group = groups[edit.index]
    if (!group) return null
    const native5 = classifyDetachedYao5(glyph, group.indices, group.box)
    if (native5) {
      if (edit.formId === 'detached') continue // Native strokes are already detached; preserve verbatim.
      group.indices.forEach(i => cut.add(i))
      if (edit.formId === 'folded') nativeAdditions.push(...foldedContoursFromNative(native5))
      else if (edit.formId === 'returning') nativeAdditions.push(...returningContoursFromNative(native5))
      else wholeSwaps.push({ group, formId: edit.formId })
    } else {
      group.indices.forEach(i => cut.add(i))
      wholeSwaps.push({ group, formId: edit.formId })
    }
  }
  const keep = glyph.contours.filter((_, i) => !cut.has(i))
  const target = atRoot ? fitted(glyph.box, region, constants.STRETCH) : region
  if (!wholeSwaps.length) {
    if (!cut.size) {
      // Every edited site is already native detached: place identically to the unedited host glyph.
      const fit = fitted(glyph.box, region, constants.STRETCH)
      return [placed(glyph, glyph.box, fit, nativeInk ?? partInk(glyph), `glyph ${host}`)]
    }
    const outPart = derived(glyph, [...keep, ...nativeAdditions], glyph.box)
    return [{ ...placed(outPart, glyph.box, target, partInk(outPart), `${host} · 幺`), fixed: true }]
  }
  const pieces = []
  const kept = [...keep, ...nativeAdditions]
  if (kept.length) pieces.push(placed(derived(glyph, kept, glyph.box), glyph.box, glyph.box, partInk(glyph), `glyph ${host}`))
  for (const { group, formId } of wholeSwaps) {
    const orig = makePart(group.indices.map(i => glyph.contours[i]))
    const rep = matchedYaoForTarget(formId, orig, group.box)
    pieces.push(placed(rep, rep.box, group.box, partInk(rep), `幺 · ${formId}`))
  }
  const merged = svgPart(svgPath(pieces))
  return [{ ...placed(merged, glyph.box, target, partInk(merged), `${host} · 幺`), fixed: true }]
}
