// @ts-check
// Outlines for the Shuishu characters at the proposed block's tentative allocations.
import { bundledSource } from './bundled.js'
import { isShuishu } from './tree.js'
import { pageLoader } from './unicode.js'

export const hasShuishu = isShuishu
const loadOutlines = () => pageLoader('sources/shuishu/outlines.json.gz')
/** @param {{ load?: () => Promise<any>, fallback?: any }} options */
export const shuishuSource = ({ load = loadOutlines, fallback = null } = {}) =>
  bundledSource({ load, matches: hasShuishu, fallback })
