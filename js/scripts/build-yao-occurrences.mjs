// Regenerate from the repository's pinned BabelStone source and reviewed 率 hosts.
import { readFileSync, writeFileSync } from 'node:fs'
import { tokens } from '../src/tokens.js'
import { arity, isSelector } from '../src/tree.js'
import catalogue from '../../src/han_compose/rate_forms/catalogue.json' with { type: 'json' }

const candidates = new Map()
const parents = new Map()
function add(host, ids, region, source = 0) {
  if (host === ids || ids.includes('？') || !arity([...ids][0])) return
  const tree = tokens(ids)
  // A subtraction can remove the very strokes that would constitute a target.
  const removed = tree.filter(t => t.text.startsWith('㇯'))
  const leaves = tree.filter(t => !arity([...t.text][0]) && t.text &&
    !removed.some(r => r.path.every((v, i) => t.path[i] === v))).map(t => t.text)
  if (!leaves.length) return
  if (!candidates.has(host)) candidates.set(host, [])
  candidates.get(host).push({ ids, leaves, region, source })
  for (const leaf of leaves) {
    if (!parents.has(leaf)) parents.set(leaf, new Set())
    parents.get(leaf).add(host)
  }
}

const input = readFileSync(new URL('../../data/vocab/han-ids.tsv', import.meta.url), 'utf8')
for (const row of input.split('\n')) {
  if (!row.startsWith('U+')) continue
  const [, host, seq] = row.split('\t')
  for (const alt of seq.trim().split(/\s+/)) {
    const m = /^(.+)\(([^()]*)\)$/u.exec(alt)
    if (!m) throw new Error('Unrecognized source row: ' + row)
    add(host, m[1], m[2])
  }
}
// BabelStone IDS.TXT note 6 lists this otherwise opaque numbered component.
add('{29}', '⿻弋𢆶', '', 1)
for (const [host, ids] of Object.entries(catalogue.hosts)) add(host, ids.replace('@', '率'), '', 2)
// A recorded IVS of 率 fixes the side strokes as well as the central 幺.
for (const [whole, structure] of [[catalogue.shapes['jp-chevron'], catalogue.shapes['cn-chevron']],
  [catalogue.shapes['jp-strokes'], catalogue.shapes['cn-strokes']]]) {
  add(whole, structure.replace('幺', '幺󠄀'), '', 2)
}

const supported = new Set(['幺', '幺󠄀'])
for (const leaf of supported) for (const parent of parents.get(leaf) ?? []) supported.add(parent)
const descriptions = {}
for (const host of [...supported].sort()) {
  const row = candidates.get(host)?.find(r => r.leaves.some(l => supported.has(l)))
  if (row) descriptions[host] = [row.ids, row.region, row.source]
}
const checked = new Set()
function check(host, ancestors) {
  if (checked.has(host)) return
  if (ancestors.has(host)) throw new Error('Cyclic selected source path: ' + [...ancestors, host].join(' → '))
  if (descriptions[host]) {
    const ids = descriptions[host][0]
    const row = candidates.get(host).find(r => r.ids === ids)
    for (const leaf of row.leaves) check(leaf, new Set([...ancestors, host]))
  }
  checked.add(host)
}
for (const host of supported) check(host, new Set())
const json = {
  sources: [
    {author:'Andrew West', title:'BabelStone IDS', date:'2025-06-27', url:'https://www.babelstone.co.uk/CJK/IDS.TXT', sha256:'cc2a0a97e6a51ed6ebe59870ef2af66e83f3c3c27387d79b4441bb2d791d78b1'},
    {author:'Andrew West', title:'BabelStone IDS, note 6, numbered components', date:'2025-06-27', url:'https://www.babelstone.co.uk/CJK/IDS.TXT'},
    {title:'Reviewed 率 forms', file:'src/han_compose/rate_forms/catalogue.json'},
  ],
  descriptions,
}
writeFileSync(new URL('../src/yao-hosts.json', import.meta.url), JSON.stringify(json) + '\n')
console.log(Object.keys(descriptions).filter(ch => [...ch].length === 1 && !isSelector(ch)).length + 1, 'characters')
