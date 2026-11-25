import { derived, mapped, partInk, partOf, placed } from './geometry.js'
import { hexOf } from './sha256.js'
import { parseChain } from './stroke-chain.js'

// Yi Bai, ids_lv2.txt, 2597437b. 馬 is ⿹⿷#(-一丨b𠃌)𰀁灬 and
// 島 is ⿱丿⿹⿷⿴#(一-𠃍丨b𠃌)一一山.
// https://github.com/yi-bai/ids/blob/2597437b/ids_lv2.txt
const hosts = new Map([
  ['#(-一丨b𠃌)', {
    char: '馬',
    cuts: new Map([
      ['ad7319b40dc5b3cc8fd77149c8a10c231b9afe2d390d9a941a5fb13db62224b5', [2, 3, 9]],
      ['20e002be87558b3701c769ea6c31884cc31615386f0a895aee0de57eb846d07d', [0, 3, 4, 9]],
    ]),
  }],
  ['#(一-𠃍丨b𠃌)', {
    char: '島',
    cuts: new Map([
      ['8fa0d6bb362cca815c10feaa20e9d4a9f8b6da1cc6f98e46b5eaa6f8e8f14f3b', [0, 3, 5, 6]],
      ['7d149a179a3c03f9248fdc97866dfb48861bded2d50043e6841c2fea1e2cdfb2', [0, 1, 4, 5, 6]],
    ]),
  }],
])

/** @param {any} node @param {string} style */
export function chainHost(node, style) {
  return style === 'sans' || style === 'serif' ? hosts.get(node)?.char : undefined
}

/** Place a leaf drawn from an attested host whose frame has its own contours.
 * @param {import('./compose.js').Composer} composer
 * @param {any} node @param {number[]} region @param {boolean} atRoot */
export function hostChainParts(composer, node, region, atRoot) {
  const host = hosts.get(node)
  if (!host || composer.excluded(node) || composer.excluded(host.char)) return null
  const chain = parseChain(node)
  if (!chain || chain.strokes.some(({ char }) => composer.excluded(char))) return null
  const record = composer.glyphRecord(host.char)
  if (record?.v !== 1) return null
  const indices = host.cuts.get(hexOf(JSON.stringify(record.p)))
  if (!indices) return null
  const glyph = partOf(record)
  const piece = derived(glyph, indices.map(i => glyph.contours[i]))
  const target = atRoot ? mapped(piece.box, composer.C.face, region) : region
  return [placed(piece, piece.box, target, partInk(piece), `chain ${node}, cut from ${host.char}`)]
}
