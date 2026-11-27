// @ts-check
import { realizeVariation } from './variation-expression.js'
import { variationBranchesFromJSON } from './variation-branches.js'
import { variationProductFromJSON } from './variation-product.js'
import { createVariationRegistry } from './variation-registry.js'

/** @typedef {import('./variation-expression.js').VariationExpression | import('./variation-product.js').ProductDocument | import('./variation-branches.js').BranchDocument} Document */
/** @typedef {import('./variation-registry.js').VariationFamily} Family */
/** @template {Family} F @typedef {{families:readonly F[], familiesFor:(text:string) => readonly F[]}} Catalogue */
/** @template {Family} F @typedef {{format:'han-compose/variation-archive',version:1,document:Document,families:F[]}} Archive */

const format = 'han-compose/variation-archive'

/** Copy portable metadata, rejecting values JSON serialization would silently change.
 * @template T @param {T} value @returns {T} */
function jsonCopy(value) {
  return JSON.parse(JSON.stringify(value, function (key, val) {
    const original = this[key]
    if (original === val && (val === null || typeof val === 'string' || typeof val === 'boolean' ||
      (Number.isFinite(val) && !Object.is(val, -0)) || Array.isArray(val) || (typeof val === 'object' &&
        (Object.getPrototypeOf(val) === Object.prototype || Object.getPrototypeOf(val) === null)))) return val
    throw new TypeError('Archive metadata must be JSON data')
  }))
}

/** Validate exact spellings and expand any dynamic family domains into pinned options.
 * @param {Catalogue<Family>} registry @param {Document} document */
function pin(registry, document) {
  if ('branches' in document) return variationBranchesFromJSON(registry, document).toJSON()
  if ('expression' in document) return variationProductFromJSON(registry, document).toJSON()
  realizeVariation(document, registry)
  return document
}

/** Follow source family/form links when that family is available in the supplied catalogue.
 * An external citation is retained on its form even if the cited record was never supplied.
 * @template {Family} F @param {readonly F[]} catalogue @param {Document} document */
function referencedFamilies(catalogue, document) {
  const byId = new Map(catalogue.map(family => [family.id, family]))
  /** @type {Set<string>} */
  const ids = new Set()
  const designs = 'branches' in document ? document.branches.map(branch => branch.product) : [document]
  for (const design of designs) {
    const expression = 'expression' in design ? design.expression : design
    for (const choice of expression.choices) if (choice.family) ids.add(choice.family)
    if ('dimensions' in design) for (const dimension of design.dimensions) {
      if (!('options' in dimension)) throw new TypeError('An archive needs pinned option lists')
      for (const option of dimension.options) if (option.family) ids.add(option.family)
    }
  }
  /** @type {F[]} */
  const families = []
  for (const id of ids) {
    const family = byId.get(id)
    if (!family) throw new RangeError(`Missing archived family: ${id}`)
    families.push(family)
    for (const form of family.forms) {
      if (!('sources' in form) || !Array.isArray(form.sources)) continue
      for (const ref of form.sources) {
        if (typeof ref?.family !== 'string' || typeof ref.form !== 'string') continue
        const target = byId.get(ref.family)
        if (!target) continue
        if (!target.forms.some(f => f.id === ref.form)) throw new RangeError(`Missing source form: ${ref.family}/${ref.form}`)
        ids.add(target.id)
      }
    }
  }
  return families
}

/** @typedef {{toJSON:() => import('./variation-product.js').ProductDocument | import('./variation-branches.js').BranchDocument}} CompiledProduct */

/** Archive a design or a space together with the family records required to reopen it.
 * Embedded outline and provenance fields are copied as JSON; linked resources retain their URLs.
 * @template {Family} F @param {Catalogue<F>} registry @param {Document | CompiledProduct} document @returns {Archive<F>} */
export function archiveVariation(registry, document) {
  const pinned = pin(registry, 'toJSON' in document ? document.toJSON() : document)
  return jsonCopy({ format, version: 1, document: pinned, families: referencedFamilies(registry.families, pinned) })
}

/** Restore from archived records alone. A host can use the returned registry for drawing or editing.
 * @template {Family} F @param {Archive<F>} archive */
export function openVariationArchive(archive) {
  if (archive?.format !== format || archive.version !== 1 || !Array.isArray(archive.families)) {
    throw new TypeError('Expected a version 1 variation archive')
  }
  const { document, families } = jsonCopy(archive)
  const registry = createVariationRegistry(families)
  if (referencedFamilies(families, document).length !== families.length) throw new RangeError('Unreferenced archived family')
  return { registry, document: pin(registry, document) }
}
