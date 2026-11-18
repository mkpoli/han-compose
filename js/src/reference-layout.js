// @ts-check
import { mapped } from './geometry.js'

// Brush-face operand bounds, in a 1000-unit em with an 880-unit ascent.
// 亽 has a short, centered dot below its open roof (TW-Kai U+4EBD).
/** @type {Record<string, Record<string, { encoded: string, cells: [string, number[]][] }>>} */
const layouts = {
  fangsong: {
    '⿵門水': { encoded: '閖', cells: [['門', [159, -34, 850, 782]], ['水', [280, 35, 727, 441]]] },
    '⿵門玉': { encoded: '閠', cells: [['門', [167, -37, 842, 778]], ['玉', [303, 105, 713, 422]]] },
    '⿵門山': { encoded: '閊', cells: [['門', [167, -47, 860, 765]], ['山', [320, 106, 703, 424]]] },
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
