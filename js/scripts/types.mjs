// Declarations, on an install that has the compiler: `npm install --omit=dev` runs `prepare` without
// it, and a package installed from its tarball already holds `types/`.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const compiler = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
if (!existsSync(compiler)) {
  console.log('types: no TypeScript installed; types/ is used as it stands')
  process.exit(0)
}
const { status } = spawnSync(process.execPath, [compiler, '-p', 'tsconfig.json'], { cwd: root, stdio: 'inherit' })
process.exit(status ?? 1)
