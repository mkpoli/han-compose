// @ts-check
import { tokens } from './tokens.js'
import { descriptionEnd } from './tree.js'

/** A locus in the family's reference IDS. Paths address operands from zero. Stroke ordinals,
 * when specified, refer to strokes numbered from one in the cited witness.
 * @typedef {{path: number[], strokes?: number[]}} Locus */
/** @typedef {{id: string, property: string, unit?: string, witness?: string, locus: Locus[], values: string[]}} VariationAxis */
/** @typedef {{id: string, text: string, traits?: Record<string,string>}} VariationForm */
/** @typedef {{id: string, subjects: string[], reference?: string, evidenceOnly?: boolean, axes?: VariationAxis[], forms: VariationForm[]}} VariationFamily */

/** One filled component or IDS in the composer's grammar, as written.
 * @param {string} text */
function isSpelling(text) {
  const chars = [...text]
  return chars.length > 0 && descriptionEnd(chars) === chars.length && !chars.includes('⬚') && !chars.includes('＋')
}

/** @param {string} text @param {readonly number[]} path */
function occurrence(text, path) {
  return tokens(text).find(t => t.path.length === path.length && t.path.every((index, i) => index === path[i]))
}

/** Freeze the registry's private copy, including shared source records.
 * @param {object} object */
function freeze(object) {
  if (!Object.isFrozen(object)) {
    Object.freeze(object)
    for (const value of Object.values(object)) if (value && typeof value === 'object') freeze(value)
  }
}

/**
 * Index a JSON catalogue. A spelling can occur in several independent families and multiple
 * source records can describe the same glyph. A family lists only witnessed combinations.
 * @template {VariationFamily} F
 * @param {readonly F[]} families
 */
export function createVariationRegistry(families) {
  const records = structuredClone(families)
  freeze(records)
  /** @type {Map<string,F>} */
  const byId = new Map()
  /** @type {Map<string,F[]>} */
  const byText = new Map()
  for (const family of records) {
    if (!family.id || byId.has(family.id)) throw new Error(`Duplicate or empty family ID: ${family.id}`)
    if (family.reference !== undefined && !isSpelling(family.reference)) throw new Error(`Invalid reference in ${family.id}`)
    byId.set(family.id, family)
    if (!family.forms.length && !family.evidenceOnly) throw new Error(`Empty family: ${family.id}`)
    const axes = new Map()
    for (const axis of family.axes ?? []) {
      if (!axis.id || axes.has(axis.id) || !axis.property || !axis.locus.length || !axis.values.length ||
        new Set(axis.values).size !== axis.values.length) throw new Error(`Invalid axis in ${family.id}: ${axis.id}`)
      for (const { path, strokes } of axis.locus) {
        if (!Array.isArray(path) || !path.every(i => Number.isSafeInteger(i) && i >= 0) ||
          (path.length && (!family.reference || !occurrence(family.reference, path))) ||
          strokes?.some(i => !Number.isSafeInteger(i) || i < 1)) throw new Error(`Invalid locus: ${family.id}/${axis.id}`)
      }
      axes.set(axis.id, new Set(axis.values))
    }
    const ids = new Set()
    const exact = new Set()
    const spellings = new Set(family.subjects)
    for (const form of family.forms) {
      if (!form.id || ids.has(form.id) || !isSpelling(form.text)) throw new Error(`Invalid form: ${family.id}/${form.id}`)
      if (exact.has(form.text) && !family.evidenceOnly) throw new Error(`Ambiguous spelling in ${family.id}: ${form.text}`)
      exact.add(form.text)
      ids.add(form.id)
      for (const [axis, value] of Object.entries(form.traits ?? {})) {
        if (!axes.get(axis)?.has(value)) throw new Error(`Unknown trait: ${family.id}/${axis}/${value}`)
      }
      spellings.add(form.text)
    }
    for (const text of spellings) {
      const known = byText.get(text)
      if (known) known.push(family)
      else byText.set(text, [family])
    }
  }
  for (const matches of byText.values()) Object.freeze(matches)
  /** @param {string} text @returns {readonly F[]} */
  const familiesFor = text => byText.get(text) ?? []
  return Object.freeze({
    families: records,
    familiesFor,
    /** Find forms with the requested set of observed features.
     * @param {string} familyId @param {Record<string,string>} traits */
    match(familyId, traits) {
      return byId.get(familyId)?.forms.filter(form =>
        Object.entries(traits).every(([axis, value]) => Object.hasOwn(form.traits ?? {}, axis) && form.traits?.[axis] === value)) ?? []
    },
    /** Each applicable family and its exact forms at this occurrence. A bare subject can have none.
     * @param {string} sequence @param {readonly number[]} path */
    at(sequence, path) {
      const span = occurrence(sequence, path)
      if (!span) return []
      const text = sequence.slice(span.start, span.end)
      return familiesFor(text).map(family => ({ family, forms: family.forms.filter(form => form.text === text) }))
    },
    /** Write a form at one occurrence. Siblings retain their source spelling, even when parsing
     * would normalize their stroke chain or slot marker.
     * @param {string} sequence @param {readonly number[]} path @param {string} familyId @param {string} formId
     * @param {{asReplacement?:boolean}} [options] Explicitly replace a component using a source criterion. */
    select(sequence, path, familyId, formId, { asReplacement = false } = {}) {
      const span = occurrence(sequence, path)
      const family = byId.get(familyId)
      if (!span || !family || !familiesFor(sequence.slice(span.start, span.end)).includes(family)) {
        throw new RangeError(`No ${familyId} family at [${path}]`)
      }
      if (family.evidenceOnly && !asReplacement) throw new RangeError(`Evidence requires explicit replacement: ${familyId}`)
      const form = family.forms.find(option => option.id === formId)
      if (!form) throw new RangeError(`Unknown form: ${familyId}/${formId}`)
      return sequence.slice(0, span.start) + form.text + sequence.slice(span.end)
    },
  })
}

