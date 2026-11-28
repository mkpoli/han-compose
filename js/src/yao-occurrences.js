// @ts-check
import index from './yao-hosts.json' with { type: 'json' }
import { tokens } from './tokens.js'
import { arity, splitToneMarks } from './tree.js'
import { resolveYaoForm } from './yao-forms.js'

/** @type {Record<string,[string,string,number]>} */
const hosts = /** @type {any} */ (index.descriptions)
/** Encoded characters with a documented path to 幺, in code point order. */
export const yaoCharacters = Object.freeze(['幺', ...Object.keys(hosts).filter(c => [...c].length === 1)]
  .sort((a,b) => /** @type {number} */ (a.codePointAt(0)) - /** @type {number} */ (b.codePointAt(0))))

/** The sourced decomposition used when an edit opens this operand.
 * @param {string} host */
export function yaoDecomposition(host) {
  const row = hosts[host]
  return Object.hasOwn(hosts, host) ? { ids: row[0], regions: row[1], source: index.sources[row[2]] } : null
}

/** @typedef {{path:number[],text:string,form:string|null}} YaoOccurrence */
/** @typedef {{text:string,start:number,end:number}} Span */
/** @param {string} text */
function leaves(text) {
  const parts = tokens(text)
  const subtractions = parts.filter(t => t.text.startsWith('㇯'))
  return parts.filter(t => t.text && !arity([...t.text][0]) &&
    !subtractions.some(s => s.path.every((v,i) => t.path[i] === v)))
}

// Cache the token offsets of the immutable index. Draft strings are read afresh.
const parsed = new Map()
/** @param {string} text @param {number[]} prefix @param {Span[]} frames
 * @param {ReturnType<typeof leaves>} parts
 * @returns {Generator<{site:YaoOccurrence,frames:Span[]}>} */
function* walk(text, prefix, frames, parts) {
  for (const token of parts) {
    const {rest} = splitToneMarks(token.text)
    const choice = resolveYaoForm(rest)
    const expanded = Object.hasOwn(hosts, rest) ? hosts[rest][0] : null
    if (!expanded && !choice && rest !== '幺') continue
    const path = prefix.concat(token.path)
    const route = [...frames, { text, start: token.start, end: token.start + rest.length }]
    if (expanded) {
      let children = parsed.get(expanded)
      if (!children) {
        children = leaves(expanded)
        parsed.set(expanded, children)
      }
      yield* walk(expanded, path, route, children)
    } else yield {site:{path, text: rest, form: choice?.id ?? null}, frames: route}
  }
}

/** Each separately addressable 幺 in the written IDS and reachable encoded operands.
 * Paths descend through the source IDS of encoded characters. Unrelated and
 * unsupported operands remain opaque. An invalid draft has no editable sites.
 * @param {string} ids @returns {YaoOccurrence[]} */
export function yaoOccurrences(ids) {
  return Array.from(walk(ids, [], [], leaves(ids)), result => result.site)
}

/** Write a form (by canonical ID or spelling) at exactly one source operand path.
 * Passing null writes bare 幺. Expand only ancestors of the requested occurrence,
 * leaving existing entity spellings, selectors, modifiers, slots and marks intact.
 * @param {string} ids @param {readonly number[]} path @param {string|null} form */
export function selectYao(ids, path, form) {
  const replacement = form === null ? '幺' : resolveYaoForm(form)?.text
  if (!replacement) throw new RangeError('Unknown 幺 form: ' + form)
  for (const {site, frames} of walk(ids, [], [], leaves(ids))) {
    if (path.length !== site.path.length || !path.every((v, i) => site.path[i] === v)) continue
    if (replacement === site.text) return ids
    return frames.reduceRight((part, span) =>
      span.text.slice(0, span.start) + part + span.text.slice(span.end), replacement)
  }
  throw new RangeError('No 幺 at operand path [' + path.join(', ') + ']')
}
