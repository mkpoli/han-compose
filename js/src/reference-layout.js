// @ts-check
import { mapped } from './geometry.js'

// Brush-face operand bounds, in a 1000-unit em with an 880-unit ascent.
// 亽 has a short, centered dot below its open roof (TW-Kai U+4EBD).
/** @typedef {{char: string, digest: string, indices: number[], box: number[]}} DonorCut */
/** @type {Record<string, Record<string, { encoded: string, donors?: Record<string, DonorCut>, cells: [string, number[], [number, number]?][] }>>} */
const layouts = {
  "pen-writing": {
    '⿳宀𭕄木': { encoded: '𫳍', cells: [['宀', [66, 597, 941, 853]], ['𭕄', [206, 418, 798, 581]], ['木', [62, -81, 943, 380]]] },
    '⿰设正': { encoded: '', cells: [['设', [72, -7, 556, 751]], ['正', [529, 55, 927, 696], [-0.30, 0]]] },
  },
  regular: {
    '⿳宀𭕄木': { encoded: '𫳍', cells: [['宀', [66, 597, 941, 853]], ['𭕄', [206, 418, 798, 581]], ['木', [62, -81, 943, 380]]] },
    '⿰设正': { encoded: '', cells: [['设', [90, -7, 574, 751]], ['正', [511, 55, 909, 696], [0.5, 0.14]]] },
  },
  serif: {
    '⿰设正': { encoded: '', cells: [['设', [5, -102, 523, 868], [0.65, -0.05]], ['正', [553, -72, 989, 831], [0.81, 0]]] },
  },
  sans: {
    '⿰设正': { encoded: '', cells: [['设', [9, -87, 518, 856], [0.71, -0.09]], ['正', [551, -68, 984, 816], [0.88, -0.12]]] },
  },
  fangsong: {
    '⿳宀𭕄木': { encoded: '𫳍', cells: [['宀', [66, 597, 941, 853]], ['𭕄', [206, 418, 798, 581]], ['木', [62, -81, 943, 380]]] },
    '⿰糸ソ': { encoded: '', cells: [['糸', [55, -65, 477, 810]], ['ソ', [517, 98, 947, 635]]] },
    // 此 keeps its size in 柴. 力 is 107% of its size in 勢 on both axes.
    // U+324C2 (UK-20135) places the diagonal of 力 below the gap between 止 and 匕.
    '⿱此力': {
      encoded: '𲓂',
      donors: {
        此: { char: '柴', digest: '338eaaa0bc9a24b1107d1944f9cf99c237fde52b3e84d71d1b5a735b89007f18', indices: [1, 2], box: [17, 360, 967, 878] },
        力: { char: '勢', digest: '6808073200375462081b8a846f6e8cfab9858d84d2012b04305a06f503f1998e', indices: [0], box: [86, -39, 923, 425] },
      },
      cells: [['此', [74, 325, 930, 810]], ['力', [94, -64, 880, 338]]],
    },
    '⿰设正': { encoded: '', cells: [['设', [82, -7, 566, 751]], ['正', [519, 55, 917, 696], [0.30, 0.10]]] },
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
