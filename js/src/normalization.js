// @ts-check
// Resolve font-export identities without changing the caller's rendering or editing tree.

/** @typedef {string | RenderArray} RenderNode */
/** @typedef {Array<string | RenderArray>} RenderArray */
/** @typedef {{ e?: string, s?: string }} RecordEvidence */
/** @typedef {{ node: RenderNode | null, capped: boolean }} ParsedEvidence */
/** @typedef {{ records?: number, nodes?: number, depth?: number, work?: number }} Limits */
/**
 * @typedef {object} RenderPlan
 * @property {string} source The original description, including its operator annotations.
 * @property {string} key The resolved rendering key.
 * @property {RenderNode} node The contracted rendering tree; unsuccessful expansions never replace it.
 * @property {string | null} encoded The whole-node character proved by an export's e field.
 * @property {readonly RenderPlan[]} children Plans for the original children, in source order.
 * @property {boolean} capped Whether a limit prevented further resolution.
 */

const DEFAULTS = Object.freeze({ records: 256, nodes: 256, depth: 32, work: 4096 })

/** Copy an operator and its metadata, replacing only its operands. Never write to a source array.
 * @param {RenderArray} node @param {RenderNode[]} children @returns {RenderArray} */
function withChildren(node, children) {
  const copy = Object.assign([], node)
  copy.splice(1, copy.length - 1, ...children)
  return copy
}

/** Replace a subtree in an evidence candidate, retaining operator annotations along the path.
 * @param {RenderNode} node @param {number[]} path @param {RenderNode} replacement @returns {RenderNode} */
function replaced(node, path, replacement) {
  if (!path.length) return replacement
  if (!Array.isArray(node)) throw new TypeError('A normalization path must address an operator.')
  const [at, ...rest] = path
  const children = node.slice(1)
  children[at] = replaced(children[at], rest, replacement)
  return withChildren(node, children)
}

/**
 * Build a synchronous normalizer over one composer's export records. Positive records are shared
 * across calls; nulls are cached only within a call because their shards may still be loading.
 * The record callback owns that signal. Discard provisional plans while the store reports missing shards.
 *
 * The input is an already parsed composer tree. parse and keyOf must round-trip its modifiers,
 * variation selectors and marks. Only explicit e mappings contract a node. Source atoms resolve
 * through their own e mappings only. Compound evidence search may expand operands through s and
 * contract those descriptions, so an expanded operand can match beside a contracted one.
 *
 * records bounds record callbacks across the normalizer's lifetime (one composer/load pass).
 * nodes counts source and candidate tree visits; depth bounds nesting and rewrite distance; work
 * bounds resolution/search steps. These three budgets reset per resolve call and cover every source
 * child. A capped plan retains proven contractions; its last proved target may still have unread
 * outgoing e evidence. The caller can memoize plans for its load pass.
 *
 * @param {{ record: (key: string) => RecordEvidence | null | undefined,
 *   parse: (text: string) => RenderNode, keyOf: (node: RenderNode) => string,
 *   excluded?: (key: string) => boolean, limits?: Limits }} options
 * @returns {{ resolve: (node: RenderNode) => RenderPlan }}
 */
