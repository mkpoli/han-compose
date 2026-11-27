import { expect, it } from 'bun:test'
import { Composer } from '../src/compose.js'
import { createSource } from '../src/loader.js'
import { files, records } from './fixtures/small-export.js'

it('tries a positional form before the key where the export lists the key after it', async () => {
  const loaded = createSource(async name => files[name] === undefined ? null : new Blob([files[name]]).arrayBuffer())
  await loaded.ready()
  const composer = new Composer(loaded.store())
  const written = { 木: { ...records.木, a: { T: ['三', '木'], L: ['口'] } } }
  composer.rec = key => written[key]
  expect(composer.alternatives('木', 'T')).toEqual(['三', '木'])
  expect(composer.alternatives('木', 'L')).toEqual(['木', '口'])
  expect(composer.alternatives('木', 'R')).toEqual(['木'])
})
