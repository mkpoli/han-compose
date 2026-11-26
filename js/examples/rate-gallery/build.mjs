// bun examples/rate-gallery/build.mjs [output directory]
import { cp, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const example = dirname(fileURLToPath(import.meta.url))
const out = resolve(process.argv[2] ?? join(example, '../../dist/rate-gallery'))
await mkdir(out, { recursive: true })
for (const file of ['index.html', 'gallery.css']) await cp(join(example, file), join(out, file))
// A classic script, so the page also opens from a file: URL.
const build = await Bun.build({
  entrypoints: [join(example, 'app.js')],
  outdir: out,
  naming: 'app.js',
  target: 'browser',
  format: 'iife',
  minify: true
})
if (!build.success) throw new AggregateError(build.logs, 'Could not build the gallery')
