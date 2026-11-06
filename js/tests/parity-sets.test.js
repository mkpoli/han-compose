import { describe, expect, it } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GATED, paritySets } from './parity/parity.js'

describe('the parity sets of an export', () => {
  it('gates only the held-out set, which an export may not have', () => {
    const folder = mkdtempSync(join(tmpdir(), 'parity-'))
    writeFileSync(join(folder, 'parity.json'), '[]')
    expect(paritySets(folder)).toEqual(['parity.json'])
    expect(paritySets(folder)).not.toContain(GATED)
    writeFileSync(join(folder, GATED), '[]')
    expect(paritySets(folder)[0]).toBe(GATED)
  })
})
