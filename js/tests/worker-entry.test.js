import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// The Worker entry is published beside the rest: a host that wraps its own Worker, and an audit that
// drives the handler directly, import `@han-compose/composer/worker` rather than reach into `src/`.
// The handler itself is covered by `yan-worker.test.js`.
describe('the worker entry', () => {
  const root = join(import.meta.dirname, '..')
  const { exports } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  it('is named by the package, its declaration beside it', () => {
    expect(exports['./worker']).toEqual({ types: './types/worker.d.ts', default: './src/worker.js' })
    expect(existsSync(join(root, 'src/worker.js'))).toBe(true)
    expect(existsSync(join(root, 'types/worker.d.ts'))).toBe(true)
  })
})
