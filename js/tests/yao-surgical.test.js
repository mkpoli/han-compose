import { expect, test } from 'bun:test'
import { alignedYaoGroups, classifyDetachedYao5, collapseYaoHost, collectYaoHosts, decomposedYaoGroups, findYaoGroups, replaceYaoInPart } from '../src/yao-surgical.js'
import decomposeCuts from '../src/yao-decompose-cuts.json' with { type: 'json' }
import { selectYao, yaoOccurrences } from '../src/yao-occurrences.js'
import { Composer } from '../src/compose.js'
import { fitted, placed, svgPath } from '../src/geometry.js'
import { yaoPart } from '../src/u26201-part.js'
import { constants, records } from './fixtures/small-export.js'

test('collapseYaoHost recovers single-site, multi-site, and numbered-ancestor hosts', () => {
  for (const ch of ['紅', '幼', '玄', '繁', '絲', '幽', '機', '慈', '樂', '繼', '斷', '牽', '後']) {
    const sites = yaoOccurrences(ch)
    for (const [idx, site] of sites.entries()) {
      const edited = selectYao(ch, site.path, 'returning')
      const collapsed = collapseYaoHost(edited)
      expect(collapsed).not.toBeNull()
      expect(collapsed.host).toBe(ch)
      expect(collapsed.edits).toEqual([{ index: idx, path: site.path, formId: 'returning' }])
      expect(collectYaoHosts(edited)).toContain(ch)
    }
  }
  // Entity-spelled numbered operands (&X-00086;) collapse identically to {86}.
  const silk = selectYao('紅', yaoOccurrences('紅')[0].path, 'folded').replace('{86}', '&X-00086;')
  expect(collapseYaoHost(silk)?.host).toBe('紅')
  // Plain unedited characters and IDS without 幺 variants return null.
  expect(collapseYaoHost('紅')).toBeNull()
  expect(collapseYaoHost('⿰木口')).toBeNull()
})

test('surgical replacement preserves surrounding host strokes and edits only the selected 幺', () => {
  // Build a synthetic two-幺 host glyph (two copies of folded 幺 placed side by side plus a frame stroke).
  const yao = yaoPart('folded')
  const shifted = (part, dx, sx) => part.contours.map(c => {
    const light = c.light.map((v, i) => i % 2 === 0 ? dx + (v - part.box[0]) * sx : v)
    return { ops: c.ops, light, heavy: light }
  })
  const frame = [{ ops: [['M', 1, false], ['L', 1, false], ['L', 1, false], ['L', 1, false]], light: [50, -60, 950, -60, 950, -20, 50, -20], heavy: [50, -60, 950, -60, 950, -20, 50, -20] }]
  const synthetic = { contours: [...frame, ...shifted(yao, 80, 0.45), ...shifted(yao, 520, 0.45)], box: [50, -60, 950, 840] }
  const groups = findYaoGroups(synthetic, 2)
  expect(groups).toHaveLength(2)
  const paths = [[0, 0], [1, 0]]
  const leftOnly = replaceYaoInPart(synthetic, '絲', paths, [{ index: 0, path: paths[0], formId: 'returning' }], constants.face, true)
  const rightOnly = replaceYaoInPart(synthetic, '絲', paths, [{ index: 1, path: paths[1], formId: 'returning' }], constants.face, true)
  const detachedLeft = replaceYaoInPart(synthetic, '絲', paths, [{ index: 0, path: paths[0], formId: 'detached' }], constants.face, true)
  expect(leftOnly).toHaveLength(1)
  expect(rightOnly).toHaveLength(1)
  expect(svgPath(leftOnly)).not.toBe(svgPath(rightOnly))
  expect(svgPath(leftOnly)).not.toBe(svgPath(detachedLeft))
  // Composer uses surgical replacement on a host glyph when available, and falls back cleanly without it.
  const store = { manifest: { constants, spelled: [] }, rec: key => records[key], hosts: () => [], places: () => [], layout: null }
  const composer = new Composer(store)
  expect(composer.surgicalYao(selectYao('紅', yaoOccurrences('紅')[0].path, 'returning'))).toBeNull()
  // A fused glyph that leaves no lower sibling ink beneath a stacked 幺 (e.g. 糹 with fused dots) is rejected.
  const fusedSilk = { contours: shifted(yao, 60, 0.45), box: [60, -60, 440, 840] }
  expect(alignedYaoGroups(fusedSilk, '糹', 1)).toBeNull()
})

