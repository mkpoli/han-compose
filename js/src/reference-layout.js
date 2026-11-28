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
    '⿲意情意': { encoded: '', cells: [['意', [0, -110, 304, 870], [-0.55, 0]], ['情', [336, -110, 664, 870], [-0.50, 0]], ['意', [696, -110, 1000, 870], [-0.55, 0]]] },
    '⿱天𭑈': { encoded: '𡙎', cells: [['天', [67, 419, 926, 833]], ['𭑈', [35, -75, 969, 369]]] },
    '⿱宀西': { encoded: '', cells: [['宀', [45, 465, 955, 845]], ['西', [160, -88, 840, 582]]] },
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
    '⿰示示': { encoded: '', cells: [['示', [-0.0, -120.1, 482.3, 879.9]], ['示', [519.0, -120.1, 1000.2, 879.9]]] },
    '⿲意情意': { encoded: '', cells: [['意', [0, -110, 304, 870], [0.68, 0]], ['情', [336, -110, 664, 870], [0.45, 0]], ['意', [696, -110, 1000, 870], [0.68, 0]]] },
  },
  serif: {
    '⿰设正': { encoded: '', cells: [['设', [5, -102, 523, 868], [0.65, -0.05]], ['正', [553, -72, 989, 831], [0.81, 0]]] },
    '⿱亠公': { encoded: '', cells: [['亠', [46.6, 604.6, 943.3, 884.0]], ['公', [6.9, -125.6, 997.1, 555.0]]] },
    '⿲意情意': { encoded: '', cells: [['意', [0, -110, 304, 870], [0.80, -0.05]], ['情', [336, -110, 664, 870], [0.60, -0.08]], ['意', [696, -110, 1000, 870], [0.80, -0.05]]] },
  },
  sans: {
    '⿰设正': { encoded: '', cells: [['设', [9, -87, 518, 856], [0.71, -0.09]], ['正', [551, -68, 984, 816], [0.88, -0.12]]] },
    '⿲意情意': { encoded: '', cells: [['意', [0, -110, 304, 870], [0.65, -0.18]], ['情', [336, -110, 664, 870], [0.55, -0.18]], ['意', [696, -110, 1000, 870], [0.65, -0.18]]] },
    '⿱宀西': { encoded: '', cells: [['宀', [42, 525, 958, 845]], ['西', [145, -80, 855, 588], [0.10, 0]]] },
  },
  fangsong: {
    '⿼叉丶': { encoded: '㕚', cells: [['叉', [-15.5, -127.5, 1000.0, 887.5]], ['丶', [92, 206, 284, 436], [0.35, 0.35]]] },
    '⿲意情意': { encoded: '', cells: [['意', [0, -110, 304, 870], [0.55, 0]], ['情', [336, -110, 664, 870], [0.50, 0]], ['意', [696, -110, 1000, 870], [0.55, 0]]] },
    '⿵門水': {
      encoded: '閖',
      donors: {
        門: { char: '閑', digest: 'c480c2c69be38eae1aa7e369ed6d61bbfa3e7fbdeb5c787cb5aac589562d7be0', indices: [0, 1, 3], box: [74.8, -131.7, 933.8, 854.8] },
        水: { char: '水', digest: '7e2cec0cc9ccd5a99e9a737ac01dd7d53c0bb4e7bc3f1c788993d9be90a3d123', indices: [0, 1], box: [252.0, -15.0, 730.0, 440.0] },
      },
      cells: [['門', [74.8, -131.7, 933.8, 854.8]], ['水', [252.0, -15.0, 730.0, 440.0], [0.92, 0.85]]],
    },
    '⿵門玉': {
      encoded: '閠',
      donors: {
        門: { char: '閑', digest: 'c480c2c69be38eae1aa7e369ed6d61bbfa3e7fbdeb5c787cb5aac589562d7be0', indices: [0, 1, 3], box: [78.8, -128.5, 935.5, 854.6] },
        玉: { char: '玉', digest: '9dcae33543c4eb2e95a8994ebe6c97e1472eb592b5e662f5b1d6bff2e0e0800a', indices: [0, 1], box: [260.0, 12.0, 722.0, 425.0] },
      },
      cells: [['門', [78.8, -128.5, 935.5, 854.6]], ['玉', [260.0, 12.0, 722.0, 425.0], [0.85, 0.78]]],
    },
    '⿵門山': {
      encoded: '閊',
      donors: {
        門: { char: '閑', digest: 'c480c2c69be38eae1aa7e369ed6d61bbfa3e7fbdeb5c787cb5aac589562d7be0', indices: [0, 1, 3], box: [73.6, -127.8, 941.9, 853.2] },
        山: { char: '山', digest: '188470c3286072f1bdf3e44efccfaad19e3387b174aa685ea3deaab19b1efd1a', indices: [0], box: [275.0, 25.0, 710.0, 420.0] },
      },
      cells: [['門', [73.6, -127.8, 941.9, 853.2]], ['山', [275.0, 25.0, 710.0, 420.0], [0.80, 0.95]]],
    },
    '⿰弓哥': {
      encoded: '彁',
      donors: {
        弓: { char: '彊', digest: 'b5f3cd82a959ead7171c84e3f950d396ae75085e9c8d03613218d6de97250519', indices: [0], box: [30.8, -100.5, 374.6, 788.2] },
        哥: { char: '哥', digest: 'ef641e8bd416832fa2ff1fdc650590061f7e4f5a915b99dcb17683215bfbc9bf', indices: [0, 1, 2, 3, 4], box: [367.9, -120.8, 1008.9, 837.3] },
      },
      cells: [['弓', [30.8, -100.5, 374.6, 788.2]], ['哥', [367.9, -120.8, 1008.9, 837.3]]],
    },
    '⿱海土': {
      encoded: '塰',
      donors: {
        海: { char: '海', digest: 'ab39a72c94070597eb376f28dc2174ea7a6f187dce93c0f5265352a2a197f9f8', indices: [0, 1, 2, 3, 4, 5, 6, 7, 8], box: [13.7, 282.1, 997.8, 893.5] },
        土: { char: '埜', digest: '44248dce9316f269e1ad29c558c75a364454e90478eeba55b5ba26ab9baaf91a', indices: [0], box: [36.4, -89.4, 988.7, 268.1] },
      },
      cells: [['海', [13.7, 282.1, 997.8, 893.5]], ['土', [36.4, -89.4, 988.7, 268.1]]],
    },
    '⿱沙邑': { encoded: '䣉', cells: [['沙', [155, 400, 855, 834]], ['邑', [251, -56, 902, 368]]] },
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
    '⿰示示': { encoded: '', cells: [['示', [-21.3, -109.0, 473.9, 851.6]], ['示', [511.6, -109.0, 1005.8, 851.6]]] },
    '⿱宀西': { encoded: '', cells: [['宀', [38, 455, 962, 835]], ['西', [155, -90, 845, 585], [0.15, 0]]] },
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

/** Layouts of operands that have no single glyph in the font. Each group remains one editor leaf.
 * @type {Record<string, Record<string, [string, number[]][]>>} */
const sourceCells = {
  'pen-writing': {
    '𭑈': [['天', [0, 0, 476, 480]], ['天', [519, 0, 995, 480]]],
  },
}

/** @param {string} char @param {string} style */
export const referenceSources = (char, style) => sourceCells[style]?.[char]
