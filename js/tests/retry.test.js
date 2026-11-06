import { describe, expect, it } from 'bun:test'
import { retrying } from '../src/retry.js'

const answering = (...responses) => {
  const asked = []
  return { asked, get: async input => { asked.push(input); return responses.shift() } }
}

describe('a retried download', () => {
  it('answers at once when the server asks for longer than a drawing waits', async () => {
    const { asked, get } = answering(new Response('', { status: 429, headers: { 'retry-after': '30' } }))
    const response = await retrying(get, [0, 0])('/a')
    expect(response.status).toBe(429)
    expect(asked).toHaveLength(1)
  })
  it('waits as long as a short Retry-After asks', async () => {
    const { get } = answering(new Response('', { status: 429, headers: { 'retry-after': '1' } }), new Response('ok'))
    const started = Date.now()
    expect((await retrying(get, [0])('/a')).status).toBe(200)
    expect(Date.now() - started).toBeGreaterThanOrEqual(900)
  })
  it('stops waiting when a Request\'s own signal aborts', async () => {
    const control = new AbortController()
    const { asked, get } = answering(new Response('', { status: 503 }), new Response('ok'))
    const request = new Request('http://example.org/a', { signal: control.signal })
    const answer = retrying(get, [60_000])(request)
    setTimeout(() => control.abort(new Error('stopped')), 10)
    await expect(answer).rejects.toThrow('stopped')
    expect(asked).toHaveLength(1)
  })
})
