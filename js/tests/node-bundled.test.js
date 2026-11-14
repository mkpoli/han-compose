import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const source = join(import.meta.dirname, '..', 'src')
/** Run a module under Node, whose `fetch` reads no `file:` URL. @param {string} code */
const node = code => spawnSync('node', ['--input-type=module', '-e', code], { encoding: 'utf8' })

describe('the bundled outlines under Node', () => {
  it('draws a Tangut character from the package\'s own file', () => {
    const { status, stdout, stderr } = node(`
      import { compose } from ${JSON.stringify(join(source, 'loader.js'))}
      import { sourceFor } from ${JSON.stringify(join(source, 'source.js'))}
      const drawn = await compose(sourceFor('\u{17000}', { bundled: true }), '\u{17000}')
      console.log(drawn.d.length > 0, drawn.origins.join())
    `)
    expect(stderr).toBe('')
    expect(status).toBe(0)
    expect(stdout.trim()).toBe('true glyph \u{17000}')
  })
  it('draws a character of the Unicode fallback from its shard', () => {
    const { status, stdout, stderr } = node(`
      import { compose } from ${JSON.stringify(join(source, 'loader.js'))}
      import { sourceFor } from ${JSON.stringify(join(source, 'source.js'))}
      const drawn = await compose(sourceFor('A', { bundled: true }), 'A')
      console.log(drawn.d.length > 0)
    `)
    expect(stderr).toBe('')
    expect(status).toBe(0)
    expect(stdout.trim()).toBe('true')
  })
})
