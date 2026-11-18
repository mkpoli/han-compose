// @ts-nocheck: a port of han-compose's Python, kept line for line; its types are the arrays it reads.
// The composer in the browser: han-compose's export (manifest, layout and the drawing data of each
// key) loaded as a sequence needs it, and the sequence drawn from it as an SVG path. A file is
// fetched once a page; a gzipped one (the export writes them so) is unpacked with DecompressionStream.
import { APPROXIMATE, Composer, EMPTY, LookupError, designedSources, keyOf, leafCutChar, wheatFaceHosts, mapOperands, parseTree } from './compose.js'
import { splitDescription } from './tree.js'
import { hangulOfIds } from './hangul-ids.js'
import { composeJamo } from './hangul.js'
import { withoutMarks } from './tree.js'
import { ASCENT } from './geometry.js'
import { drawnBox, svgPath } from './geometry.js'
import { readLayout } from './layout.js'
import { isComponentForm, isGroupedForm } from './component-forms.js'
import { hexOf } from './sha256.js'
import { pyramidOnBase, pyramidRows } from './pyramid-rows.js'
import { unicodeSource } from './unicode.js'
import { download } from './retry.js'

export { LookupError } from './compose.js'

// A syllable written as jamo draws its precomposed glyph: 라 typed as 라 is still 라.
/** @param {any} part @returns {any} */
function normaliseJamo(part) {
  if (typeof part === 'string') {
    // A tone mark belongs to the syllable before it, so the run under it is what gets rewritten.
    const base = /** @type {string} */ (withoutMarks(part))
    const marks = base === part ? '' : part.slice(base.length)
    const written = composeJamo(base)
    return written && [...written].length === 1 ? written + marks : part
  }
  // The composer's own tree holds each node as its operator followed by its operands.
  return Array.isArray(part) ? mapOperands(part, normaliseJamo) : part
}

/** `text` with every jamo-run leaf written as the syllable it composes. @param {string} text @param {(ch: string) => number} arity @returns {string} */
function normaliseHangul(text, arity) {
  const written = normaliseJamo(parseTree(text, arity))
  return typeof written === 'string' ? written : keyOf(written)
}

export async function unpack(buffer) {
  const head = new Uint8Array(buffer, 0, 2)
  if (head[0] !== 0x1f || head[1] !== 0x8b) return new TextDecoder().decode(buffer)
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(stream).text()
}

// Where the export keeps each key's data: the one place that knows file names. han-compose's format 7
// packs the records in `g/<hh>/<hhhh>.json` and the host lists in `p/<hhh>.json`, the digits the first
// of the SHA-256 of the key's UTF-8 (of place TAB operand for a host list); each file is an object
// from the key (place TAB operand) to the record or list, gzip bytes under a .json name, served as
// application/octet-stream and unpacked here. A record shard holds a few records, so a drawing reads
// little beyond the records it uses. A record lists the places it has host lists in (`P`, absent when
// it has none). A host list holds every entry of the composer's index with the fields it ranks by. An
// entry's cut `c` is null where the composer could not cut it; else its piece as the indices `k` of
// the host glyph's contours it keeps (or its own outlines `p`), its box `b`, the node's frame `fr`,
// `wh` for the whole character, the gap `g` and `kv` for a KanjiVG cut, read here onto the entry. A
// cut marked `pc` was made only under a parity row's exclusion.
//
// The kin table (`kin.json`) loads when a drawing first takes an enclosing part from its kin's
// hosts: the kins of each lower part by place, their hosts' cuts along KanjiVG and the upper parts
// cut from characters holding the enclosing part on the left, each piece as contour indices into its
// host's glyph. An export written before it has none.
//
// Two files load when a description first needs them. The identity table (`identity.json`) holds
// every character's sequence and the character each sequence describes, as the records do (`s`,
// `e`): a description holding an operator reads it, and with it read, finding what the description
// names reads no record. The learned layout sets parts beside each other: a description holding an
// operator of two operands or more reads it too.
const FORMAT = 7
const cutEntry = h => h.c === null ? { ...h } : { ...h, ...h.c, c: true }
const hostsKey = (key, place) => `${place}\t${key}`
const recordFile = key => { const h = hexOf(key); return `g/${h.slice(0, 2)}/${h.slice(0, 4)}.json` }
const hostsFile = (key, place) => `p/${hexOf(hostsKey(key, place)).slice(0, 3)}.json`
/** What a shard holds under `key`, or null. A shard is an object keyed by what a description
 *  writes, so only its own entries count: `constructor` names no record. */
