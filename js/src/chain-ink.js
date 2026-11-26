import { drawingChain } from './chain-corrections.js'
import metrics from './chain-ink-metrics.json' with { type: 'json' }
import { groupRings, mapped, pointsBox, union } from './geometry.js'

/** Standalone ink boxes for the five published exports. Baselines are documented in data/README.md.
 * @type {Record<string, Record<string, number[]>>} */
const exportsByCommit = metrics

/** Original standalone ink frame for this export and written chain.
 * @param {any} composer @param {string} key */
export function recordedInkBox(composer, key) {
  if (composer.exclude?.size || composer.data?.missing?.size) return null
  const faceMetrics = exportsByCommit[composer.data?.manifest?.composer?.commit]
  return faceMetrics?.[key] ?? (key.startsWith('#(') ? faceMetrics?.[drawingChain(key)] : null) ?? null
}

/** Preserve a previously drawable form's ink extent at its original em scale.
 * @param {any} composer @param {string} key @param {any[]} parts */
export function fitRecordedInk(composer, key, parts) {
  if (!parts.length) return
  const box = recordedInkBox(composer, key)
  if (!Array.isArray(box) || parts.some(p => p.empty !== undefined || p.cut)) return
  const target = mapped(box, composer.C.face, composer.face)
  const actual = union(groupRings(parts.filter(p => !p.operandOnly), 64).map(pointsBox))
  if (!actual.every(Number.isFinite) || actual.every((v, i) => Math.abs(v - target[i]) < 0.04)) return
  for (const part of parts) {
    part.target = mapped(part.target, actual, target)
    if (part.flips) part.flips = part.flips.map((/** @type {any} */ f) => ({
      ...f, about: mapped([...f.about, ...f.about], actual, target).slice(0, 2),
    }))
  }
}
