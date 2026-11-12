import { expect, test } from 'bun:test'
import { variationSequences } from '../src/variants.js'

test('an export lists each character with the variation sequences it draws', async () => {
  let asked = 0
  const fetch = async url => { asked++; expect(url).toBe('https://export.test/v1/variants.json'); return Response.json({ 者: '\u{E0101}', 侮: '︀\u{E0101}' }) }
  const found = await variationSequences('https://export.test/v1', { fetch })
  expect(found.get('者')).toEqual(['者\u{E0101}'])
  expect(found.get('侮')).toEqual(['侮︀', '侮\u{E0101}'])
  expect(found.has('何')).toBe(false)
  await variationSequences('https://export.test/v1/', { fetch })
  expect(asked).toBe(1)
})

test('an export without the file draws no variation sequence', async () => {
  const found = await variationSequences('https://export.test/none/', { fetch: async () => new Response('', { status: 404 }) })
  expect(found.size).toBe(0)
})

test('a failed read is asked for again', async () => {
  let asked = 0
  const fetch = async () => ++asked === 1 ? new Response('', { status: 500 }) : Response.json({ 者: '\u{E0101}' })
  await expect(variationSequences('https://export.test/retry/', { fetch })).rejects.toThrow('variants.json: 500')
  expect((await variationSequences('https://export.test/retry/', { fetch })).get('者')).toEqual(['者\u{E0101}'])
})
