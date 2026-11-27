import { expect, it } from 'bun:test'
import { fill, partOf, rings } from '../src/geometry.js'
import { chainForm } from '../src/stroke-chain.js'
import strokes from './fixtures/sans-strokes.json' with { type: 'json' }
import turns from './fixtures/sans-chain-turns.json' with { type: 'json' }

// Native Sans contours from the pinned a83fc94 export.
const draw = raw => chainForm(raw, char => partOf(turns[char] ?? strokes[char].G))
const mask = (part, frame, size) => fill(rings(part.contours, part.contours.map(c => c.light), 12), size, frame)

it('joins the tapered tip of 丿 to the native dot and vertical at text size', () => {
  for (const raw of ['#(丿-丶)', '#(丿丨)']) {
    const { parts, frame } = draw(raw)
    const [left, right] = parts.map(part => mask(part, frame, 48))
    expect(left.some((ink, i) => ink && right[i])).toBe(true)
  }
})

it('keeps the falling tip of ㇇ clear of the vertical under its upper join', () => {
  const { parts, frame } = draw('#(-㇇𠃊)')
  const size = 144
  const [turn, wall] = parts.map(part => mask(part, frame, size))
  const shared = [...turn.keys()].filter(i => turn[i] && wall[i])
  expect(shared.length).toBeGreaterThan(0)
  expect(shared.every(i => Math.floor(i / size) < size / 4)).toBe(true)
})

it('retains the body of 乙 between its two left turns on the same grid line', () => {
  const { parts } = draw('#(丨乙)')
  const turn = parts[1], size = 96, ink = mask(turn, turn.box, size)
  // The sweep thinned to a single pixel when the two aligned turns were
  // assigned different stations on the donor contour.
  for (let y = 54; y < 65; y++) {
    expect(ink.slice(y * size, (y + 1) * size).reduce((sum, bit) => sum + bit, 0)).toBeGreaterThan(5)
  }
})
