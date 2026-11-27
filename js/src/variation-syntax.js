// @ts-check
import { variationExpression, expandedVariation, variationSubject } from './variation-expression.js'

/** @typedef {ReturnType<typeof variationExpression>} Expression */
/** @typedef {import('./variation-product.js').ProductDocument} ProductDocument */
/** @typedef {import('./variation-product.js').Dimension} Dimension */

/** Per-line reader. JSON provides string escapes and the grammar for option lists. */
class Line {
  /** @param {string} text */
  constructor(text) { this.rest = text.trim() }

  /** @param {RegExp} pattern @param {string} expected */
  take(pattern, expected) {
    const match = pattern.exec(this.rest)
    if (!match) throw new SyntaxError('Expected ' + expected)
    this.rest = this.rest.slice(match[0].length).trimStart()
    return match[0]
  }

  word() { return this.take(/^[a-z]+\b/u, 'a directive') }
  string() {
    return /** @type {string} */ (JSON.parse(this.take(/^"(?:[^"\\]|\\.)*"/u, 'a quoted string')))
  }
  path() {
    const path = this.take(/^\/(?:\d+(?:\/\d+)*)?(?=\s|$)/u, 'an operand path such as /0/1')
    const parts = path === '/' ? [] : path.slice(1).split('/').map(Number)
    if (!parts.every(Number.isSafeInteger)) throw new SyntaxError('Operand index too large')
    return parts
  }
  /** @param {string} expected */
  expect(expected) {
    if (this.word() !== expected) throw new SyntaxError('Expected ' + expected)
  }
  array() {
    const values = JSON.parse(this.rest)
    if (!Array.isArray(values) || !values.length) throw new SyntaxError('Expected a nonempty list')
    this.rest = ''
    return values
  }
  strings() {
    const items = this.array()
    if (!items.every(item => typeof item === 'string' && item.length)) throw new SyntaxError('Expected identifiers')
    return /** @type {string[]} */ (items)
  }
  done() {
    if (this.rest) throw new SyntaxError('Unexpected trailing input')
  }
}

/** @param {Line} line @param {number[]} path @returns {Dimension} */
function readDomain(line, path) {
  const mode = line.word()
  if (mode === 'in') {
    const family = line.string()
    return line.rest ? { path, family, forms: line.strings() } : { path, family }
  }
  if (mode === 'among') return { path, families: line.strings() }
  if (mode !== 'options') throw new SyntaxError('Expected in, among or options')
  const options = line.array()
  for (const item of options) {
    if (!item || typeof item !== 'object' || typeof item.text !== 'string' || !item.text.length) {
      throw new SyntaxError('Expected a pinned form spelling')
    }
    const valid = 'source' in item
      ? typeof item.source === 'string' && item.source.trim() && !('family' in item) && !('form' in item)
      : [item.family, item.form].every(name => typeof name === 'string' && name.trim())
    if (!valid) throw new SyntaxError('Expected a source or a family and form identifier')
  }
  return { path, options }
}

/** Each independent operand in the reference tree must be resolvable before a catalogue is loaded.
 * @param {Expression} expression @param {Dimension[]} dimensions */
function checkPaths(expression, dimensions) {
  const paths = dimensions.map(d => {
    variationSubject(expression, d.path)
    return '/' + d.path.join('/') + '/'
  }).sort()
  if (paths.length > 1 && paths.includes('//')) throw new SyntaxError('Independent dimensions overlap')
  for (let i = 1; i < paths.length; i++) {
    if (paths[i].startsWith(paths[i - 1])) {
      throw new SyntaxError('Independent dimensions overlap')
    }
  }
}

/** Parse a single design or a product of independent design choices.
 * @param {string} input @returns {Expression | ProductDocument} */
export function parseVariationSyntax(input) {
  /** @type {Expression | undefined} */
  let expression
  let space = false
  /** @type {Dimension[]} */
  const dimensions = []
  for (const [index, raw] of input.split(/\r?\n/u).entries()) {
    const line = new Line(raw)
    if (!line.rest || line.rest.startsWith('#')) continue
    try {
      const directive = line.word()
      if (!expression) {
        if (directive !== 'variant' && directive !== 'space') throw new SyntaxError('Expected variant or space header')
        space = directive === 'space'
        line.take(/^1(?=\s)/u, 'version 1')
        expression = variationExpression(line.string())
      } else {
        const path = line.path()
        if (directive === 'vary' && space) dimensions.push(readDomain(line, path))
        else if (directive === 'expand' || directive === 'form') {
          const subject = line.string()
          line.take(/^=/u, '=')
          const value = line.string()
          if (directive === 'expand') {
            line.expect('from')
            expression.expansions.push({ path, subject, ids: value, source: line.string() })
          } else {
            const kind = line.word()
            if (kind === 'from') expression.choices.push({ path, subject, text: value, source: line.string() })
            else if (kind === 'in') expression.choices.push({ path, subject, text: value, family: line.string(), form: line.string() })
            else throw new SyntaxError('Expected from or in')
          }
        } else throw new SyntaxError('Unexpected directive ' + directive)
      }
      line.done()
    } catch (error) {
      throw new SyntaxError(`Line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
    }
  }
  if (!expression) throw new SyntaxError('Missing variant or space header')
  expandedVariation(expression)
  if (space) checkPaths(expression, dimensions)
  return space ? { version: 1, expression, dimensions } : expression
}

const quote = JSON.stringify
/** @param {readonly number[]} path */
const pathText = path => '/' + path.join('/')

/** Write the portable notation, including exact local forms and pinned product domains.
 * @param {Expression | ProductDocument} document */
export function formatVariationSyntax(document) {
  if (document.version !== 1) throw new RangeError('Unsupported variation syntax version')
  const expression = 'expression' in document ? document.expression : document
  expandedVariation(expression)
  const lines = [`${'expression' in document ? 'space' : 'variant'} 1 ${quote(expression.base)}`]
  for (const e of expression.expansions) {
    lines.push(`expand ${pathText(e.path)} ${quote(e.subject)} = ${quote(e.ids)} from ${quote(e.source)}`)
  }
  for (const c of expression.choices) {
    const ref = 'source' in c ? `from ${quote(c.source)}` : `in ${quote(c.family)} ${quote(c.form)}`
    lines.push(`form ${pathText(c.path)} ${quote(c.subject)} = ${quote(c.text)} ${ref}`)
  }
  if ('dimensions' in document) checkPaths(expression, document.dimensions)
  if ('dimensions' in document) for (const d of document.dimensions) {
    let target
    if ('options' in d) target = 'options ' + quote(d.options)
    else if ('families' in d) target = 'among ' + quote(d.families)
    else target = 'in ' + quote(d.family) + (d.forms ? ' ' + quote(d.forms) : '')
    readDomain(new Line(target), d.path)
    lines.push(`vary ${pathText(d.path)} ${target}`)
  }
  return lines.join('\n') + '\n'
}
