// @ts-check
// Outlines for Unicode's Jurchen characters and radicals.
import { bundledSource } from './bundled.js'
import { isJurchen, JURCHEN_VARIANT } from './tree.js'
import { pageLoader } from './unicode.js'

export const hasJurchen = isJurchen
const loadOutlines = () => pageLoader('sources/jurchen/outlines.json.gz')
/** A Jurchen character with a variation selector that has no record of its own is drawn as the character. @param {string} key */
const baseOf = key => JURCHEN_VARIANT.test(key) ? [...key][0] : key
/** @param {{ load?: () => Promise<any>, fallback?: any }} options */
export const jurchenSource = ({ load = loadOutlines, fallback = null } = {}) =>
  bundledSource({ load, matches: hasJurchen, fallback, alias: baseOf })
