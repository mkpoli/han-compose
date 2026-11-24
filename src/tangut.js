// @ts-nocheck: the same exported glyph records and source interface as loader.js.
// Tangut outlines ship with the package. Pure Tangut compositions use the composer's geometric
// layout; mixed descriptions also read Han records and layout from the host's export.
import { bundledSource } from './bundled.js'
import { isEmpty, isNode, parseDescription as parse } from './tree.js'
import { pageLoader } from './unicode.js'

export const hasTangut = text => /[\u{17000}-\u{18AFF}\u{18D00}-\u{18DFF}]/u.test(text)
export const onlyTangut = sequence => {
  if (!hasTangut(sequence)) return false
  const walk = node => isEmpty(node) || typeof node === 'string' ? (isEmpty(node) || hasTangut(node)) : isNode(node) && node.parts.every(walk)
  try { return walk(parse(sequence)) } catch { return false }
}

const loadOutlines = () => pageLoader('sources/tangut/outlines.json.gz')

export function tangutSource({ load = loadOutlines, fallback = null } = {}) {
  return bundledSource({ load, matches: hasTangut, fallback })
}
