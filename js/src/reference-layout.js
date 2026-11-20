// @ts-check
import { mapped } from './geometry.js'

// Brush-face operand bounds, in a 1000-unit em with an 880-unit ascent.
// 亽 has a short, centered dot below its open roof (TW-Kai U+4EBD).
/** @typedef {{char: string, digest: string, indices: number[], box: number[]}} DonorCut */
/** @type {Record<string, Record<string, { encoded: string, donors?: Record<string, DonorCut>, cells: [string, number[], [number, number]?][] }>>} */
const layouts = {
  "pen-writing": {
    '⿳宀𭕄木': {
      encoded: '𫳍',
      donors: {
        宀: { char: '宋', digest: '0ae592da331afc9c5a74ddff44375b6f43ad4fd7790ecb8d277dc9d8ed98d776', indices: [0], box: [58, 514, 942, 850] },
        𭕄: { char: '脳', digest: 'eac9565a08ff374c79c137a7e9a0dbd2313270a740f8be4a6aa12ff437aeea01', indices: [0, 1, 3], box: [216, 350, 785, 591] },
        木: { char: '梨', digest: '2349401e5f4f37cba9b2d6222a8aca97cbee82747ce50d10eb75788596fe1cb6', indices: [3], box: [43, -88, 957, 376] },
      },
      cells: [['宀', [66, 597, 941, 853]], ['𭕄', [206, 418, 798, 581]], ['木', [62, -81, 943, 380]]],
    },
    '⿰设正': { encoded: '', cells: [['设', [72, -7, 556, 751]], ['正', [529, 55, 927, 696], [-0.30, 0]]] },
  },
  regular: {
    '⿳宀𭕄木': {
      encoded: '𫳍',
      donors: {
        宀: { char: '宋', digest: '5176c2a35d5cb743cd4da799c9b5f3240bafb23bddd69936f2e92dfb06757dea', indices: [1], box: [58, 546, 942, 850] },
        𭕄: { char: '巣', digest: '6f947f2ce7bf188981c71dbe42c21792117c0d979527cf84c4af737e36243386', indices: [5, 6, 7], box: [216, 355, 770, 584] },
        木: { char: '栄', digest: 'c2ae746cb375ccb1369717b62b01f8fccc9de2e59e2afe47e7cee14cc68626c7', indices: [0], box: [43, -88, 957, 376] },
      },
      cells: [['宀', [66, 597, 941, 853]], ['𭕄', [206, 418, 798, 581]], ['木', [62, -81, 943, 380]]],
    },
    '⿰设正': { encoded: '', cells: [['设', [90, -7, 574, 751]], ['正', [511, 55, 909, 696], [0.5, 0.14]]] },
  },
  serif: {
    '⿰设正': { encoded: '', cells: [['设', [5, -102, 523, 868], [0.65, -0.05]], ['正', [553, -72, 989, 831], [0.81, 0]]] },
  },
  sans: {
    '⿰设正': { encoded: '', cells: [['设', [9, -87, 518, 856], [0.71, -0.09]], ['正', [551, -68, 984, 816], [0.88, -0.12]]] },
  },
  fangsong: {
    '⿳宀𭕄木': {
      encoded: '𫳍',
      donors: {
        宀: { char: '宋', digest: '99ff4f5d901c8ebe9aea93e0b8e07d967e9e0121ef8001613c0b455da9f25975', indices: [0, 1], box: [58, 514, 942, 850] },
        𭕄: { char: '脳', digest: 'f937dce6dd7e1605c22ec245ba082ea03c4aa15bf225553056332c8f0fb934e5', indices: [3, 4, 5], box: [216, 350, 785, 591] },
        木: { char: '梨', digest: '1702011746dfe844560081ef603994ecd3d0bf529e07e2188b981d91392e92f1', indices: [0], box: [43, -88, 957, 376] },
      },
      cells: [['宀', [66, 597, 941, 853]], ['𭕄', [206, 418, 798, 581]], ['木', [62, -81, 943, 380]]],
    },
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
    '⿱由攵': { encoded: '', cells: [['由', [172, 505, 820, 832]], ['攵', [101, -26, 905, 515]]] },
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
