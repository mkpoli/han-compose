// The Worker when the export's manifest is read and its layout is not: a sequence the bundled
// outlines cover is still drawn from them, and any other is answered as unavailable.
import { expect, it } from 'bun:test'
import { files } from './fixtures/small-export.js'
import { served } from './support.js'

it('draws from the bundled outlines when the layout cannot be read, and calls the rest unavailable', async () => {
  const previousSelf = globalThis.self, previousFetch = globalThis.fetch
  const messages = []
  const over = served(files)
  globalThis.self = { postMessage: message => messages.push(message) }
  globalThis.fetch = async url => String(url).endsWith('layout.json') ? new Response('down', { status: 503 }) : over(url)
  try {
    // A query makes this the module's own copy: another test's Worker keeps its handler and sources.
    await import('../src/worker.js?model')
    const send = data => globalThis.self.onmessage({ data: { base: '/', fontStyle: 'sans', ...data } })
    await send({ id: 1, sequence: '⿰あい' })
    expect(messages.at(-1).drawn?.origins).toEqual(['glyph あ', 'glyph い'])
    await send({ id: 2, sequence: '⿰木口' })
    expect(messages.at(-1)).toMatchObject({ id: 2, unavailable: true })
    expect(messages.at(-1).error).toContain('layout.json')
    // A lone character needs neither file and is drawn from the export.
    await send({ id: 3, sequence: '木' })
    expect(messages.at(-1).drawn?.origins).toEqual(['glyph 木'])
  } finally {
    globalThis.self = previousSelf
    globalThis.fetch = previousFetch
  }
  // A failed fetch is retried before the layout is called unavailable: the test outlives the retries.
}, 60_000)
