// The Worker draws every sequence of one export from one source of it: the export's manifest and
// layout are read once, by a warming or by the first drawing, whatever the sequences that follow.
import { expect, it } from 'bun:test'
import { files } from './fixtures/small-export.js'
import { served } from './support.js'

it('reads an export once for a warming and for sequences of different kinds', async () => {
  const previousSelf = globalThis.self, previousFetch = globalThis.fetch
  const messages = [], asked = []
  globalThis.self = { postMessage: message => messages.push(message) }
  globalThis.fetch = served(files, asked)
  try {
    // A query makes this the module's own copy: another test's Worker keeps its handler and sources.
    await import('../src/worker.js?one-export')
    const send = data => globalThis.self.onmessage({ data: { base: '/', fontStyle: 'sans', ...data } })
    await send({ id: 1, warm: true })
    expect(messages.at(-1)).toEqual({ id: 1, warm: true })
    // A plain description, one with a loose mark, and one drawn from the export by preference.
    await send({ id: 2, sequence: '⿰木口' })
    await send({ id: 3, sequence: '⿰木口́' })
    await send({ id: 4, sequence: '木', preferExport: true })
    expect(messages.filter(message => message.drawn).map(message => message.id)).toEqual([2, 3, 4])
    const times = name => asked.filter(path => path.endsWith(name)).length
    expect(times('manifest.json')).toBe(1)
    expect(times('layout.json')).toBe(1)
    // A record read for one sequence is not read again for the next.
    expect(new Set(asked.filter(path => /\/g\//.test(path))).size).toBe(asked.filter(path => /\/g\//.test(path)).length)
  } finally {
    globalThis.self = previousSelf
    globalThis.fetch = previousFetch
  }
})
