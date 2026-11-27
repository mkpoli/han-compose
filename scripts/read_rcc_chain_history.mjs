// Read the RCC public history for the same journal revision as the JSON export.
// Usage: bun scripts/read_rcc_chain_history.mjs <export.json> <output-directory>
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
const endpoint = 'https://rare.glyphatlas.org/en/history/__data.json'
function unpackHistory(body) {
  const flat = body.nodes?.findLast(node => node.type === 'data')?.data
  if (!flat) throw Error('No history node')
  function value(pointer) {
    if (pointer === -1) return undefined
    if (pointer < 0) return null
    const v = flat[pointer]
    if (Array.isArray(v)) return v.map(value)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k,p]) => [k,value(p)]))
    return v
  }
  return { rows: value(flat[0].rows), next: value(flat[0].next) }
}
function extractMatching(rows, url) {
  return rows.flatMap(row => {
    const claims = (row.fields?.claims ?? []).filter(claim => ['ids','composition'].includes(claim.kind) && /#\(/u.test(claim.value))
    const snapshotIds = row.fields?.ids ?? null
    if (!claims.length && !/#\(/u.test(snapshotIds ?? '')) return []
    return [{entry:row.entry_id, revision:row.id, record_revision:row.rev, date:row.at, kind:row.kind,
      history_url:url.replace('/__data.json',''), claims, snapshot_ids:snapshotIds, layout:row.fields?.layout ?? null}]
  })
}
async function tranche(dir, upper, lower) {
  const file = join(dir, `global-${lower}-${upper}.json`)
  let stored
  try { stored = JSON.parse(await readFile(file, 'utf8')) } catch { stored = {pages: [], matching: [], next: upper} }
  while (stored.next && stored.next > lower) {
    const url = `${endpoint}?before=${stored.next}`
    let response
    for(let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetch(url, {signal: AbortSignal.timeout(18000)})
        if (response.ok) break
      } catch {}
      await Bun.sleep(1200 * (attempt + 1))
    }
    if(!response?.ok) throw Error(`History cursor ${stored.next} could not load (${response?.status ?? 'fetch error'})`)
    const {rows,next} = unpackHistory(await response.json())
    if(next && next >= stored.next) throw Error(`Invalid cursor at ${stored.next}`)
    const inRange = rows.filter(row => row.id >= lower)
    stored.matching.push(...extractMatching(inRange, url))
    stored.pages.push({before:stored.next, next, public_rows:inRange.length})
    stored.next=next
    await writeFile(file, JSON.stringify(stored,null,2)+'\n')
    await Bun.sleep(125)
  }
}
const [, , snapshot, directory] = process.argv
if (!snapshot || !directory) throw Error('Usage: bun scripts/read_rcc_chain_history.mjs <export.json> <output-directory>')
const revision = JSON.parse(await readFile(snapshot, 'utf8')).dataset.revision
if (!Number.isSafeInteger(revision) || revision < 1) throw Error('The snapshot has no journal revision')
await mkdir(directory, { recursive: true })
const mid = Math.floor(revision / 2) + 1
await Promise.all([tranche(directory, revision + 1, mid), tranche(directory, mid, 1)])
