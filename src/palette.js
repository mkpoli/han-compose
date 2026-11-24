// Noto outlines for palette parts the Sans export lacks. With `under`, another face's export answers
// first, so that face keeps its own glyphs.
import characters from '../data/palette/fallback-characters.json' with { type: 'json' }
import { bundledSource } from './bundled.js'
import { pageLoader } from './unicode.js'
const supported = new Set(characters)
/** @param {string} text */
export const hasPaletteGlyph = text => supported.has(text)
const loadOutlines = () => pageLoader('sources/palette/outlines.json.gz')
// The Sans cuts for numbered components; BabelStone Han PUA draws the Serif face.
const loadSans = () => pageLoader('numbered-sans-outlines.json.gz')
/** @param {{ load?: () => Promise<any>, sans?: (() => Promise<any>) | null, style?: string, fallback?: any, under?: boolean }} options */
export const paletteSource = ({ load = loadOutlines, sans, style = 'sans', fallback = null, under = false } = {}) => {
  const sansLoad = sans === undefined ? (load === loadOutlines ? loadSans : null) : sans
  const read = async () => {
    const base = await load()
    if (style !== 'sans' || !sansLoad) return base
    const extra = await sansLoad()
    return { ...base, records: { ...base.records, ...extra.records } }
  }
  return bundledSource({ load: read, matches: hasPaletteGlyph, fallback, under })
}
