// bun build.mjs <four-face-paths.json> <output.html>
import { readFile, writeFile } from 'node:fs/promises'
import { compose } from '../../src/loader.js'
import { exportSource } from '../../src/source.js'
import { partOf, placed, svgPath } from '../../src/geometry.js'

const [pathFile, output] = process.argv.slice(2)
if (!pathFile || !output) throw new Error('Expected the four-face JSON and an output HTML path')
const read = url => readFile(url, 'utf8')
const local = file => new URL(file, import.meta.url)
const facePaths = JSON.parse(await read(pathFile))
const samples = (await read(local('sample.tsv'))).trimEnd().split('\n').map(line => line.split('\t'))
const source = exportSource('https://ids-input-composer.mkpoli.workers.dev/c14ee5e08798-regular-compose-layout-v4-regular-f7/')
await source.ready()
const files = [...source.filesOf(samples.map(([ch]) => ch))]
for (let i = 0; i < files.length; i += 12) await source.load(files.slice(i, i + 12))

const text = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
function glyph(d, viewBox = '0 0 1000 1000') {
  if (typeof d !== 'string' || !/^M[MLQCHVZ\d.,\s-]+$/i.test(d)) throw new Error('Missing or invalid glyph path')
  return `<svg viewBox="${viewBox}" aria-hidden="true"><path d="${d}"/></svg>`
}
const cards = [], regular = new Map()
for (const [ch, ids] of samples) {
  const record = source.store().rec(ch)
  if (!record?.G) throw new Error(`Missing Regular Kai outline for ${ch}`)
  const g = partOf(record.G)
  const native = svgPath([placed(g, g.box, source.manifest.constants.face, 0, 'native')])
  const connected = (await compose(source, ch, { fontStyle: 'regular' })).d
  regular.set(ch, { native, connected })
  cards.push(`<li><div class="name"><b>${text(ch)}</b><small>${text(ids)}</small></div>
    <figure>${glyph(native)}<figcaption>原字形</figcaption></figure>
    <figure>${glyph(connected)}<figcaption>连写</figcaption></figure></li>`)
}

const styles = ['sans', 'serif', 'fangsong', 'pen-writing']
const comparisons = [...'菜草落葉蘇蘭藏萬艾華茰𦴯'].map(ch => {
  const { native, connected } = regular.get(ch)
  // Some native outlines extend slightly beyond the em (Zhuque 萬 reaches y = 1001).
  const matrixGlyph = d => glyph(d, '-8 -8 1016 1016')
  const row = (label, kai, variant) => `<th scope="row">${label}</th><td>${matrixGlyph(kai)}</td>` +
    styles.map(style => {
      const path = facePaths[ch]?.[style]?.[variant]
      if (!path) throw new Error(`Missing ${ch} ${style} ${variant}`)
      return `<td>${matrixGlyph(path)}</td>`
    }).join('')
  return `<tbody><tr><th scope="rowgroup" rowspan="2">${ch}</th>${row('连写', connected, 'connected')}</tr>
    <tr>${row('分写', native, 'split')}</tr></tbody>`
})
const template = await read(local('gallery.html'))
await writeFile(output, template.replace('<!-- cards -->', cards.join('\n')).replace('<!-- comparisons -->', comparisons.join('\n')))
