// Noto outlines for palette parts the Sans export lacks. With `under`, another face's export answers
// first, so that face keeps its own glyphs.
import characters from '../data/palette/fallback-characters.json' with { type: 'json' }
import { bundledSource } from './bundled.js'
import { pageLoader } from './unicode.js'
const supported = new Set(characters)
/** @param {string} text */
export const hasPaletteGlyph = text => supported.has(text)
const loadOutlines = () => pageLoader('sources/palette/outlines.json.gz')
/** @param {{ load?: () => Promise<any>, fallback?: any, under?: boolean }} options */
export const paletteSource = ({ load = loadOutlines, fallback = null, under = false } = {}) =>
  bundledSource({ load, matches: hasPaletteGlyph, fallback, under })