export function createRenderNormalizer({ record, parse, keyOf, excluded = () => false, limits = {} }) {
  const bounds = { ...DEFAULTS, ...limits }
  for (const [name, value] of Object.entries(bounds)) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`Normalization ${name} must be a nonnegative safe integer.`)
  }

  let recordReads = 0
  /** @type {Map<string, RecordEvidence>} */
  const positiveRecords = new Map()
  return { resolve(input) {
    const used = { nodes: 0, work: 0 }
    let capped = false
    /** @type {Map<string, RecordEvidence | null>} */
    const records = new Map()
    /** @type {Map<string, ParsedEvidence>} */
    const parsed = new Map()
    /** @type {Map<string, string | null>} */
    const contractions = new Map()
    /** @type {Map<string, RenderPlan>} */
    const plans = new Map()

    /** @param {'nodes' | 'work'} kind */
    const take = kind => {
      if (used[kind] >= bounds[kind]) { capped = true; return false }
      used[kind]++
      return true
    }
    /** @param {number} depth */
    const withinDepth = depth => {
      if (depth <= bounds.depth) return true
      capped = true
      return false
    }
    /** Validate and budget a newly introduced tree before traversing it recursively.
     * @param {RenderNode} node @returns {'valid' | 'invalid' | 'capped'} */
    const inspect = node => {
      /** @type {{ node: RenderNode, depth: number, ancestors: Set<RenderArray> }[]} */
      const stack = [{ node, depth: 0, ancestors: new Set() }]
      while (stack.length) {
        const item = /** @type {typeof stack[number]} */ (stack.pop())
        if (!take('nodes') || !withinDepth(item.depth)) return 'capped'
        if (typeof item.node === 'string') continue
        if (!Array.isArray(item.node) || item.node.length < 2 || typeof item.node[0] !== 'string') return 'invalid'
        if (item.ancestors.has(item.node)) return 'invalid'
        const ancestors = new Set(item.ancestors).add(item.node)
        for (let i = item.node.length - 1; i > 0; i--) stack.push({ node: item.node[i], depth: item.depth + 1, ancestors })
      }
      return 'valid'
    }
    /** @param {string} key @returns {RecordEvidence | null} */
    const read = key => {
      const known = positiveRecords.get(key)
      if (known) return known
      if (records.has(key)) return records.get(key) ?? null
      if (recordReads >= bounds.records) { capped = true; return null }
      recordReads++
      const value = record(key) ?? null
      if (value !== null) positiveRecords.set(key, value)
      records.set(key, value)
      return value
    }
    /** Evidence that fails to round-trip must not erase operator annotations.
     * @param {string} text @returns {ParsedEvidence} */
    const readTree = text => {
      const known = parsed.get(text)
      if (known) return known
      /** @type {ParsedEvidence} */
      const result = { node: null, capped: false }
      try {
        const candidate = parse(text), status = inspect(candidate)
        result.capped = status === 'capped'
        if (status === 'valid' && keyOf(candidate) === text) result.node = candidate
      } catch { /* Malformed source descriptions provide no rendering identity. */ }
      parsed.set(text, result)
      return result
    }
    /** Follow only explicit character targets; cyclic chains provide no identity.
     * @param {string} start @returns {string | null} */
    const contract = start => {
      if (contractions.has(start)) return contractions.get(start) ?? null
      const seen = new Set([start])
      let current = start, changed = false
      /** @param {string | null} result */
      const finish = result => { contractions.set(start, result); return result }
      for (let depth = 0; ; depth++) {
        if (!withinDepth(depth) || !take('work')) return finish(changed ? current : null)
        const target = read(current)?.e
        if (target == null) return finish(changed ? current : null)
        if (typeof target !== 'string' || !target || seen.has(target) || excluded(target)) return finish(null)
        const tree = readTree(target)
        if (typeof tree.node !== 'string') return finish(tree.capped && changed ? current : null)
        seen.add(target)
        current = target
        changed = true
      }
    }

    /** Search exact export evidence without committing the expansions to the rendering tree.
     * @param {RenderNode[]} seeds @returns {string | null} */
    const evidence = seeds => {
      /** @type {{ node: RenderNode, distance: number }[]} */
      const queue = []
      const seen = new Set()
      /** @param {RenderNode} node @param {number} distance */
      const enqueue = (node, distance) => {
        if (!take('work')) return
        const key = keyOf(node)
        if (seen.has(key)) return
        if (!withinDepth(distance) || inspect(node) !== 'valid') return
        seen.add(key)
        queue.push({ node, distance })
      }
      seeds.forEach(node => enqueue(node, 0))
      for (let at = 0; at < queue.length && !capped; at++) {
        const { node, distance } = queue[at]
        if (!take('work')) break
        const answer = contract(keyOf(node))
        if (answer) return answer
        /** @type {{ node: RenderNode, path: number[] }[]} */
        const pending = [{ node, path: [] }]
        while (pending.length && !capped) {
          if (!take('work')) break
          const part = /** @type {typeof pending[number]} */ (pending.pop())
          const key = keyOf(part.node)
          if (part.path.length) {
            const target = contract(key)
            if (target && target !== key) enqueue(replaced(node, part.path, target), distance + 1)
          }
          if (Array.isArray(part.node)) {
            for (let i = part.node.length - 1; i > 0; i--) pending.push({ node: part.node[i], path: [...part.path, i - 1] })
          } else {
            const description = read(key)?.s
            if (typeof description === 'string' && description !== key) {
              const expanded = readTree(description)
              if (expanded.node !== null) enqueue(replaced(node, part.path, expanded.node), distance + 1)
            }
          }
        }
      }
      return null
    }
    /** @param {RenderNode} node @param {number} depth @returns {RenderPlan} */
    const walk = (node, depth) => {
      const source = keyOf(node)
      const cached = plans.get(source)
      if (cached) return cached
      /** @type {RenderPlan[]} */
      const children = []
      let normalized = node, encoded = null
      if (take('work') && withinDepth(depth)) {
        // Literal source evidence wins when multiple descriptions lead to different characters.
        encoded = contract(source)
        if (Array.isArray(node)) {
          for (const child of node.slice(1)) children.push(walk(child, depth + 1))
          normalized = withChildren(node, children.map(child => child.node))
        }
        if (!encoded) encoded = contract(keyOf(normalized))
        if (!encoded && !capped && Array.isArray(node)) encoded = evidence([normalized, node])
        if (encoded) normalized = encoded
      }
      if (Array.isArray(normalized) && normalized !== node) Object.freeze(normalized)
      const plan = Object.freeze({ source, key: keyOf(normalized), node: normalized, encoded,
        children: Object.freeze(children), capped })
      plans.set(source, plan)
      return plan
    }

    if (inspect(input) !== 'valid') return Object.freeze({ source: keyOf(input), key: keyOf(input), node: input,
      encoded: null, children: Object.freeze([]), capped })
    const plan = walk(input, 0)
    return capped === plan.capped ? plan : Object.freeze({ ...plan, capped })
  } }
}
