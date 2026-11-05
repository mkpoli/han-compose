import { describe, expect, it } from 'bun:test'
import { drawingSvg, emojiPlace } from '../src/drawing-svg.js'
import { composerPreview } from '../src/index.js'

class FakeWorker {
  posted = []
  postMessage(message) {
    this.posted.push(message)
    const slot = { index: 0, box: [0, 0, 1000, 1000] }
    queueMicrotask(() => {
      this.onmessage({ data: { id: message.id, sketch: [{ index: 0, box: slot.box, empty: true }] } })
      this.onmessage({ data: { id: message.id, drawn: { d: '', slots: [slot] } } })
    })
  }
  terminate() {}
}

describe('an Emoji in a drawing', () => {
  it('stands at finite numbers whatever its box holds', () => {
    for (const item of [{}, { box: [1, 2] }, { box: [1, 'x', 3, 4] }, null]) {
      const place = emojiPlace(item)
      expect([place.x, place.y, place.size].every(Number.isFinite)).toBe(true)
    }
  })
  it('is drawn whatever part it names', () => {
    const svg = drawingSvg({
      d: '',
      parts: [{ d: 'M0 0L1 1Z', leaf: 0 }],
      emoji: [{ text: '😀', box: [0, 0, 9, 9], part: 0 }, { text: '😁', box: [0, 0, 9, 9], part: 0 }, { text: '🙂', box: [0, 0, 9, 9], part: 9 }],
    })
    for (const text of ['😀', '😁', '🙂']) expect(svg).toContain(text)
  })
  it('has a part when nothing else was drawn', async () => {
    const preview = composerPreview({ base: 'http://example.org/', separate: true, worker: () => new FakeWorker() })
    const drawing = await preview('😀')
    expect(drawing.parts).toEqual([{ leaf: 0, origin: 'emoji', box: [0, 0, 1000, 1000], d: '' }])
    expect(drawing.emoji[0].part).toBe(0)
  })
})
