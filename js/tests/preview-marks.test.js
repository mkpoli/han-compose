import { describe, expect, it } from 'bun:test'
import { composerPreview } from '../src/index.js'

class FakeWorker {
  static posted = []
  postMessage(message) {
    FakeWorker.posted.push(message)
    queueMicrotask(() => this.onmessage({ data: { id: message.id, drawn: { d: `M${FakeWorker.posted.length} 0Z` } } }))
  }
  terminate() {}
}

describe('a preview of a marked description', () => {
  it('asks for the marks, and keeps a marked drawing apart from the plain one', async () => {
    const preview = composerPreview({ base: 'http://example.org/', worker: () => new FakeWorker() })
    const marked = await preview('木ˊ')
    expect(FakeWorker.posted.at(-1).sequence).toBe('木ˊ')
    const plain = await preview('木')
    expect(FakeWorker.posted.at(-1).sequence).toBe('木')
    expect(plain.d).not.toBe(marked.d)
  })
})
