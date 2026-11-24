// @ts-check
// Outlines for the unencoded letters of the New Korean Orthography.
import { bundledSource } from './bundled.js'
import { isNewKorean } from './tree.js'
import { pageLoader } from './unicode.js'

export const hasNewKorean = isNewKorean
const loadOutlines = () => pageLoader('sources/new-korean/outlines.json.gz')
/** @param {{ load?: () => Promise<any>, fallback?: any }} options */
export const newKoreanSource = ({ load = loadOutlines, fallback = null } = {}) =>
  bundledSource({ load, matches: hasNewKorean, fallback })
