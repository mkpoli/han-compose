// Measure the standalone ink from public compose() results at a shared 1000-unit
// em. Arguments: directory of main-{style}.json and optional rcc-main-{style}.json.
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathRings, pointsBox, union } from '../src/geometry.js'

const directory = process.argv[2]
const commits = { sans: 'a83fc941166b', serif: '8156f838798c', regular: 'c14ee5e08798',
  fangsong: '9f797e2322d2', 'pen-writing': 'ce3eaafda8f9' }
const metrics = {}
for (const [style, commit] of Object.entries(commits)) {
  const entries = {}
  for (const prefix of ['main', 'rcc-main']) {
    const path = join(directory, `${prefix}-${style}.json`)
    if (!existsSync(path)) continue
    for (const [key, result] of Object.entries(JSON.parse(readFileSync(path)))) {
      if (!result.path) continue
      entries[key] = union(pathRings(result.path, 32).map(pointsBox)).map(v => Math.round(v * 10) / 10)
    }
  }
  metrics[commit] = entries
}
console.log(JSON.stringify(metrics))
