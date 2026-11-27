import { partOf } from './geometry.js'

const CHAIN = '#(-𠃌㇉)'

// Yi Bai, ids_lv1.txt, 2597437b928e8d530b7ae09cf53fe5ec7868569c.
// https://github.com/yi-bai/ids/blob/2597437b928e8d530b7ae09cf53fe5ec7868569c/ids_lv1.txt
const lowerBirds = new Map([['几', '凫'], ['木', '枭'], ['衣', '袅']])

/** @param {any} node */
const dotInChain = node => Array.isArray(node) && node[0] === '⿴' && !('note' in node) && node[1] === CHAIN && node[2] === '丶'

/** The encoded character of an exact, unmodified level-1 description. @param {any} node */
export function birdChainChar(node) {
  if (!Array.isArray(node) || 'note' in node || node[1] !== '丿') return null
  const [op, , body, base] = node
  if (op === '⿳' && dotInChain(body)) return lowerBirds.get(base) ?? null
  if (op !== '⿱' || !Array.isArray(body) || body[0] !== '⿹' || 'note' in body) return null
  const [, frame, inner] = body
  if (frame === CHAIN && inner === '一') return '乌'
  if (dotInChain(frame) && inner === '山') return '岛'
  return null
}

/** Draw the complete glyph at its native proportions, when the selected face has it.
 * @param {import('./compose.js').Composer} composer @param {any} node
 * @param {number[]} region @param {boolean} atRoot */
export function birdChainParts(composer, node, region, atRoot) {
  if (composer.separate) return null
  const char = birdChainChar(node)
  if (!char || composer.excluded(char) || composer.expanding.has(char)) return null
  const record = composer.glyphRecord(char)
  if (record?.v !== 1) return null
  const glyph = partOf(record)
  const piece = atRoot ? glyph : composer.pieceFor(char, glyph)
  return [composer.place(piece, region, composer.ink(char), `glyph ${char}`)]
}
