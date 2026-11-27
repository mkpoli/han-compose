// @ts-nocheck
import { commands, groupRings, makePart, mapped, partInk, placed, pointsBox, union } from './geometry.js'

export const isDottedHe = node => Array.isArray(node) && node[0] === '⿸' && node[1] === 'ㄏ' && node[2] === '·'

// Zhuque Fangsong v0.212, periodcentered (U+00B7), absent from the web export.
const points = [180, 347, 180, 378, 220, 420, 253, 420, 284, 420, 320, 381, 320, 353,
  320, 322, 280, 280, 246, 280, 214, 280, 180, 319, 180, 347]
const middleDot = makePart([{ ops: commands('MQ3Q3Q3Q3'), light: points, heavy: points }], [180, 280, 320, 420])

export function fangsongDottedHe(composer, region, atRoot) {
  if (composer.fontStyle !== 'fangsong' || composer.excluded('ㄏ') || composer.excluded('·')) return null
  const letter = composer.node('ㄏ', region, atRoot)
  if (letter.length !== 1) return null
  const dot = composer.glyphRecord('·')?.v === 1 ? composer.glyph('·') : middleDot
  return [letter[0], { ...placed(dot, dot.box, letter[0].target.slice(), partInk(dot), 'glyph ·'), fixed: true }]
}

// Copies retain the token when a parent moves, weights or mirrors the two leaves.
export function markDottedHe(parts, composer) {
  if (parts.length !== 2 || composer.excluded('ㄏ') || composer.excluded('·')) return
  const token = {}
  for (const p of parts) p.dottedHe = token
}

const ink = part => union(groupRings([{ ...part, flips: undefined }], 32).map(pointsBox))
export function fitDottedHe(parts, style) {
  const letters = new Map()
  for (const part of parts) {
    const token = part.dottedHe
    if (!token) continue
    const letter = letters.get(token)
    if (!letter) { letters.set(token, part); continue }
    letters.delete(token)
    if (part.cut || letter.cut) continue
    const outer = ink(letter), dot = ink(part)
    const frame = style === 'fangsong' ? outer : union([outer, dot])
    // PDF p. 23 of 注音新疆回文常用字表: the x row puts the mark
    // 77% across and 39% down the adjacent h-shaped letter.
    const room = mapped([0.69, 0.52, 0.85, 0.70], [0, 0, 1, 1], frame)
    letter.target = mapped(letter.target, outer, frame)
    part.target = mapped(part.target, dot, room)
  }
}
