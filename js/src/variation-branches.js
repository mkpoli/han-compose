// @ts-check
import { variationProductFromJSON } from './variation-product.js'

/** @typedef {ReturnType<typeof import('./variation-product.js').createVariationProduct>} Product */
/** @typedef {{id:string,product:Product}} Branch */
/** @typedef {import('./variation-expression.js').VariationExpression} Expression */
/** @typedef {{version:1,branches:{id:string,product:import('./variation-product.js').ProductDocument}[]}} BranchDocument */

/** A finite, ordered sum of independent products. Each branch defines the occurrences available
 * after its parent form is fixed. Counts and indices include the identity of the branch.
 * @param {readonly Branch[]} branches */
export function createVariationBranches(branches) {
  if (!Array.isArray(branches)) throw new TypeError('An ordered list of variant branches is required')
  /** @type {Map<string,{id:string,product:Product,start:bigint}>} */
  const byId = new Map()
  let count = 0n
  for (const { id, product } of branches) {
    if (typeof id !== 'string' || !id.trim() || byId.has(id)) throw new TypeError('Branch identifiers must be nonempty and unique')
    if (typeof product?.count !== 'bigint' || product.count < 1n) throw new TypeError('A branch needs a variant product')
    byId.set(id, { id, product, start: count })
    count += product.count
  }
  /** @param {bigint} index */
  function at(index) {
    if (typeof index !== 'bigint' || index < 0n || index >= count) throw new RangeError('Index outside the variant branches')
    for (const { id, product, start } of byId.values()) {
      if (index < start + product.count) return { branch: id, expression: product.at(index - start) }
    }
    throw new RangeError('Index outside the variant branches')
  }
  /** @param {{branch:string,expression:Expression}} value */
  function rank({ branch, expression }) {
    const entry = byId.get(branch)
    if (!entry) throw new RangeError('Unknown variant branch')
    return entry.start + entry.product.rank(expression)
  }
  /** Return exact global indices and preserve factored alternatives for ambiguous branches.
   * @param {string} text */
  function detect(text) {
    const candidates = []
    let matches = 0n
    for (const { id, product, start } of byId.values()) {
      const hit = product.detect(text)
      if (hit.status === 'unknown') continue
      if (hit.status === 'exact') {
        candidates.push({ ...hit, branch: id, index: start + hit.index })
        matches++
      } else {
        candidates.push({ ...hit, branch: id })
        matches += hit.count
      }
    }
    const status = matches === 0n ? 'unknown' : matches === 1n ? 'exact' : 'ambiguous'
    return { status, count: matches, candidates }
  }
  /** @returns {BranchDocument} */
  const toJSON = () => ({ version: 1, branches: Array.from(byId.values(), ({ id, product }) => ({ id, product: product.toJSON() })) })
  return Object.freeze({ count, at, rank, detect, toJSON })
}

/** @param {import('./variation-expression.js').Registry} registry @param {BranchDocument} document */
export function variationBranchesFromJSON(registry, document) {
  if (document?.version !== 1 || !Array.isArray(document.branches)) throw new TypeError('Unknown variant branch document')
  return createVariationBranches(document.branches.map(({ id, product }) => ({ id, product: variationProductFromJSON(registry, product) })))
}
