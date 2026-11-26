// @ts-nocheck
import { bundledSource } from './bundled.js'
import { pageLoader } from './unicode.js'

export const hasBopomofo = text => /[\u3105-\u312F\u31A0-\u31BF]/u.test(text)
const loadOutlines = () => pageLoader('sources/bopomofo/outlines.json.gz')
export const bopomofoSource = ({ load = loadOutlines, fallback = null } = {}) =>
  bundledSource({ load, matches: hasBopomofo, fallback })
