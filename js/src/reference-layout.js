// @ts-check
import { mapped } from './geometry.js'

// Brush-face operand bounds, in a 1000-unit em with an 880-unit ascent.
// 亽 has a short, centered dot below its open roof (TW-Kai U+4EBD).
/** @type {Record<string, Record<string, { encoded: string, cells: [string, number[]][] }>>} */
const layouts = {
  regular: {
    '⿱艹么': { encoded: '', cells: [['艹', [114, 577, 907, 821]], ['么', [208, -54, 814, 526]]] },
  },
  fangsong: {
    '⿱艹才': { encoded: '𦬁', cells: [['艹', [102, 565, 920, 833]], ['才', [137, -70, 887, 520]]] },
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
