// Noto outlines for palette parts an export lacks. The export answers first, so each face keeps its own.
import characters from '../data/palette/fallback-characters.json' with { type: 'json' }
import { bundledSource } from './bundled.js'
import { pageLoader } from './unicode.js'
const supported = new Set(characters)
/** @param {string} text */
export const hasPaletteGlyph = text => supported.has(text)
const loadOutlines = () => pageLoader('sources/palette/outlines.json.gz')
/** @param {{ load?: () => Promise<any>, fallback?: any }} options */
export const paletteSource = ({ load = loadOutlines, fallback = null } = {}) =>
  bundledSource({ load, matches: hasPaletteGlyph, fallback, under: true })
