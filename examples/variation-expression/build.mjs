// bun js/examples/variation-expression/build.mjs [output folder]
import { copyFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const out = resolve(process.argv[2] ?? join(import.meta.dir, '../../dist/variation-expression'))
await mkdir(out, { recursive: true })
for (const file of ['index.html', 'gallery.css', 'component-reference.woff']) await copyFile(join(import.meta.dir, file), join(out, file))
await copyFile(join(import.meta.dir, '../../../src/han_compose/rate_forms/NOTICE.txt'), join(out, 'NOTICE.txt'))
const result = await Bun.build({
  entrypoints: [join(import.meta.dir, 'app.js')], outdir: out, format: 'iife', target: 'browser', minify: true,
})
if (!result.success) throw new AggregateError(result.logs, 'Could not build the component gallery')
