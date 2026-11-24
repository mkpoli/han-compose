// Build the standalone example, including the same IDS UI styles used in ids-input.
import { cp, mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const example = dirname(fileURLToPath(import.meta.url))
const root = resolve(example, '../..')
const out = resolve(process.argv[2] ?? join(root, 'dist/font-mixer'))
const revision = '3052ce470663f665151fbb7e33178f84adc374c9'
const design = await Promise.all(
  ['tokens', 'base', 'controls'].map(async (name) => {
    const response = await fetch(
      `https://raw.githubusercontent.com/mkpoli/ids-input/${revision}/design/${name}.css`
    )
    if (!response.ok) throw new Error('Could not read IDS UI ' + name + ' (' + response.status + ')')
    return response.text()
  })
)
await mkdir(join(out, 'src'), { recursive: true })
const license = await fetch(`https://raw.githubusercontent.com/mkpoli/ids-input/${revision}/LICENSE`)
if (!license.ok) throw new Error('Could not read the IDS UI license')
await writeFile(
  join(out, 'ids-ui.css'),
  '/*! IDS UI ' + revision + '\n' + (await license.text()) + '*/\n' + design.join('\n')
)
for (const file of ['index.html', 'exports.json']) await cp(join(example, file), join(out, file))
await cp(join(root, 'data'), join(out, 'data'), { recursive: true })
const build = await Bun.build({
  entrypoints: [join(example, 'app.js'), join(root, 'src/worker.js')],
  outdir: join(out, 'src'),
  naming: '[name].js',
  target: 'browser'
})
if (!build.success) throw new AggregateError(build.logs, 'Could not build the mixer')