const held = (shard, key) => shard && Object.hasOwn(shard, key) ? shard[key] : null

/** What the table answers for a key whose record holds no sequence and describes no character. */
const NEITHER = Object.freeze({})
/** The identity table as a lookup: a key's `{ e, s }` as its record holds them, `NEITHER` for a
 *  record with neither, and null for a key that has no record, which is what reading the record
 *  itself would answer. `characters` and `sequences` are lists in step, joined by newlines; a
 *  sequence describes the last character listed with it, except where `e` names another, or none
 *  (null); `plain` lists the keys that have a record with neither. */
function readIdentity({ characters, sequences, e, plain }) {
  const sequenceOf = new Map(), described = new Map()
  if (characters) {
    const written = sequences.split('\n')
    characters.split('\n').forEach((character, i) => { sequenceOf.set(character, written[i]); described.set(written[i], character) })
  }
  for (const [sequence, character] of Object.entries(e)) {
    if (character === null) described.delete(sequence)
    else described.set(sequence, character)
  }
  const recorded = new Set(plain ? plain.split('\n') : [])
  const known = new Map()
  return key => {
    if (!known.has(key)) {
      const e = described.get(key), s = sequenceOf.get(key)
      known.set(key, e === undefined && s === undefined ? (recorded.has(key) ? NEITHER : null)
        : { ...(e === undefined ? {} : { e }), ...(s === undefined ? {} : { s }) })
    }
    return known.get(key)
  }
}

/**
 * A source of the export's files. `read(name)` answers a file's bytes (an ArrayBuffer) by its name
 * in the export (`manifest.json`, `layout.json`, `g/07/07a3.json`), or null where there is no such
 * file; `fromUrl` builds one over HTTP.
 */
