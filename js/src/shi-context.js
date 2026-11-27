import { derived, partOf } from './geometry.js'
import { partitionChainHost } from './host-chain.js'
import { reconnectStroke } from './stroke-donors.js'
import { hexOf } from './sha256.js'
import { drawingChain } from './chain-corrections.js'
import { parseChain } from './stroke-chain.js'

// Yi Bai gives the same 氏 with 𠄌 at level 0 and 𠃊 at level 2 in both revisions.
// 𫠠 owns the crossing 一 and the sweeping ㇂. The enclosure owns 丿 and the left turn.
// https://github.com/yi-bai/ids/blob/2597437b/ids_lv0.txt#L7696
// https://github.com/yi-bai/ids/blob/2597437b/ids_lv2.txt#L7696
// https://github.com/yi-bai/ids/blob/629d0b74/ids_lv0.txt#L7696
// https://github.com/yi-bai/ids/blob/629d0b74/ids_lv2.txt#L7696
// https://github.com/yi-bai/ids/blob/2597437b/ids_lv0.txt#L74700
const spellings = new Map(['#(丿𠄌)', '#(丿𠃊)', '#(丿𠄌>)', '#(丿𠃊>)'].map(written => {
  const key = `⿸${written}𫠠`, canonical = drawingChain(written)
  const strokes = parseChain(canonical)?.strokes.map(stroke => stroke.char) ?? []
  return [key, { written, inputs: [key, `⿸${canonical}𫠠`, '氏', written, canonical, '𫠠', ...strokes] }]
}))

// A brush joins the two components. Following complementary runs on its outer
// boundary and counter, then closing each cut, preserves the original joints.
/** @type {Record<string, {hash: string, contours?: number[][], runs?: number[][][]}>} */
const cuts = {
  sans: { hash: 'dc0766112becba54514b928b0992636a2dcbc95c73b46c7baaacf5a33841611c', contours: [[2, 3, 4], [0, 1]] },
  serif: { hash: '6d592b294fab823b193e10c7bc4af94278de3173cb7e4cb38f65b7fbdf40b896', contours: [[0, 1, 3], [2, 4]] },
  regular: { hash: 'bfb4ccce0487d7694adaa04507cf07ae9a76802850b6522c291222d05132ee9c', runs: [
    [[0, 54, 112], [0, 0, 0], [1, 7, 10], [1, 0, 0]], [[0, 0, 54], [1, 0, 7]],
  ] },
  fangsong: { hash: '01d389c42d957ddea51617cc4cf7e5b7a57654a23d30313f22aec5dc3672503c', runs: [
    [[0, 14, 53]], [[0, 53, 85], [0, 0, 14]],
  ] },
  'pen-writing': { hash: '289f5f4603a95908a133299cf0d1d05881a5b57f7287e6e0ce03a3ed65eb90f6', runs: [
    [[0, 10, 55], [1, 1, 4]], [[0, 55, 79], [0, 0, 10], [1, 4, 6], [1, 0, 1]],
  ] },
}

/** @param {string} key */
export const shiContextDonors = key => spellings.has(key) ? ['氏'] : []

/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export function shiContextParts(composer, key, region) {
  const context = spellings.get(key), cut = cuts[composer.fontStyle]
  if (!context || !cut || context.inputs.some(input => composer.excluded(input))) return null
  const record = composer.glyphRecord('氏')
  if (record?.v !== 1 || hexOf(JSON.stringify(record.p)) !== cut.hash) return null
  const runs = cut.runs, leaves = [context.written, '𫠠']
  const groups = runs ? (/** @type {any} */ final) => runs.map(operand =>
    derived(final, [reconnectStroke(final.contours, operand)])) : /** @type {number[][]} */ (cut.contours)
  return partitionChainHost(composer, partOf(record), region, '氏', leaves, groups)
}
