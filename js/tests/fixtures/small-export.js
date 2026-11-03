// A small composer export built in memory: `src/constants.json` holds han-compose's drawing constants
// (`compose.py` at bd0829b, with the stems and face the font gives), and a few characters
// are boxes. The layout network is all zeros, so two-operand nodes fall back to the composer's shares.
// The tests draw from it in place of a real export.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

export const constants = JSON.parse(readFileSync(join(import.meta.dirname, '../../src/constants.json'), 'utf8'))
const hex = text => createHash('sha256').update(text).digest('hex')
/** The shard a key's record or host list is in: the first three hex digits of its SHA-256. */
export const shardOf = (folder, text) => `${folder}/${hex(text).slice(0, 3)}.json`
/** The export's shards: each entry under the full hash of its text, gzipped. */
export const shards = (folder, entries) => {
  const out = {}
  for (const [text, value] of entries) ((out[shardOf(folder, text)] ??= {})[hex(text)] = value)
  return Object.fromEntries(Object.entries(out).map(([name, file]) => [name, gzipSync(JSON.stringify(file))]))
}
const int16 = values => Buffer.from(Int16Array.from(values).buffer).toString('base64')
// A glyph of boxes, each [x0, y0, x1, y1] in font units: one square contour per box.
const glyph = boxes => {
  const b = [Math.min(...boxes.map(x => x[0])), Math.min(...boxes.map(x => x[1])), Math.max(...boxes.map(x => x[2])), Math.max(...boxes.map(x => x[3]))]
  return { v: 1, b, p: boxes.map(([x0, y0, x1, y1]) => ['MLLL', int16([x0, y0, x1, y0, x1, y1, x0, y1].map(v => v * 4)), int16(Array(8).fill(0))]) }
}
const character = (key, boxes) => ({ k: key, G: glyph(boxes), ink: boxes.reduce((s, [x0, y0, x1, y1]) => s + 2 * (x1 - x0 + y1 - y0), 0), nl: boxes.length, o: boxes.length })
export const ops = ['⿰', '⿱', '⿸', '⿺', '⿵', '⿹', '⿶', '⿴', '⿷']
export const layout = { ops, defaults: Object.fromEntries(['L', 'R', 'T', 'B', ...ops.slice(2).flatMap(op => [`${op}0`, `${op}1`])].map(p => [p, [0, 0, 1000, 1000]])),
  features: {}, seeds: [[{ shape: [ops.length + 2 * 81, 8], data: Buffer.alloc(2 * (ops.length + 162) * 8).toString('base64') }, Buffer.alloc(32).toString('base64')]] }
const records = {
  木: character('木', [[100, -60, 900, 0], [470, -80, 530, 820]]),
  厃: character('厃', [[100, 700, 900, 800], [100, 0, 180, 800], [820, 0, 900, 800]]),
  儿: character('儿', [[250, 0, 330, 620], [670, 0, 750, 620]]),
  扌: character('扌', [[300, 0, 380, 800], [120, 500, 700, 580]]),
  口: character('口', [[120, -40, 880, 20], [120, 700, 880, 760], [120, -40, 180, 760], [820, -40, 880, 760]]),
  永: character('永', [[100, 0, 900, 800]]),
  // 冂 as the pinned Sans export draws it: sixteen contours whose bar, sides and foot close as a
  // frame, which a cell split would tear apart.
  冂: { k: '冂', G: { v: 1, b: [41.13,-82.14,957.51,841.58],
    p: [
      ['MLLL', int16([176,3280,2124,3280,2124,2972,176,2972]), int16([0,0,0,0,0,0,0,0])],
      ['MLLL', int16([2408,2712,3852,2712,3852,2312,2408,2312]), int16([0,0,0,0,0,0,0,0])],
      ['MLLL', int16([132,2052,2152,2052,2152,1748,132,1748]), int16([0,0,0,0,0,0,0,0])],
      ['MLLL', int16([892,3420,1404,3420,1404,1608,892,1608]), int16([0,0,0,0,0,0,0,0])],
      ['MLLL', int16([3008,2588,3516,2588,3516,1636,3008,1636]), int16([0,0,0,0,0,0,0,0])],
      ['MLLL', int16([704,2412,704,2336,1584,2336,1584,2412]), int16([0,0,0,0,0,0,0,0])],
      ['MLLL', int16([704,2696,704,2624,1584,2624,1584,2696]), int16([0,0,0,0,0,0,0,0])],
      ['MLLL', int16([280,2916,2028,2916,2028,2112,280,2112]), int16([0,0,0,0,0,0,0,0])],
      ['MLQ4Q3Q4', int16([3580,3428,3788,3020,3584,2960,3092,2872,2584,2820,2352,2804,2340,2888,2272,3108,2236,3188,2468,3208,2952,3276,3404,3372,3580,3428]), int16([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])],
      ['MLLQ4Q4Q4', int16([2236,3188,2736,3188,2736,2732,2736,2564,2700,2164,2604,1784,2504,1632,2464,1676,2304,1800,2136,1912,2080,1940,2156,2060,2220,2340,2236,2620,2236,2740]), int16([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])],
      ['MLLL', int16([1088,944,1088,868,2872,868,2872,944]), int16([0,0,0,0,0,0,0,0])],
      ['MLLL', int16([1088,608,1088,532,2872,532,2872,608]), int16([0,0,0,0,0,0,0,0])],
      ['MLLL', int16([1088,1284,1088,1208,2872,1208,2872,1284]), int16([0,0,0,0,0,0,0,0])],
      ['MLLL', int16([540,1564,3448,1564,3448,252,540,252]), int16([0,0,0,0,0,0,0,0])],
      ['MLLQ3Q5Q4Q3Q4Q6Q4', int16([2124,404,2692,404,2692,160,2692,84,2760,48,2868,48,2892,48,2996,48,3124,48,3236,48,3268,48,3328,48,3388,88,3420,204,3428,312,3508,260,3788,172,3892,152,3868,-48,3748,-272,3516,-360,3328,-360,3296,-360,3184,-360,3056,-360,2924,-360,2816,-360,2784,-360,2524,-360,2236,-264,2124,-40,2124,156]), int16([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])],
      ['MLQ5Q3Q5', int16([1228,376,1764,376,1728,204,1576,-52,1264,-236,732,-356,320,-392,292,-300,152,-52,84,24,428,36,856,88,1092,168,1204,288,1228,376]), int16([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0])],
    ] }, ink: 5120, nl: 16, o: 16 },
  三: character('三', [[120, 60, 880, 160], [160, 320, 840, 420], [120, 580, 880, 680]]),
}
/** Each file of the export by its name: JSON text, or gzip bytes for a shard. */
export const files = {
  'manifest.json': JSON.stringify({ format: 6, files: { layout: { path: 'layout.json' } }, constants, spelled: [] }),
  'layout.json': JSON.stringify(layout),
  ...shards('g', Object.entries(records)),
}
