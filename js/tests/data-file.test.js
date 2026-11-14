import { expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dataFile } from '../src/unicode.js'
import { dataUrls } from '../src/index.js'

it('finds a nested data file under the package, not beside the module', () => {
  for (const path of ['unicode/outlines/000.json.gz', 'sources/palette/outlines.json.gz', 'numbered-forms.json']) {
    const url = dataFile(path)
    expect(url.href).toEndWith(`/data/${path}`)
    expect(existsSync(fileURLToPath(url))).toBe(true)
  }
  for (const [path, url] of Object.entries(dataUrls)) expect(url).toEndWith(`/data/${path}`)
})
