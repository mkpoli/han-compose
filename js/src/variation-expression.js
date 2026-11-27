// @ts-check
import { descriptionEnd, isMark } from './tree.js'
import { tokens } from './tokens.js'

/** @typedef {number[]} Path */
/** @typedef {{path: Path, subject: string, ids: string, source: string}} Expansion */
/** @typedef {{path: Path, subject: string, text: string, family: string, form: string, source?: never} |
 * {path: Path, subject: string, text: string, source: string, family?: never, form?: never}} Choice */
/** @typedef {{version: 1, base: string, expansions: Expansion[], choices: Choice[]}} VariationExpression */
/** @typedef {{familiesFor: (text: string) => readonly {id:string, evidenceOnly?: boolean,
 * forms: readonly {id:string, text:string}[]}[]}} Registry */
/** @typedef {{children: Map<number, Branch>, choice?: Choice, expansion?: Expansion, query?: boolean}} Branch */

/** @param {unknown} text */
function named(text) {
  return typeof text === 'string' && text.trim().length !== 0
}

/** @param {string} text */
function spelling(text) {
  const chars = typeof text === 'string' ? [...text] : []
  const end = descriptionEnd(chars)
  if (!named(text) || text.includes('⬚') || text.includes('＋') || end < 0 || !chars.slice(end).every(isMark)) {
    throw new TypeError('Expected one complete IDS operand')
  }
}

/** @param {Path} path */
function validatePath(path) {
  if (!Array.isArray(path) || !path.every(i => Number.isSafeInteger(i) && i >= 0)) throw new TypeError('Invalid operand path')
}

/** @param {Path} a @param {Path} b */
function compare(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]
  return a.length - b.length
}

/** @param {Path} path @param {Path} prefix */
function below(path, prefix) {
  return path.length > prefix.length && prefix.every((index, i) => path[i] === index)
}

/** @param {Registry} registry @param {string} subject @param {string} family @param {string} form */
function formSpelling(registry, subject, family, form) {
  const group = registry.familiesFor(subject).find(f => f.id === family)
  if (group?.evidenceOnly) throw new RangeError(`Criterion requires an explicit sourced replacement: ${family}`)
  const found = group?.forms.find(f => f.id === form)
  if (!found) throw new RangeError(`Unknown form on ${subject}: ${family}/${form}`)
  return found.text
}

/** Resolve only the paths carrying an annotation. Source slices preserve untouched selectors,
 * entities, operator modifiers and remaining marks verbatim.
 * @param {VariationExpression} expression @param {{full?:boolean, registry?:Registry, query?:Path}} [options] */
function resolve(expression, { full = false, registry, query } = {}) {
  if (expression?.version !== 1 || !Array.isArray(expression.expansions) || !Array.isArray(expression.choices)) {
    throw new TypeError('Expected a version 1 variation expression')
  }
  spelling(expression.base)
  /** @type {Branch} */
  const root = { children: new Map() }
  /** @param {Path} path */
  function branch(path) {
    validatePath(path)
    let here = root
    for (const index of path) {
      let child = here.children.get(index)
      if (!child) { child = { children: new Map() }; here.children.set(index, child) }
      here = child
    }
    return here
  }
  for (const item of expression.expansions) {
    const here = branch(item.path)
    if (here.expansion || !named(item.source)) throw new TypeError(`Invalid expansion at [${item.path}]`)
    spelling(item.subject)
    spelling(item.ids)
    if (!tokens(item.ids).some(t => t.path.length === 1)) throw new TypeError('An expansion needs an IDS operator and operands')
    here.expansion = item
  }
  for (const item of expression.choices) {
    const here = branch(item.path)
    const registered = 'family' in item || 'form' in item
    if (here.choice || (registered ? !named(item.family) || !named(item.form) || 'source' in item : !named(item.source))) {
      throw new TypeError(`Invalid choice at [${item.path}]`)
    }
    spelling(item.subject)
    spelling(item.text)
    if (registry && item.family && item.form && formSpelling(registry, item.subject, item.family, item.form) !== item.text) {
      throw new RangeError(`Catalogue spelling changed: ${item.family}/${item.form}`)
    }
    here.choice = item
  }
  if (query !== undefined) branch(query).query = true
  let subject = ''
  /** @param {string} original @param {Branch} here @returns {{text:string, chosen:boolean}} */
  function visit(original, here) {
    const { choice, expansion } = here
    if (here.query) subject = original
    if (choice && choice.subject !== original) throw new RangeError(`Choice subject mismatch at [${choice.path}]`)
    const selected = choice?.text ?? original
    if (expansion && expansion.subject !== original && expansion.subject !== selected) {
      throw new RangeError(`Expansion subject mismatch at [${expansion.path}]`)
    }
    const body = expansion?.subject === selected ? expansion.ids : selected
    if (!here.children.size) return { text: full ? body : selected, chosen: !!choice }
    const children = tokens(body).filter(t => t.path.length === 1)
    if ([...here.children.keys()].some(i => i >= children.length)) throw new RangeError(`Invalid child of ${body}`)
    let end = 0, text = '', childChosen = false
    /** @type {[number, number][]} */
    const bounds = []
    for (const token of children) {
      text += body.slice(end, token.start)
      const start = text.length
      const operand = body.slice(token.start, token.end)
      const child = here.children.get(token.path[0])
      if (child) {
        const result = visit(operand, child)
        text += result.text
        childChosen ||= result.chosen
      } else text += operand
      bounds.push([start, text.length])
      end = token.end
    }
    text += body.slice(end)
    if (text !== body) {
      const written = tokens(text).filter(t => t.path.length === 1)
      if (written.length !== bounds.length || written.some((t, i) => t.start !== bounds[i][0] || t.end !== bounds[i][1])) {
        throw new RangeError('Substitution changes operand boundaries')
      }
    }
    return { text: full || childChosen ? text : selected, chosen: !!choice || childChosen }
  }
  const { text } = visit(expression.base, root)
  return { text, subject }
}

