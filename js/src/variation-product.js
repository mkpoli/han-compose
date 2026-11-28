// @ts-check
import { tokens } from './tokens.js'
import { arity, isCustom, isSelector } from './tree.js'
import { realizeVariation, variationExpression, variationSubject } from './variation-expression.js'

/** @typedef {import('./variation-expression.js').Registry} Registry */
/** @typedef {ReturnType<typeof import('./variation-expression.js').variationExpression>} Expression */
/** @typedef {{family:string, form:string, text:string, source?:never} | {source:string, text:string, family?:never, form?:never}} Option */
/** @typedef {{path:number[], options:Option[]}} Domain */
/** @typedef {{path:number[], family:string, forms?:string[]} | {path:number[], families:string[]} | Domain} Dimension */
/** @typedef {{version:1, expression:Expression, dimensions:Dimension[]}} ProductDocument */

/** @param {number[]} a @param {number[]} b */
function comparePaths(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]
  return a.length - b.length
}
/** @param {number[]} a @param {number[]} b */
const prefix = (a, b) => a.length <= b.length && a.every((item, i) => b[i] === item)

/** Only these token boundaries are intrinsically independent in the IDS grammar. Hangul jamo,
 * combining marks, and punctuation used to spell custom entities can bind across operands.
 * @param {string} text */
