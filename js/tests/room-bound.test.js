import { describe, expect, it } from 'bun:test'
import { Composer } from '../src/compose.js'
import { partOf, placed } from '../src/geometry.js'
import { createSource } from '../src/loader.js'
import { files, shards } from './fixtures/small-export.js'
import sansOpenEnclosure from './fixtures/sans-open-enclosure.json' with { type: 'json' }

describe('the room of an enclosure', () => {
  it('reaches the last ink column of one open on the right', async () => {
    // 厂 as the Sans export draws it (SIL OFL 1.1), placed over four fifths of the face.
    const input = { ...files, ...shards('g', Object.entries(sansOpenEnclosure)) }
    const source = createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
    await source.ready()
    const composer = new Composer(source.store())
    const part = partOf(sansOpenEnclosure['厂'].G), face = composer.face
    const target = [face[0], face[1], face[0] + (face[2] - face[0]) * 0.8, face[3]]
    const room = composer.room('⿸', [placed(part, part.box, target, 0, 'test')], face)
    // One cell is 1/48 of the face; the room ends at the cell after the ink, 773, not at the one before.
    expect(room[2]).toBeGreaterThan(765)
    expect(room[2]).toBeLessThan(785)
  })
})