/** Begin a storable expression for a literal character, reference or IDS.
 * @param {string} base @returns {VariationExpression} */
export function variationExpression(base) {
  spelling(base)
  return { version: 1, base, expansions: [], choices: [] }
}

/** Fully expanded editable spelling, including active choices. @param {VariationExpression} expression */
export const expandedVariation = expression => resolve(expression, { full: true }).text

/** Write the result as ordinary IDS, expanding encoded operands only on the route to an explicit
 * choice. Supplying a catalogue also checks each family's identity and spelling.
 * @param {VariationExpression} expression @param {Registry} [registry] */
export const realizeVariation = (expression, registry) => resolve(expression, { registry }).text

/** Literal operand before its own choice or expansion, taking all ancestor edits into account.
 * @param {VariationExpression} expression @param {Path} path */
export const variationSubject = (expression, path) => resolve(expression, { query: path }).subject

/** @template {{path: Path}} T @param {T[]} records @param {T} next */
function put(records, next) {
  return [...records.filter(row => compare(row.path, next.path) !== 0), next].sort((a, b) => compare(a.path, b.path))
}

/** @param {VariationExpression} expression @param {Registry} [registry] */
function checked(expression, registry) {
  realizeVariation(expression, registry)
  return expression
}

/** Record the decomposition used to address descendants of an occurrence.
 * @param {VariationExpression} expression @param {Path} path @param {Omit<Expansion,'path'>} witness */
export function expandVariation(expression, path, witness) {
  validatePath(path)
  return checked({ ...expression, expansions: put(expression.expansions, { ...witness, path: [...path] }) })
}

/** Assign a documented family form to one occurrence, retaining its exact spelling in the record.
 * @param {Registry} registry @param {VariationExpression} expression @param {Path} path @param {string} family @param {string} form */
export function chooseVariation(registry, expression, path, family, form) {
  const subject = variationSubject(expression, path)
  const text = formSpelling(registry, subject, family, form)
  return checked({ ...expression, choices: put(expression.choices, { path: [...path], subject, text, family, form }) }, registry)
}

/** Assign any complete operand to a site and retain its local source reference.
 * @param {VariationExpression} expression @param {Path} path @param {{text:string,source:string}} replacement @param {Registry} [registry] */
export function replaceVariation(expression, path, replacement, registry) {
  const subject = variationSubject(expression, path)
  return checked({ ...expression, choices: put(expression.choices, { ...replacement, path: [...path], subject }) }, registry)
}

/** Remove one choice. A descendant depending on that choice must be cleared explicitly first.
 * @param {VariationExpression} expression @param {Path} path */
export function clearVariation(expression, path) {
  variationSubject(expression, path)
  return checked({ ...expression, choices: expression.choices.filter(row => compare(row.path, path) !== 0) })
}

/** Remove the witness at a site and every annotation below it, retaining the site's own choice.
 * @param {VariationExpression} expression @param {Path} path */
export function collapseVariation(expression, path) {
  variationSubject(expression, path)
  return checked({ ...expression,
    expansions: expression.expansions.filter(row => compare(row.path, path) !== 0 && !below(row.path, path)),
    choices: expression.choices.filter(row => !below(row.path, path)),
  })
}
