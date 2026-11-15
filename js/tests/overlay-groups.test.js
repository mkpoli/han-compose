// An overlay drawn whole from another character, where the export lists a KanjiVG group made of
// its components whose two operands cross.
import { describe, expect, it } from 'bun:test'
import { compose, createSource } from '../src/loader.js'
import { character, constants, files, records, shards } from './fixtures/small-export.js'

// 木 through 口, 口 stacked on 木, and 口 resting on 木's bar: a contour each for 木's stem, its bar and 口.
const through = character('速', [[470, -80, 530, 820], [100, 400, 900, 460], [250, 200, 750, 650]])
const stacked = character('褒', [[470, -80, 530, 450], [100, 300, 900, 360], [250, 500, 750, 800]])
const resting = character('襃', [[470, -80, 530, 450], [100, 380, 900, 440], [250, 400, 750, 800]])
const entry = (host, rank, box) => ({ r: rank, h: host, v: 1, j: 1, gn: ['木', '口'], gc: [[0], [0], [1]], c: { b: box, k: [0, 1, 2], kv: 1 } })
const KEY = `${constants.OVERLAY_GROUPS}\t口木`
const lists = {
  速: entry('速', 2, [100, -80, 900, 820]),
  褒: entry('褒', 0, [100, -80, 900, 800]),
  襃: entry('襃', 1, [100, -80, 900, 800]),
}
const sourceOver = (hosts, manifest = null) => {
  const input = { ...files, ...shards('g', Object.entries({ ...records, 速: through, 褒: stacked, 襃: resting })),
    ...shards('p', [[KEY, hosts.map(host => lists[host])]]), ...(manifest ? { 'manifest.json': JSON.stringify(manifest) } : {}) }
  return createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
}

describe('an overlay the export lists a group for', () => {
  it('is drawn whole from the group whose operands cross', async () => {
    const drawn = await compose(sourceOver(['褒', '襃', '速']), '⿻木口')
    expect(drawn.origins).toEqual(['instance 速'])
    expect(drawn.parts).toHaveLength(1)
    // The same components the other way round name the same group.
    expect((await compose(sourceOver(['褒', '襃', '速']), '⿻口木')).origins).toEqual(['instance 速'])
  })

  it('passes over a stack of the same components, and one resting on the other', async () => {
    const drawn = await compose(sourceOver(['褒', '襃']), '⿻木口')
    expect(drawn.origins.some(origin => origin.startsWith('instance'))).toBe(false)
    // 口 reaches 40 units into 木's box, a tenth of its own height: under the half that crosses.
    expect(constants.OVERLAY_CROSS).toBeGreaterThan(40 / 400)
  })

  it('draws the overlay as before from an export that lists no groups', async () => {
    const { OVERLAY_GROUPS: _place, OVERLAY_CROSS: _cross, ...older } = constants
    const manifest = { ...JSON.parse(files['manifest.json']), constants: older }
    const drawn = await compose(sourceOver(['速'], manifest), '⿻木口')
    expect(drawn.origins.some(origin => origin.startsWith('instance'))).toBe(false)
    const none = await compose(sourceOver([]), '⿻木口')
    expect(none.origins).toEqual(drawn.origins)
  })

  it('draws each operand as a part of its own where the parts are asked for', async () => {
    const whole = await compose(sourceOver(['速']), '⿻木口')
    const apart = await compose(sourceOver(['速']), '⿻木口', { separate: true })
    expect(whole.origins).toEqual(['instance 速'])
    expect(apart.origins.some(origin => origin.startsWith('instance'))).toBe(false)
    expect(apart.parts.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps a group when it cannot tell the operands apart', async () => {
    // Both operands name 木: nothing says which outline is whose.
    const twin = { ...lists.褒, gn: ['木', '木'] }
    const input = { ...files, ...shards('g', Object.entries({ ...records, 褒: stacked })), ...shards('p', [[`${constants.OVERLAY_GROUPS}\t木木`, [twin]]]) }
    const source = createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
    expect((await compose(source, '⿻木木')).origins).toEqual(['instance 褒'])
  })
})
