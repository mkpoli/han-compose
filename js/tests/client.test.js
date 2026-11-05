// The drawer a page holds: one worker at a time, a newer sequence ending the one before.
import { describe, expect, it } from 'bun:test'
import { createDrawer } from '../src/client.js'

/** A worker the test speaks for: what it was posted, whether it was ended, and its answer. */
class FakeWorker {
  static made = []
  constructor() { this.posted = []; this.ended = false; FakeWorker.made.push(this) }
  postMessage(message) { this.posted.push(message) }
  terminate() { this.ended = true }
  answer(data) { this.onmessage?.({ data }) }
}

describe('the drawer', () => {
  it('ends the worker of a drawing a newer sequence replaces, and drops its late answer', async () => {
    FakeWorker.made = []
    const drawer = createDrawer(() => new FakeWorker(), 'https://example.org/composer/v/')
    const first = drawer.draw('⿰木口')
    const [one] = FakeWorker.made
    expect(one.posted[0]).toMatchObject({ sequence: '⿰木口', base: 'https://example.org/composer/v/' })
    const second = drawer.draw('⿱木口')
    expect(await first).toEqual({ status: 'cancelled' })
    expect(one.ended).toBe(true)
    const two = FakeWorker.made[1]
    one.answer({ id: one.posted[0].id, drawn: { d: 'M0 0Z' } })
    two.answer({ id: two.posted[0].id, drawn: { d: 'M1 1Z' } })
    expect(await second).toEqual({ status: 'composed', drawn: { d: 'M1 1Z' }, sketch: null })
  })
  it('reports a failed drawing, a crash, and a cancelled one', async () => {
    FakeWorker.made = []
    const drawer = createDrawer(() => new FakeWorker(), '/b/')
    const failing = drawer.draw('⿰木口')
    const [worker] = FakeWorker.made
    worker.answer({ id: worker.posted[0].id, error: 'No glyph or sequence draws 㐀.' })
    expect(await failing).toEqual({ status: 'failed', error: 'No glyph or sequence draws 㐀.' })
    const crashed = drawer.draw('⿱木口')
    worker.onerror({ message: 'boom', preventDefault() {} })
    expect(await crashed).toEqual({ status: 'failed', error: 'boom' })
    const left = drawer.draw('⿲木口木')
    drawer.cancel()
    expect(await left).toEqual({ status: 'cancelled' })
    expect(FakeWorker.made.every(ended => ended.ended)).toBe(true)
  })
  it('hears the sketch before the drawing', async () => {
    FakeWorker.made = []
    const drawer = createDrawer(() => new FakeWorker(), '/b/')
    const heard = []
    const answer = drawer.draw('⿰木口', leaves => heard.push(leaves.length))
    const [worker] = FakeWorker.made
    const leaves = [{ index: 0, box: [0, 0, 500, 1000] }, { index: 1, box: [500, 0, 500, 1000] }]
    worker.answer({ id: worker.posted[0].id, sketch: leaves })
    worker.answer({ id: worker.posted[0].id, drawn: { d: 'M0 0Z' } })
    expect(heard).toEqual([2])
    expect(await answer).toMatchObject({ status: 'composed', sketch: leaves })
  })
})
