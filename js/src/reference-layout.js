// @ts-check
import { mapped } from './geometry.js'

// Brush-face operand bounds, in a 1000-unit em with an 880-unit ascent.
// 亽 has a short, centered dot below its open roof (TW-Kai U+4EBD).
/** @type {Record<string, Record<string, { encoded: string, cells: [string, number[]][] }>>} */
const layouts = {
  "pen-writing": {
    '⿻弓冫': { encoded: '', cells: [['弓', [133, -75, 879, 814]], ['冫', [174, 42, 495, 301]]] },
  },
  regular: {
    '⿻弓冫': { encoded: '', cells: [['弓', [133, -75, 879, 814]], ['冫', [174, 60, 495, 319]]] },
  },
  serif: {
    '⿻弓冫': { encoded: '', cells: [['弓', [133, -75, 879, 814]], ['冫', [197, -4, 518, 255]]] },
  },
  sans: {
    '⿻弓冫': { encoded: '', cells: [['弓', [133, -75, 879, 814]], ['冫', [202, 6, 523, 265]]] },
  },
  fangsong: {
    '⿻弓冫': { encoded: '', cells: [['弓', [133, -75, 879, 814]], ['冫', [174, -16, 495, 243]]] },
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
