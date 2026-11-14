import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

/** A module of the package, as Node imports it. @param {string} name */
const module = name => JSON.stringify(pathToFileURL(join(import.meta.dirname, '..', 'src', name)).href)
/** Run a module under Node, whose `fetch` reads no `file:` URL. @param {string} code */
const node = code => spawnSync('node', ['--input-type=module', '-e', code], { encoding: 'utf8' })

describe('the bundled outlines under Node', () => {
  it('draws a Tangut character from the package\'s own file', () => {
    const { status, stdout, stderr } = node(`
      import { compose } from ${module('loader.js')}
      import { sourceFor } from ${module('source.js')}
      const drawn = await compose(sourceFor('\u{17000}', { bundled: true }), '\u{17000}')
      console.log(drawn.d.length > 0, drawn.origins.join())
    `)
    expect(status, stderr).toBe(0)
    expect(stdout.trim()).toBe('true glyph \u{17000}')
  })
  it('draws a character of the Unicode fallback from its shard', () => {
    const { status, stdout, stderr } = node(`
      import { compose } from ${module('loader.js')}
      import { sourceFor } from ${module('source.js')}
      const drawn = await compose(sourceFor('A', { bundled: true }), 'A')
      console.log(drawn.d.length > 0)
    `)
    expect(status, stderr).toBe(0)
    expect(stdout.trim()).toBe('true')
  })
  it('reads the files a host lists by the package\'s own URLs', () => {
    const { status, stdout, stderr } = node(`
      import { dataUrls } from ${module('index.js')}
      import { compose } from ${module('loader.js')}
      import { sourceFor } from ${module('source.js')}
      const drawn = await compose(sourceFor('\u{17000}', { bundled: true, loaders: dataUrls }), '\u{17000}')
      console.log(drawn.d.length > 0)
    `)
    expect(status, stderr).toBe(0)
    expect(stdout.trim()).toBe('true')
  })
})
