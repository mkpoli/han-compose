// @ts-nocheck
// Unicode Small Seal glyphs for the supported CHISE descriptions and their components.
import { bundledSource } from './bundled.js'
import { pageLoader } from './unicode.js'

export const hasSmallSeal = text => /[\u{3D000}-\u{3FC3F}]/u.test(text)
const loadOutlines = () => pageLoader('sources/small-seal/outlines.json.gz')
export function smallSealSource({ load = loadOutlines, fallback = null } = {}) {
  return bundledSource({ load, matches: hasSmallSeal, fallback })
}
