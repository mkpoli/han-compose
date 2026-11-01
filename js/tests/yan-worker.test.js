import { expect, it } from 'bun:test'

it('requests the Kaisho export for native Noto enclosure combinations', async () => {
  const previousSelf = globalThis.self, previousFetch = globalThis.fetch
  const messages = [], requested = []
  globalThis.self = { postMessage: message => messages.push(message) }
  globalThis.fetch = async url => {
    requested.push(String(url))
    throw new Error('offline')
  }
  try {
    await import('../src/worker.js')
    for (const sequence of ['⿸⿳亠㐅厂彡', '⿸⿱文厂生']) {
      messages.length = 0
      await globalThis.self.onmessage({ data: { id: 1, sequence, base: 'https://example.test/', fontStyle: 'kaisho' } })
      expect(messages.at(-1)).toMatchObject({ id: 1, unavailable: true })
    }
    expect(requested.some(url => url.endsWith('/manifest.json'))).toBe(true)
  } finally {
    globalThis.self = previousSelf
    globalThis.fetch = previousFetch
  }
})
