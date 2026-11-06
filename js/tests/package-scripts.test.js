import { describe, expect, it } from 'bun:test'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const run = (script, cwd) => spawnSync('node', [script], { cwd, encoding: 'utf8' })

describe('preparing an installed package', () => {
  const unpacked = () => {
    const root = mkdtempSync(join(tmpdir(), 'composer-'))
    const pack = join(root, 'pack')
    mkdirSync(join(pack, 'data'), { recursive: true })
    mkdirSync(join(pack, 'scripts'))
    writeFileSync(join(pack, 'data', 'kept.json'), '{}')
    for (const name of ['data.mjs', 'types.mjs']) cpSync(join(import.meta.dirname, '..', 'scripts', name), join(pack, 'scripts', name))
    return { root, pack }
  }
  it('keeps its data when an unrelated folder is called data beside it', () => {
    const { root, pack } = unpacked()
    mkdirSync(join(root, 'data'))
    const { status } = run('scripts/data.mjs', pack)
    expect(status).toBe(0)
    expect(readFileSync(join(pack, 'data', 'kept.json'), 'utf8')).toBe('{}')
  })
  it('skips the declarations without a compiler', () => {
    const { pack } = unpacked()
    const { status, stdout } = run('scripts/types.mjs', pack)
    expect(status).toBe(0)
    expect(stdout).toContain('no TypeScript')
    expect(existsSync(join(pack, 'types'))).toBe(false)
  })
})
