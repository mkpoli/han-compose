import metrics from './chain-ink-metrics.json' with { type: 'json' }
import { groupRings, mapped, pointsBox, union } from './geometry.js'

/** Standalone ink boxes for the five published exports on b3b6b921.
 * @type {Record<string, Record<string, number[]>>} */
const exportsByCommit = metrics

/** Preserve a previously drawable form's ink extent at its original em scale.
 * @param {any} composer @param {string} key @param {any[]} parts */
export function fitRecordedInk(composer, key, parts) {
  if (!key.includes('#(') || composer.exclude.size || composer.data.missing?.size || !parts.length) return
  const commit = composer.data.manifest.composer?.commit
  const box = exportsByCommit[commit]?.[key]
  if (!Array.isArray(box) || parts.some(p => p.empty !== undefined || p.cut)) return
  const target = mapped(box, composer.C.face, composer.face)
  const actual = union(groupRings(parts, 32).map(pointsBox))
  if (!actual.every(Number.isFinite) || actual.every((v, i) => Math.abs(v - target[i]) < 0.2)) return
  for (const part of parts) {
    part.target = mapped(part.target, actual, target)
    if (part.flips) part.flips = part.flips.map((/** @type {any} */ f) => ({
      ...f, about: mapped([...f.about, ...f.about], actual, target).slice(0, 2),
    }))
  }
}
