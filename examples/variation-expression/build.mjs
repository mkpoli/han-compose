// bun js/examples/variation-expression/build.mjs [output folder]
import { copyFile, cp, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const out = resolve(process.argv[2] ?? join(import.meta.dir, '../../dist/variation-expression'))
await mkdir(out, { recursive: true })
for (const file of ['index.html', 'gallery.css', 'component-reference.woff']) await copyFile(join(import.meta.dir, file), join(out, file))
await copyFile(join(import.meta.dir, '../../../src/han_compose/rate_forms/NOTICE.txt'), join(out, 'NOTICE.txt'))
const result = await Bun.build({
  define: { 'process.env.YAO_SERIF_EXPORT': JSON.stringify(process.env.YAO_SERIF_EXPORT || '') },
  entrypoints: ['app.js', 'preview.js'].map(name => join(import.meta.dir, name)), outdir: out, format: 'iife', target: 'browser', minify: true,
})
if (!result.success) throw new AggregateError(result.logs, 'Could not build the component gallery')
for (const file of ['unicode/outlines', 'sources', 'custom-forms.json.gz', 'licences']) {
  await cp(join(import.meta.dir, '../../data', file), join(out, 'data', file), { recursive: true })
}
