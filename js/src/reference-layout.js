// @ts-check
import { mapped } from './geometry.js'

// Brush-face operand bounds, in a 1000-unit em with an 880-unit ascent.
// 亽 has a short, centered dot below its open roof (TW-Kai U+4EBD).
/** @type {Record<string, Record<string, { encoded: string, cells: [string, number[], [number, number]?][] }>>} */
const layouts = {
  "pen-writing": {
    '⿰设正': { encoded: '', cells: [['设', [42, -7, 526, 751]], ['正', [559, 55, 957, 696], [-0.30, 0]]] },
  },
  regular: {
    '⿰设正': { encoded: '', cells: [['设', [42, -7, 526, 751]], ['正', [559, 55, 957, 696], [0.5, 0.14]]] },
  },
  serif: {
    '⿰设正': { encoded: '', cells: [['设', [42, -7, 526, 751]], ['正', [559, 55, 957, 696], [0.19, 0.45]]] },
  },
  sans: {
    '⿰设正': { encoded: '', cells: [['设', [42, -7, 526, 751]], ['正', [559, 55, 957, 696], [0.36, 0.12]]] },
  },
  fangsong: {
    '⿰设正': { encoded: '', cells: [['设', [42, -7, 526, 751]], ['正', [559, 55, 957, 696], [0.30, 0.10]]] },
    '⿱𠆢丶': { encoded: '亽', cells: [['人', [62, 265, 964, 793]], ['丶', [397, 135, 551, 298]]] },
  },
}

/** @param {any} node @param {string} style */
export function referenceLayout(node, style) {
  if (!layouts[style] || !Array.isArray(node) || ('note' in node && node.note) || !node.every(child => typeof child === 'string')) return null
  return layouts[style][node.join('')] ?? null
}

/** @param {[string, number[], [number, number]?][]} cells @param {number[]} region */
export function referenceBoxes(cells, region) {
  return cells.map(([, box]) => mapped(box, [0, -120, 1000, 880], region))
}
