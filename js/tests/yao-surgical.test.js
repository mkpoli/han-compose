import { expect, test } from 'bun:test'
import { alignedYaoGroups, collapseYaoHost, collectYaoHosts, findYaoGroups, replaceYaoInPart } from '../src/yao-surgical.js'
import { selectYao, yaoOccurrences } from '../src/yao-occurrences.js'
import { Composer } from '../src/compose.js'
import { svgPath } from '../src/geometry.js'
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