export function createSource(read, { concurrency = 32 } = {}) {
  let ready = null
  // At most `concurrency` files are asked for at once; the rest wait their turn.
  let active = 0
  const waiting = []
  const limited = name => new Promise((resolve, reject) => {
    const run = () => {
      active++
      read(name).then(resolve, reject).finally(() => { active--; waiting.shift()?.() })
    }
    if (active < concurrency) run()
    else waiting.push(run)
  })
  // Host lists are read into the composer's order once a page, so their pieces are decoded once.
  const files = new Map(), loading = new Map(), lists = new Map()
  let layout = null, identity = null, operators = null
  const model = () => source.manifest.files
  const isModel = name => name === model().layout.path || name === model().identity.path
  const parsed = async (name, bytes) => {
    if (!isModel(name)) return bytes ? JSON.parse(await unpack(bytes)) : {}
    if (!bytes) throw new Error(`${name}: missing`)
    const value = JSON.parse(await unpack(bytes))
    if (name === model().layout.path) layout = readLayout(value)
    else identity = readIdentity(value)
    // The layout and the table are kept as they are read, not their text beside them.
    return true
  }
  const source = {
    manifest: null,
    /** The learned layout: null until a drawing has loaded it (`modelFiles`). */
    get layout() { return layout },
    ready() {
      ready ??= (async () => {
        source.manifest = JSON.parse(await unpack(await read('manifest.json')))
        if (source.manifest.format !== FORMAT) throw new Error(`The composer export's format ${source.manifest.format} is not read here.`)
        const { BINARY, TERNARY, UNARY } = source.manifest.constants
        operators = new Set([...BINARY, ...TERNARY, ...UNARY])
      })().catch(error => { ready = null; throw error })
      return ready
    },
    /** The files a description holding an operator reads beside its records: the identity table,
     *  and the learned layout unless `layout` is false, as for a description that sets no parts
     *  beside each other. They load like any file, by name. */
    modelFiles: ({ layout: learned = true } = {}) => [model().identity.path, ...(learned ? [model().layout.path] : [])],
    /** Loads files by name, each once; a shard the export lacks reads as empty. */
    load(names) {
      return Promise.all([...names].map(name => {
        if (files.has(name)) return null
        if (!loading.has(name)) loading.set(name, limited(name).then(bytes => parsed(name, bytes)).then(value => { files.set(name, value) })
          // A drawing that needs the layout or the table cannot be made without it, whether the file
          // could not be fetched or could not be read: the page then draws what it holds itself.
          .catch(error => { throw isModel(name) ? Object.assign(error, { unavailable: true }) : error })
          .finally(() => loading.delete(name)))
        return loading.get(name)
      }))
    },
    /** The files holding the records of `keys`, to load before drawing. */
    filesOf: keys => new Set([...keys].map(recordFile)),
    /** The data a composer reads, noting each file it asked for that is not loaded. */
    store() {
      const missing = new Set()
      const file = name => { const found = files.get(name); if (!found) missing.add(name); return found ?? null }
      return {
        manifest: source.manifest, missing,
        // The learned layout, asked for when a node is first laid out by it.
        get layout() { if (!layout) missing.add(model().layout.path); return layout },
        rec: key => held(file(recordFile(key)), key),
        // A host list in the order of the composer's index (`r`).
        hosts: (key, place) => {
          const f = file(hostsFile(key, place)), id = hostsKey(key, place)
          if (!f) return []
          if (!lists.has(id)) lists.set(id, (held(f, id) ?? []).map(cutEntry).sort((a, b) => a.r - b.r))
          return lists.get(id)
        },
        places: key => held(file(recordFile(key)), key)?.P ?? [],
        // The kin table, read when an enclosing part no host draws asks for it; null for an export
        // without one, which draws that part as before.
        kin: () => model().kin ? file(model().kin.path) : null,
        // A key's sequence and the character it describes (`{ e, s }`, either or neither), or null
        // for a key with no record, from the identity table. Until the table is read a single
        // character's record answers (undefined here), so a lone character is drawn without it; a
        // sequence asks for the table, since finding what it names tries many spellings, each a
        // record of its own.
        identity: key => {
          if (identity) return identity(key)
          const first = key.codePointAt(0)
          if (first === undefined || !operators.has(String.fromCodePoint(first))) return undefined
          missing.add(model().identity.path)
          return null
        },
      }
    },
  }
  return source
}

/** A source over HTTP: `base` is the folder holding the export, `suffix` what each name carries there
 *  (`.gz`). `load` reads a Unicode shard of the package for a character the export lacks, where a
 *  host serves those files itself; without it the package's own copy is read. */
