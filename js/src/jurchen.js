// @ts-check
// Outlines for Unicode's Jurchen characters and radicals.
import { bundledSource } from './bundled.js'
import { isJurchen } from './tree.js'
import { pageLoader } from './unicode.js'

export const hasJurchen = isJurchen
const loadOutlines = () => pageLoader('sources/jurchen/outlines.json.gz')
/** @param {{ load?: () => Promise<any>, fallback?: any }} options */
export const jurchenSource = ({ load = loadOutlines, fallback = null } = {}) =>
  bundledSource({ load, matches: hasJurchen, fallback })