test('selecting detached on a native 5-contour detached 幺 preserves the original outline verbatim', () => {
  // Synthetic 5-contour detached 幺 (bar, dot, midDiag, topDiag, downward-sloping shortDot) matching Noto Serif CJK JP.
  const rect = (x0, y0, x1, y1) => ({
    ops: [['M', 1, false], ['L', 1, false], ['L', 1, false], ['L', 1, false]],
    light: [x0, y0, x1, y0, x1, y1, x0, y1],
    heavy: [x0, y0, x1, y0, x1, y1, x0, y1],
  })
  const quad = pts => ({
    ops: [['M', 1, false], ['L', 1, false], ['L', 1, false], ['L', 1, false]],
    light: pts, heavy: pts,
  })
  const native5 = {
    contours: [
      rect(80, 0, 820, 110),                       // bar
      quad([640, 290, 720, 310, 910, 20, 840, 0]), // dot
      quad([700, 660, 760, 620, 260, 40, 200, 80]),// midDiag
      quad([440, 830, 520, 790, 310, 470, 240, 510]), // topDiag
      quad([100, 560, 150, 590, 350, 380, 290, 340]), // shortDot (down-right)
    ],
    box: [80, 0, 910, 830],
  }
  const classified = classifyDetachedYao5(native5, [0, 1, 2, 3, 4], native5.box)
  expect(classified).not.toBeNull()
  const original = svgPath([placed(native5, native5.box, native5.box, 0, '')])
  const detached = replaceYaoInPart(native5, '幺', [[]], [{ index: 0, path: [], formId: 'detached' }], constants.face, true)
  const folded = replaceYaoInPart(native5, '幺', [[]], [{ index: 0, path: [], formId: 'folded' }], constants.face, true)
  const returning = replaceYaoInPart(native5, '幺', [[]], [{ index: 0, path: [], formId: 'returning' }], constants.face, true)
  expect(detached).not.toBeNull()
  expect(folded).not.toBeNull()
  expect(returning).not.toBeNull()
  // Native detached stays bit-for-bit identical in outline and placement; folded and returning each differ.
  expect(detached[0].part).toBe(native5)
  expect(svgPath(detached)).toBe(svgPath([placed(native5, native5.box, fitted(native5.box, constants.face, constants.STRETCH), 0, '')]))
  expect(svgPath(folded)).not.toBe(svgPath(detached))
  expect(svgPath(returning)).not.toBe(svgPath(detached))
  expect(svgPath(returning)).not.toBe(svgPath(folded))
  expect(original.length).toBeGreaterThan(20)
})

test('decomposedYaoGroups consumes han-decompose verified cuts on primary serif glyphs', () => {
  expect(decomposeCuts.source).toBe('han-decompose')
  expect(decomposeCuts.font).toBe('noto-serif-cjk-jp@2.003')
  expect(Object.keys(decomposeCuts.cuts).length).toBeGreaterThan(800)
  for (const ch of ['紅', '絲', '繁', '玄', '幼', '慈', '變', '牽', '後', '系', '緣']) {
    const entry = decomposeCuts.cuts[ch]
    expect(entry).toBeDefined()
    expect(entry[1].every(g => g.length === 5)).toBe(true)
  }
  const [n, groups] = decomposeCuts.cuts['牽']
  const dummy = {
    contours: Array.from({ length: n }, (_, i) => ({
      ops: [['M', 1, false], ['L', 1, false], ['L', 1, false], ['L', 1, false]],
      light: [i * 20, 0, i * 20 + 10, 0, i * 20 + 10, 10, i * 20, 10],
      heavy: [i * 20, 0, i * 20 + 10, 0, i * 20 + 10, 10, i * 20, 10],
    })),
    box: [0, 0, 1000, 1000],
  }
  const got = decomposedYaoGroups(dummy, '牽', 1, 'serif', true)
  expect(got).toHaveLength(1)
  expect(got[0].indices).toEqual(groups[0])
  // Never applied to non-serif or fallback (v=0) glyphs, or contour count mismatches.
  expect(decomposedYaoGroups(dummy, '牽', 1, 'sans', true)).toBeNull()
  expect(decomposedYaoGroups(dummy, '牽', 1, 'serif', false)).toBeNull()
  expect(decomposedYaoGroups({ contours: dummy.contours.slice(0, -1), box: dummy.box }, '牽', 1, 'serif', true)).toBeNull()
})