function independentSpelling(text) {
  const parts = tokens(text)
  return !!parts.length && parts.every(({ text }) => {
    const chars = [...text]
    if (arity(chars[0]) || isCustom(text)) return true
    if (chars.length > 2 || (chars.length === 2 && !isSelector(chars[1]))) return false
    return /[\p{Letter}\p{Number}\p{Ideographic}\p{Script=Han}\u31c0-\u31ef]/u.test(chars[0]) &&
      !/[\u1100-\u11ff\ua960-\ua97f\ud7b0-\ud7ff\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(chars[0])
  })
}

/** @param {Option} option */
const identity = option => JSON.stringify(option.source !== undefined ? ['source', option.source, option.text] : ['family', option.family, option.form])

/** Resolve shorthands once. An exported domain pins both ordering and exact spellings.
 * @param {Registry} registry @param {string} subject @param {Dimension} dimension @returns {Option[]} */
function resolveOptions(registry, subject, dimension) {
  const families = new Map(registry.familiesFor(subject).map(family => [family.id, family]))
  /** @param {string} id */
  function familyFor(id) {
    const family = families.get(id)
    if (!family || family.evidenceOnly) throw new RangeError(`No selectable family ${id} for ${subject}`)
    return family
  }
  /** @param {string} id @param {string} formId */
  function option(id, formId) {
    const form = familyFor(id).forms.find(form => form.id === formId)
    if (!form) throw new RangeError(`Unknown form ${id}/${formId}`)
    return { family: id, form: form.id, text: form.text }
  }
  if (['family', 'families', 'options'].filter(key => Object.hasOwn(dimension, key)).length !== 1 ||
    ('forms' in dimension && !('family' in dimension))) {
    throw new TypeError('A dimension requires one family, a list of families, or pinned options')
  }
  /** @type {Option[]} */
  let options
  if ('options' in dimension) {
    options = dimension.options.map(pin => {
      if (pin.source !== undefined) {
        if ('family' in pin || 'form' in pin || typeof pin.source !== 'string' || !pin.source.trim()) {
          throw new TypeError('Local options require one source and exact text')
        }
        variationExpression(pin.text)
        return { source: pin.source, text: pin.text }
      }
      const current = option(pin.family, pin.form)
      if (current.text !== pin.text) throw new RangeError(`Changed spelling for ${pin.family}/${pin.form}`)
      return current
    })
  } else if ('family' in dimension && dimension.forms !== undefined) {
    options = dimension.forms.map(id => option(dimension.family, id))
  } else {
    const names = 'family' in dimension ? [dimension.family] : dimension.families
    options = names.flatMap(id => familyFor(id).forms.map(form => ({ family: id, form: form.id, text: form.text })))
  }
  const identities = new Set(options.map(identity))
  if (!options.length || identities.size !== options.length) throw new RangeError('Each dimension needs distinct form identities')
  return options
}

/**
 * The Cartesian product of independently adjustable occurrences. Sites are ordered by operand
 * path; the rightmost site varies fastest. Counts and ranks are arbitrary-precision integers.
 * @param {Registry} registry @param {Expression} expression @param {readonly Dimension[]} dimensions
 */
export function createVariationProduct(registry, expression, dimensions) {
  const base = structuredClone(expression)
  realizeVariation(base, registry)
  const ordered = [...dimensions].map(d => {
    if (!Array.isArray(d.path) || !d.path.every(n => Number.isSafeInteger(n) && n >= 0)) throw new TypeError('Invalid dimension path')
    return { ...d, path: [...d.path] }
  }).sort((a, b) => comparePaths(a.path, b.path))
  for (let i = 1; i < ordered.length; i++) {
    if (prefix(ordered[i - 1].path, ordered[i].path)) throw new RangeError('Independent dimensions must have disjoint paths')
  }
  const variable = new Set(ordered.map(d => d.path.join('.')))
  base.choices = base.choices.filter(choice => !variable.has(choice.path.join('.')))
  const axes = ordered.map(d => {
    if (base.choices.some(choice => prefix(d.path, choice.path))) throw new RangeError('A variable operand contains a fixed choice')
    const subject = variationSubject(base, d.path)
    const options = resolveOptions(registry, subject, d)
    const families = new Map(registry.familiesFor(subject).map(family => [family.id, family]))
    /** @type {Map<string,number[]>} */
    const spellings = new Map()
    options.forEach((option, i) => {
      const form = option.family === undefined ? undefined : families.get(option.family)?.forms.find(form => form.id === option.form)
      for (const text of [option.text, ...(form?.aliases ?? [])]) {
        const indices = spellings.get(text)
        if (indices) indices.push(i)
        else spellings.set(text, [i])
      }
    })
    return { path: d.path, subject, options, spellings, radix: BigInt(options.length) }
  })
  const count = axes.reduce((n, axis) => n * axis.radix, 1n)
  /** @param {number[]} digits */
  function materialize(digits) {
    const selected = structuredClone(base)
    axes.forEach(({ path, subject, options }, i) => {
      selected.choices.push({ path: [...path], subject, ...options[digits[i]] })
    })
    selected.choices.sort((a, b) => comparePaths(a.path, b.path))
    return selected
  }
  // Check all changing contexts without walking the Cartesian product. A one-site product
  // can also safely admit context-sensitive spellings after checking each in its fixed frame.
  const first = axes.map(() => 0)
  const representative = realizeVariation(materialize(first), registry)
  const changing = axes.filter(axis => new Set(axis.options.map(o => o.text)).size > 1)
  if (changing.length > 1 && (!independentSpelling(representative) ||
    changing.some(axis => axis.options.some(o => !independentSpelling(o.text))))) {
    throw new RangeError('Independent sites need stable IDS operand boundaries; a named component can carry a contextual drawing')
  }
  for (let i = 0; i < axes.length; i++) {
    const axis = axes[i]
    const nestedWitness = base.expansions.some(e => prefix(axis.path, e.path))
    if (changing.length === 1 || nestedWitness) {
      const checked = new Set([axis.options[0].text])
      for (let j = 1; j < axis.options.length; j++) {
        if (checked.has(axis.options[j].text)) continue
        checked.add(axis.options[j].text)
        first[i] = j
        realizeVariation(materialize(first), registry)
      }
      first[i] = 0
    }
  }
  /** @param {number[]} digits */
  const indexOf = digits => axes.reduce((n, axis, i) => n * axis.radix + BigInt(digits[i]), 0n)
  /** @param {bigint} index */
  function at(index) {
    if (typeof index !== 'bigint' || index < 0n || index >= count) throw new RangeError('Index outside this product')
    const digits = axes.map(() => 0)
    for (let i = axes.length - 1; i >= 0; i--) {
      digits[i] = Number(index % axes[i].radix)
      index /= axes[i].radix
    }
    const selected = materialize(digits)
    realizeVariation(selected, registry)
    return selected
  }
  /** A stable signature of the fixed expression, independent of property and declaration order.
   * @param {Expression} expr */
  function fixedSignature(expr) {
    const expansions = [...expr.expansions].sort((a, b) => comparePaths(a.path, b.path))
      .map(e => [e.path, e.subject, e.ids, e.source])
    const fixed = expr.choices.filter(c => !variable.has(c.path.join('.'))).sort((a, b) => comparePaths(a.path, b.path))
      .map(c => [c.path, c.subject, c.family, c.form, c.source, c.text])
    return JSON.stringify([expr.version, expr.base, expansions, fixed])
  }
  const signature = fixedSignature(base)
  /** @param {Expression} expr */
  function rank(expr) {
    realizeVariation(expr, registry)
    if (fixedSignature(expr) !== signature) throw new RangeError('Expression outside this product')
    const choices = new Map(expr.choices.map(choice => [choice.path.join('.'), choice]))
    const digits = axes.map(axis => {
      const chosen = choices.get(axis.path.join('.'))
      const digit = chosen ? axis.options.findIndex(o => identity(o) === identity(chosen) && o.text === chosen.text) : -1
      if (digit === -1) throw new RangeError(`Missing or excluded choice at [${axis.path}]`)
      return digit
    })
    return indexOf(digits)
  }
  /** Detect only an exact realization in this product. When several source identities serialize
   * identically, return the alternatives factored by occurrence instead of enumerating tuples.
   * @param {string} text */
  function detect(text) {
    const unknown = /** @type {const} */ ({ status: 'unknown' })
    const spans = new Map()
    for (const span of tokens(text)) {
      const key = span.path.join('.')
      if (!spans.has(key)) spans.set(key, span)
    }
    const matches = axes.map(axis => {
      const span = spans.get(axis.path.join('.'))
      if (!span) return []
      const spelling = text.slice(span.start, span.end)
      return axis.spellings.get(spelling) ?? []
    })
    if (matches.some(digits => !digits.length)) return unknown
    const digits = matches.map(d => d[0])
    const expr = materialize(digits)
    // Aliases rewrite only the matched operand. Every fixed sibling must match the saved expression.
    const pieces = []
    let start = 0
    for (const [i, axis] of axes.entries()) {
      const span = spans.get(axis.path.join('.'))
      pieces.push(text.slice(start, span.start), axis.options[digits[i]].text)
      start = span.end
    }
    pieces.push(text.slice(start))
    if (realizeVariation(expr, registry) !== pieces.join('')) return unknown
    const possible = matches.reduce((n, list) => n * BigInt(list.length), 1n)
    if (possible === 1n) return { status: /** @type {const} */ ('exact'), index: indexOf(digits), expression: expr }
    const candidates = axes.map((axis, i) => ({ path: [...axis.path], options: matches[i].map(d => ({ ...axis.options[d] })) }))
    return { status: /** @type {const} */ ('ambiguous'), count: possible, candidates }
  }
  /** @returns {ProductDocument} */
  const toJSON = () => structuredClone({ version: 1, expression: base, dimensions: axes.map(({ path, options }) => ({ path, options })) })
  return Object.freeze({ count, at, rank, detect, toJSON })
}

/** Reopen the saved expression and its ordered, pinned domains.
 * @param {Registry} registry @param {ProductDocument} document */
export function variationProductFromJSON(registry, document) {
  if (document?.version !== 1 || !Array.isArray(document.dimensions)) throw new TypeError('Unknown variation product format')
  return createVariationProduct(registry, document.expression, document.dimensions)
}