/** @param {string} input */
function* ivdRows(input) {
  for (const [index, raw] of input.split(/\r?\n/u).entries()) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const fields = line.split(';').map(field => field.trim())
    if (fields.length !== 3 || fields.some(field => !field)) throw new SyntaxError(`Invalid IVD record at line ${index + 1}`)
    yield { fields, line: index + 1 }
  }
}

const IVD_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_+-]*$/u
/** @typedef {{collection:string, pattern:string, url:string}} IvdCollection */
/** Read IVD_Collections.txt. The registrant's Perl pattern is retained verbatim.
 * @param {string} input @returns {IvdCollection[]} */
export function ivdCollections(input) {
  const records = []
  const seen = new Set()
  for (const { fields: [collection, pattern, url], line } of ivdRows(input)) {
    if (!IVD_IDENTIFIER.test(collection) || seen.has(collection)) throw new SyntaxError(`Invalid IVD collection at line ${line}`)
    records.push({ collection, pattern, url })
    seen.add(collection)
  }
  return records
}

/** Read the Unicode IVD_Sequences.txt fields. Collections sharing an IVS each keep their own
 * glyph identifier. A registration alone describes no component-level features.
 * @param {string} input @param {string} edition @param {IvdCollection[]} [collections] */
export function ivdFamilies(input, edition, collections) {
  if (!edition) throw new TypeError('An IVD edition is required')
  const known = collections && new Set(collections.map(row => row.collection))
  const source = { name: 'IVD', edition, ...(collections && { collections }) }
  /** @typedef {{id: string, text: string, registrations: {collection:string, identifier:string}[]}} IvdForm */
  /** @type {Map<string, {id:string, subjects:string[], source: typeof source, forms: IvdForm[]}>} */
  const families = new Map()
  /** @type {Map<string,IvdForm>} */
  const forms = new Map()
  for (const { fields, line } of ivdRows(input)) {
    const seq = /^([A-F\d]{4,6})\s+([A-F\d]{5})$/iu.exec(fields[0])
    if (!seq || !IVD_IDENTIFIER.test(fields[1]) || !IVD_IDENTIFIER.test(fields[2]) || (known && !known.has(fields[1]))) {
      throw new SyntaxError(`Invalid IVD record at line ${line}`)
    }
    const cp = parseInt(seq[1], 16), vs = parseInt(seq[2], 16)
    if (cp > 0x10ffff || cp >= 0xd800 && cp <= 0xdfff || vs < 0xe0100 || vs > 0xe01ef) {
      throw new SyntaxError(`Invalid IVD sequence at line ${line}`)
    }
    const base = String.fromCodePoint(cp), text = base + String.fromCodePoint(vs)
    if (!/\p{Ideographic}/u.test(base) || base.normalize('NFKD') !== base) {
      throw new SyntaxError(`Invalid IVD base at line ${line}`)
    }
    let family = families.get(base)
    if (!family) {
      family = { id: 'IVD/' + cp.toString(16).toUpperCase(), source, subjects: [base], forms: [] }
      families.set(base, family)
    }
    let form = forms.get(text)
    if (!form) {
      form = { id: vs.toString(16).toUpperCase(), text, registrations: [] }
      forms.set(text, form)
      family.forms.push(form)
    }
    form.registrations.push({ collection: fields[1], identifier: fields[2] })
  }
  return [...families.values()]
}

/** @typedef {{id:string, kind:'unifiable'|'not-unifiable', components?:string, forms:{glyph:string,text?:string,of?:string}[]}} UcvEntry */
/** Read a compiled IWDS catalogue. Keep the entire entry, including its examples, notes,
 * negative criteria and the published order. A contextual pattern with a slot identifies a
 * drawing in the source; the exact drawing can be written as a GlyphWiki entity.
 * @template {UcvEntry} E
 * @template S,G
 * @param {{entries:E[], source:S, groups:G}} data */
export function ucvFamilies(data) {
  return data.entries.map(entry => {
    if (entry.kind !== 'unifiable' && entry.kind !== 'not-unifiable') throw new TypeError(`Unknown UCV kind: ${entry.kind}`)
    const id = (entry.kind === 'unifiable' ? 'UCV/' : 'NUCV/') + entry.id
    /** @type {Set<string>} */
    const subjects = new Set()
    const components = [...entry.components ?? '']
    for (let at = 0; at < components.length;) {
      const end = descriptionEnd(components, at)
      if (end < 0) break
      subjects.add(components.slice(at, end).join(''))
      at = end
    }
    const ambiguous = new Set()
    const glyphByText = new Map()
    for (const { text, glyph } of entry.forms) {
      if (!text) continue
      if (glyphByText.has(text) && glyphByText.get(text) !== glyph) ambiguous.add(text)
      glyphByText.set(text, glyph)
    }
    const forms = entry.forms.map(({ glyph, text, of }, index) => {
      if (of) subjects.add(of)
      if (text) subjects.add(text)
      return { id: String(index + 1), text: text && isSpelling(text) && !ambiguous.has(text) ? text : `&GW-${glyph};`, glyph }
    })
    return { id, evidenceOnly: true, subjects: [...subjects], forms, entry, source: data.source, groups: data.groups }
  })
}
