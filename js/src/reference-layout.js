// @ts-check
import { mapped } from './geometry.js'

// Brush-face operand bounds, in a 1000-unit em with an 880-unit ascent.
// 亽 has a short, centered dot below its open roof (TW-Kai U+4EBD).
/** @type {Record<string, Record<string, { encoded: string, cells: [string, number[]][] }>>} */
const layouts = {
  fangsong: {
    '⿰入鳥': { encoded: '鳰', cells: [['入', [40, 147, 410, 627]], ['鳥', [429, -58, 942, 801]]] },
    '⿰柬鳥': { encoded: '鶫', cells: [['柬', [43, -28, 466, 779]], ['鳥', [485, -54, 947, 804]]] },
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
