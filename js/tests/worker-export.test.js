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
    // A record or host list read for one sequence is not read again for the next.
    const shards = asked.filter(path => /^[gp]\//.test(path))
    expect(shards.length).toBeGreaterThan(0)
    expect(new Set(shards).size).toBe(shards.length)
  } finally {
    globalThis.self = previousSelf
    globalThis.fetch = previousFetch
  }
})

it('mixes active exports in the worker and returns a sketch before the drawing', async () => {
  const previousSelf = globalThis.self, previousFetch = globalThis.fetch
  const messages = []
  globalThis.self = { postMessage: message => messages.push(message) }
  globalThis.fetch = served(files, [])
  try {
    await import('../src/worker.js?five-face-mix')
    const faces = [{style:'sans',base:'/',share:0.25},{style:'regular',base:'/',share:0.75}]
    const send = weight => globalThis.self.onmessage({ data:{ id:1,sequence:'⿰木口', separate:true, faces, weight } })
    await send(1)
    expect(messages[0].sketch?.length).toBe(2)
    const neutral = messages.at(-1).drawn
    expect(neutral.parts.map(p => p.leaf)).toEqual([0,1])
    await send(1.35)
    expect(messages.at(-1).drawn.d).not.toBe(neutral.d)
  } finally {
    globalThis.self = previousSelf
    globalThis.fetch = previousFetch
  }
})
