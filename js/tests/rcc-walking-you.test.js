import { expect, it } from 'bun:test'
import { EM_BOX, fill, groupRings, grown, partOf, rings, segments } from '../src/geometry.js'
import { overlayContextDonors, overlayContextParts } from '../src/rcc-overlays.js'
import records from './fixtures/rcc-walking-you.json' with { type: 'json' }

const key = '⿺#(㇋乀)由', em = [0, 0, 1000, 1000]
const composer = (fontStyle, excluded = []) => ({
  fontStyle, glyphRecord: ch => records[fontStyle]?.[ch], excluded: ch => excluded.includes(ch),
})

// Junction windows are in the native, unplaced 延 coordinates, with y up.
// The descending tail sits below the entry and to the left of the sweep.
const cuts = {
  regular: { contour: 0, retained: 114, window: [40, 35, 254, 212], inner: '廸', body: [1, 2, 3, 4, 5] },
  fangsong: { contour: 0, retained: 45, window: [36, -82, 298, 160], inner: '迪', body: [1, 3, 4, 5] },
  'pen-writing': { contour: 1, retained: 69, window: [44, -74, 264, 144], inner: '廸', body: [0, 2, 3, 4, 5] },
}

// Include the start point of each edge so identical endpoints alone cannot
// conceal a changed Bézier. An SVG contour may close with an implicit line.
function edges(contour, master) {
  const [move, ...commands] = segments(contour.ops, contour[master]), start = move[1][0]
  let previous = start
  const result = []
  for (const [op, points] of [...commands, ['L', [start]]]) {
    const end = points.at(-1)
    if (op !== 'L' || end[0] !== previous[0] || end[1] !== previous[1]) {
      result.push(JSON.stringify([op, previous, ...points]))
    }
    previous = end
  }
  return result
}

for (const [style, cut] of Object.entries(cuts)) {
  it(`removes only the descending tail of native 延 in ${style}`, () => {
    const native = partOf(records[style].延).contours[cut.contour]
    const [outer] = overlayContextParts(composer(style), key, em)
    expect(outer.part.contours).toHaveLength(1)
    const [revised] = outer.part.contours
    for (const master of ['light', 'heavy']) {
      const source = edges(native, master), actual = edges(revised, master)
      const joins = actual.filter(edge => !source.includes(edge))
      expect(joins).toHaveLength(1)
      expect(JSON.parse(joins[0])[0]).toBe('L')
      const index = actual.indexOf(joins[0])
      const retained = [...actual.slice(index + 1), ...actual.slice(0, index)]
      expect(retained).toHaveLength(cut.retained)
      const first = source.indexOf(retained[0])
      expect(first).toBeGreaterThanOrEqual(0)
      expect(retained).toEqual([...source, ...source].slice(first, first + cut.retained))
    }
    const size = 500
    const [before, after] = [native, revised].map(c => fill(rings([c], [c.light], 24), size, EM_BOX))
    const [left, bottom, right, top] = cut.window
    let removed = 0, added = 0, outside = 0
    for (let i = 0; i < before.length; i++) {
      if (before[i] === after[i]) continue
      if (after[i]) added++
      else removed++
      const x = EM_BOX[0] + ((i % size) + .5) * 2, y = EM_BOX[3] - (Math.floor(i / size) + .5) * 2
      if (x < left || x > right || y < bottom || y > top) outside++
    }
    expect(removed).toBeGreaterThan(0)
    expect(added).toBe(0)
    expect(outside).toBe(0)
  })

  it(`retains the native 由 groups and clears the full sweep in ${style}`, () => {
    const parts = overlayContextParts(composer(style), key, em), [outer, inside] = parts
    expect(parts.map(p => p.rccLeaf)).toEqual([0, 1])
    expect(outer.part.strokes).toEqual([[5, [0]], [6, [0]], [7, [0]]])
    const native = partOf(records[style][cut.inner])
    expect(inside.part.contours).toHaveLength(cut.body.length)
    for (const [i, index] of cut.body.entries()) expect(inside.part.contours[i]).toBe(native.contours[index])
    const groups = native.strokes.slice(0, 5).map(([id, indices]) => [id, indices.map(index => cut.body.indexOf(index))])
    expect(inside.part.strokes).toEqual(groups)
    expect(overlayContextParts({ ...composer(style), separate: true }, key, em)).toEqual(parts)

    for (const size of [24, 32, 48, 64]) {
      const [frame, body] = parts.map(p => fill(groupRings([p], 24), size, em))
      expect(body.some(Boolean)).toBe(true)
      const margin = size < 32 ? frame : grown(frame, size, 1)
      expect(margin.some((ink, i) => ink && body[i])).toBe(false)
      const inkInColumn = (mask, x) => mask.some((ink, i) => ink && i % size === x)
      expect(inkInColumn(frame, size - 1)).toBe(true)
      if (size >= 48) expect(inkInColumn(body, size - 1)).toBe(false)
    }
  })

  it(`falls back for excluded or unverified ${style} donors`, () => {
    const donors = ['延', cut.inner]
    expect(overlayContextDonors(key, style)).toEqual(donors)
    for (const ch of [key, '#(㇋乀)', '㇋', '乀', '由', ...donors]) {
      expect(overlayContextParts(composer(style, [ch]), key, em)).toBeNull()
    }
    for (const ch of donors) {
      const base = composer(style)
      for (const invalid of [null, { ...records[style][ch], v: 2 }, { ...records[style][ch], p: [] }]) {
        const changed = { ...base, glyphRecord: c => c === ch ? invalid : base.glyphRecord(c) }
        expect(overlayContextParts(changed, key, em)).toBeNull()
      }
    }
  })
}

it('uses the existing outlines for Sans, Serif and other spellings', () => {
  for (const style of ['sans', 'serif']) {
    expect(overlayContextDonors(key, style)).toEqual([])
    expect(overlayContextParts(composer(style), key, em)).toBeNull()
  }
  expect(overlayContextParts(composer('regular'), '⿺#(㇋乀)田', em)).toBeNull()
})
