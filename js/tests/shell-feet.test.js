import { expect, it } from 'bun:test'
import { compose, createSource } from '../src/loader.js'
import { pathRings, pointsBox, union } from '../src/geometry.js'
import { files, records, shards } from './fixtures/small-export.js'
// 賦 from the Zhuque FangSong export (SIL OFL 1.1).
import fu from './fixtures/fangsong-fu.json' with { type: 'json' }

const host = { h: '賦', d: 0, i: 0, j: 1, op: '⿰', ok: ['武'], r: 21, si: 8038.3, v: 1,
  c: { b: [55, -95, 423, 714], fr: [55, -107, 935, 814], g: -139, k: [1, 2, 3], wh: 1 } }
function src(donor = fu) {
  const assets = { ...files, 'manifest.json': JSON.stringify({ ...JSON.parse(files['manifest.json']), weighted: false }),
    ...shards('g', Object.entries({ 賦: donor, 貝: records.口, 並: records.木 })),
    ...shards('p', [['L\t貝', [host]]]) }
  return createSource(async name => assets[name] === undefined ? null : new Uint8Array(Buffer.from(assets[name])).buffer)
}

it('recovers the right foot from 賦 as the seventh FangSong 貝 stroke', async () => {
  const source = src(), id = '⿰貝並'
  // Reorder two 武-only contours. The selected cut stays identical but its donor signature changes.
  const alternate = structuredClone(fu)
  const contours = alternate.G.p
  ;[contours[4], contours[5]] = [contours[5], contours[4]]
  const control = await compose(src(alternate), id, { fontStyle: 'fangsong', separate: true })
  const revised = await compose(source, id, { fontStyle: 'fangsong', separate: true })
  expect(revised.parts).toHaveLength(2)
  const original = pathRings(control.parts[0].d), repaired = pathRings(revised.parts[0].d)
  expect(original).toHaveLength(3)
  expect(repaired.slice(0, 3)).toEqual(original)
  expect(repaired).toHaveLength(4)
  expect(union(repaired.map(pointsBox))).toEqual(union(original.map(pointsBox)))
  expect(revised.parts[0].strokes).toEqual([...control.parts[0].strokes, [6, [3]]])
  expect(revised.parts[1]).toEqual(control.parts[1])
  expect((await compose(source, id, { fontStyle: 'fangsong' })).d).toEqual(revised.d)
})