export function fromUrl(base, { suffix = '', fetch: get = download, load } = {}) {
  const root = base.endsWith('/') ? base : `${base}/`
  return unicodeSource({ ...(load ? { load } : {}), fallback: createSource(async name => {
    const response = await get(`${root}${name}${suffix}`)
    // Only a shard (`g/`, `p/`) may be missing, as the export writes none where no key falls; a
    // missing manifest or layout fails with its status like any other error.
    if (response.status === 404 && /^[gp]\//.test(name)) return null
    if (!response.ok) throw new Error(`${name}: ${response.status}`)
    return await response.arrayBuffer()
  }) })
}

// A drawing asks for files as it needs them: each round loads those the pass before found missing.
// Rare parts keep finding new hosts, so a deeply nested description can need many rounds; the cap
// bounds how many rounds a drawing may take.
const ROUNDS = 64
/** The largest description drawn. Every sequence BabelStone lists fits: the deepest nest six levels
 *  (𰻞, 𦧄) and the largest holds 21 operators (𦧄). */
export const LIMITS = { nodes: 24, depth: 8 }
/** The most layers a pyramid preview draws. Each layer adds a cell, so 64 layers is 2,080 cells. */
export const PYRAMID_LAYERS = 64

/** How many operators a tree has, and how deep they nest: a parsed tree (['⿰', …]) or the editor's
 *  (`{ op, parts }`). */
export function size(tree) {
  const kids = Array.isArray(tree) ? tree.slice(1) : tree && typeof tree === 'object' ? tree.parts : null
  if (!kids) return { nodes: 0, depth: 0 }
  const sizes = kids.map(size)
  return { nodes: 1 + sizes.reduce((s, k) => s + k.nodes, 0), depth: 1 + Math.max(0, ...sizes.map(k => k.depth)) }
}
/** Whether a tree is larger than a preview draws (`LIMITS`), unless it is a pyramid within
 *  `PYRAMID_LAYERS`. A pyramid of two layers counts too: its cells are laid out apart, never merged
 *  into the overlapping parts the limits guard against. */
/** Whether a subtree is within the structural limits a preview draws. */
const within = node => {
  const { nodes, depth } = size(node)
  return nodes <= LIMITS.nodes && depth <= LIMITS.depth
}
export const tooLarge = tree => {
  const pyramid = pyramidRows(tree, { minLayers: 2 })
  if (pyramid) return pyramid.layers > PYRAMID_LAYERS || !within(pyramid.cell)
  const onBase = pyramidOnBase(tree)
  if (onBase) return onBase.layers > PYRAMID_LAYERS || !within(onBase.cell) || !within(onBase.base)
  const { nodes, depth } = size(tree)
  return nodes > LIMITS.nodes || depth > LIMITS.depth
}

/** Every key the tree names, nodes and leaves, as the first files to load; none holding an empty slot.
 *  A pyramid asks for its repeated cell once, and that cell's own parts, instead of once per cell. */
function keysOf(tree, out = [], separate = false, fontStyle = 'sans', root = true) {
  if (root) {
    const pyramid = pyramidRows(tree)
    if (pyramid) {
      const cell = keyOf(pyramid.cell)
      if (!cell.includes(EMPTY)) out.push(cell)
      if (Array.isArray(pyramid.cell)) pyramid.cell.slice(1).forEach(n => keysOf(n, out, separate, fontStyle, false))
      return out
    }
  }
  if ((separate ? isGroupedForm : isComponentForm)(keyOf(tree), fontStyle)) return out
  if (!keyOf(tree).includes(EMPTY)) out.push(keyOf(tree))
  const designed = leafCutChar(keyOf(tree))
  if (designed) out.push(designed)
  if (Array.isArray(tree)) tree.slice(1).forEach(n => keysOf(n, out, separate, fontStyle, false))
  return out
}

// The operators `sequence` writes with a zi.tools modifier, which the layout does not apply. ㇯'s
// index is applied: the composer says itself where its subtraction is approximate.
const MODIFIER = /([\u2FF4-\u2FF7\u2FFB\u2FFC])\[[0-9:,._xabcdlr|-]+\]/gu
/** @param {string} sequence */
function modifiedOperators(sequence) {
  return [...sequence.matchAll(MODIFIER)].map(match => match[1])
}

// A dedicated form consumes its internal operators, including the mirrored spelling.
function extraOperators(tree, { fontStyle, separate, nativeEnclosures }) {
  if (typeof tree === 'string') return []
  const key = keyOf(tree)
  if ((separate ? isGroupedForm : isComponentForm)(key, fontStyle)) return []
  const op = nativeEnclosures.has(key) ? [] : [tree[0]]
  // A subtraction is approximate only where the composer says so: drawn from a character's own
  // outlines or from what is left of its description, it is not.
  return [...op, ...tree.slice(1).flatMap(child => extraOperators(child, { fontStyle, separate, nativeEnclosures }))].filter(op => APPROXIMATE.includes(op) && op !== '㇯')
}

/** Whether a tree holds an operator of two operands or more: such a description is laid out by the
 *  learned model. */
const setsParts = tree => Array.isArray(tree) && (tree.length > 2 || tree.slice(1).some(setsParts))
/** The model files a tree reads before it is drawn: none for a lone character, the identity table
 *  for a description holding an operator, and the layout too where it sets parts beside each other.
 *  A character turned or mirrored whole (⿾正) is resolved through the table and laid out by none. */
const modelOf = (source, tree) => Array.isArray(tree) ? source.modelFiles({ layout: setsParts(tree) }) : []

/** A box in font units (y up) as the drawing's SVG box has it: [x, y, width, height], y down. */
export const svgBox = b => [b[0], ASCENT - b[3], b[2] - b[0], b[3] - b[1]]

/**
 * Where each leaf of `sequence` goes before it is drawn (`Composer.sketch`), once the manifest and the
 * layout have loaded: `[{ index, box, empty }]`, boxes as `svgBox` gives them.
 */
export async function sketch(source, sequence, { fontStyle = 'sans' } = {}) {
  await source.ready()
  // Loose marks hang off the drawing; they are not leaves of it.
  const { base, marks } = splitDescription(sequence)
  const arity = ch => { const c = source.manifest.constants; return c.BINARY.includes(ch) ? 2 : c.TERNARY.includes(ch) ? 3 : c.UNARY.includes(ch) ? 1 : 0 }
  const description = normaliseHangul(hangulOfIds(base) ?? base, arity)
  // A partitioned glyph lays its leaves out from its own outlines, so its record loads before the layout.
  const designed = leafCutChar(description)
  if (designed) {
    await source.load(source.filesOf([designed]))
    const store = source.store()
    new Composer(store, { fontStyle }).glyphRecord(designed)
    if (store.missing.size) await source.load(store.missing)
  }
  // A mark beside the drawing takes room from the face, so its outline is read before the layout.
  if (marks) {
    await source.load(source.filesOf([...marks]))
    const store = source.store()
    new Composer(store, { fontStyle }).faceBeside(marks)
    if (store.missing.size) await source.load(store.missing)
  }
  await source.load([...source.filesOf(wheatFaceHosts(description)), ...modelOf(source, parseTree(description, arity))])
  // A description that asked for the layout or the table after all is sketched again with them.
  for (let again = false; ; again = true) {
    const store = source.store()
    const leaves = new Composer(store, { fontStyle }).sketch(description, marks)
    const model = source.modelFiles().filter(name => store.missing.has(name))
    if (again || !model.length) return leaves.map(leaf => ({ ...leaf, box: svgBox(leaf.box) }))
    await source.load(model)
  }
}

/**
 * `sequence` drawn by the composer: `{ d, cut, slots, stroke, parts, origins, kanjivg, approximate }`,
 * `d` the SVG path of its outlines in a 1000-unit box (y down, nonzero fill), `cut` the path of what
 * ㇯ takes away (empty when nothing is), `slots` each empty slot (⬚) as `{ index, box }`, numbered in
 * reading order, in the box the layout gave it (as `svgBox` gives it), `stroke` the stroke widths
 * the drawing is weighted to, across x and y, `parts` each drawn part's origin, box, path `d` and
 * whether it is a cut, `origins` where each part came from, `kanjivg` whether a part was cut along
 * KanjiVG's groups or a hand form read from it, and `approximate` the operators it uses that the
 * composer itself does not draw. `exclude` lists characters nothing is taken from, `face` the box a
 * whole character fills without them, and `separate` draws operands as individual pieces where possible,
 * including cuts from a matching whole glyph (falling back to the whole glyph when the operands cannot be drawn).
 * `layout` is `'composed'`, `'cells'`, or `'auto'`: cells lays each leaf out in its own cell and
 * rejects loose marks, while auto uses cells for a description of eight or more leaves that names no
 * character as a whole, since the composer's host cuts then overlap its parts. A cell drawing has
 * `cells: true` and its parts' `origin` reads `cells <char>`.
 * Throws LookupError when a part can be drawn no way or the sequence is larger than `LIMITS`.
 */
export async function compose(source, sequence, { exclude = [], face = null, separate = false, fontStyle = 'sans', layout = 'auto', keepBars = false } = {}) {
  await source.ready()
  const arity = ch => {
    const c = source.manifest.constants
    return c.BINARY.includes(ch) ? 2 : c.TERNARY.includes(ch) ? 3 : c.UNARY.includes(ch) ? 1 : 0
  }
  const { base, marks } = splitDescription(sequence)
  if (layout === 'cells' && marks) throw new LookupError('Cells layout does not draw loose marks.')
  if (layout === 'cells' && modifiedOperators(sequence).length) throw new LookupError('Cells layout does not draw modified operators.')
  // A Hangul syllable described letter by letter draws as the syllable: ⿰ㄱㅏ is 가.
  const syllable = hangulOfIds(base)
  const description = normaliseHangul(syllable ?? base, arity)
  const tree = parseTree(description, arity)
  if (tooLarge(tree)) throw new LookupError(`${sequence} is larger than a preview draws.`)
  // A mark's outline loads like a component's. The identity table and the layout load beside the
  // first records of a description that reads them.
  await source.load([...source.filesOf([...keysOf(tree, [], separate, fontStyle), ...marks, ...wheatFaceHosts(description), ...designedSources(tree)]), ...modelOf(source, tree)])
  for (let round = 0; round < ROUNDS; round++) {
    const store = source.store()
    let drawn = null, failure = null, composer = null, cells = false
    try {
      composer = new Composer(store, { exclude, face, separate, fontStyle, keepBars })
      cells = !marks && !modifiedOperators(sequence).length
        && (layout === 'cells' || (layout === 'auto' && composer.cellsFor(tree, marks)))
      drawn = cells ? composer.cellLayout(tree) : composer.compose(description, marks)
    } catch (error) {
      // A separated drawing can fail where the whole glyph exists. Keep the glyph rather than fail
      // the preview: a view then finds one piece and leaves it alone.
      if (separate && !cells && !store.missing.size && error instanceof LookupError) {
        try { composer = new Composer(store, { exclude, face, fontStyle, keepBars }); drawn = composer.compose(description, marks) } catch (again) { failure = again }
      } else failure = error
    }
    // A pass that met data not loaded yet only gathers what to load (`Composer.partial`); the drawing
    // is made once all of it is here.
    if (store.missing.size) { await source.load(store.missing); continue }
    if (failure) throw failure
    const ink = drawn.filter(p => p.empty === undefined)
    return { d: svgPath(ink.filter(p => !p.cut)), cut: svgPath(ink.filter(p => p.cut)),
      slots: drawn.filter(p => p.empty !== undefined).map(p => ({ index: p.empty, box: svgBox(drawnBox(p)) })),
      missing: [...(composer.missingGlyphs ?? [])],
      normalization: { capped: [...composer.resolutions.values()].some(plan => plan.capped) },
      stroke: composer.stroke ?? null,
      parts: ink.map(p => ({ ...(p.leaf === undefined ? {} : { leaf: p.leaf }), origin: p.origin, box: svgBox(drawnBox(p)), d: svgPath([p]), cut: Boolean(p.cut), ...(p.part.strokes ? { strokes: p.part.strokes.map(([id, contours]) => [id, [...contours]]) } : {}) })), origins: ink.map(p => p.origin),
      kanjivg: Boolean(composer.handForms) || drawn.some(p => p.part.kv),
      approximate: [...new Set([...extraOperators(composer.cancelTransforms(tree), composer), ...composer.approximate, ...modifiedOperators(sequence)])],
      ...(cells ? { cells: true } : {}) }
  }
  throw new LookupError(`${sequence} needs more data than ${ROUNDS} rounds load.`)
}
