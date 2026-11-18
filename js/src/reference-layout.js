// @ts-check
import { mapped } from './geometry.js'

// Brush-face operand bounds, in a 1000-unit em with an 880-unit ascent.
// 亽 has a short, centered dot below its open roof (TW-Kai U+4EBD).
/** @type {Record<string, Record<string, { encoded: string, cells: [string, number[]][] }>>} */
const layouts = {
  "pen-writing": {
    '⿱天𭑈': { encoded: '𡙎', cells: [['天', [67, 419, 926, 833]], ['𭑈', [35, -75, 969, 369]]] },
  },
  fangsong: {
    '⿱𠆢丶': { encoded: '亽', cells: [['人', [62, 265, 964, 793]], ['丶', [397, 135, 551, 298]]] },
  },
}

/** @param {any} node @param {string} style */
export function referenceLayout(node, style) {
  if (!layouts[style] || !Array.isArray(node) || ('note' in node && node.note) || !node.every(child => typeof child === 'string')) return null
  return layouts[style][node.join('')] ?? null
}

/** @param {[string, number[]][]} cells @param {number[]} region */
export function referenceBoxes(cells, region) {
  return cells.map(([, box]) => mapped(box, [0, -120, 1000, 880], region))
}

/** Layouts of operands that have no single glyph in the font. Each group remains one editor leaf.
 * @type {Record<string, Record<string, [string, number[]][]>>} */
const sourceCells = {
  'pen-writing': {
    '𭑈': [['天', [0, 0, 476, 480]], ['天', [519, 0, 995, 480]]],
  },
}

/** @param {string} char @param {string} style */
export const referenceSources = (char, style) => sourceCells[style]?.[char]
