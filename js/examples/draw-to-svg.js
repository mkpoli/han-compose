// Draw one sequence from an export and write the SVG.
//
//   bun examples/draw-to-svg.js https://example.org/composer/<version>/ '⿰木口' > out.svg
//
// `compose` reads the export over HTTP: its manifest, its layout, and only the records and host
// lists the sequence needs. What comes back is a drawing in a 1000-unit box: `d` is the ink, and
// `parts` says which leaf of the description each piece stands for.
import { compose, drawingSvg, fromUrl } from '@han-compose/composer'

const [base, sequence = '⿰木口'] = process.argv.slice(2)
if (!base) {
  console.error('usage: bun examples/draw-to-svg.js EXPORT_FOLDER [SEQUENCE]')
  process.exit(2)
}

const source = fromUrl(base)
await source.ready()
const drawing = await compose(source, sequence, { separate: true })
const svg = drawingSvg(drawing)
process.stdout.write(svg + '\n')
console.error(`${sequence}: ${drawing.parts?.length ?? 0} parts, ${svg.length} bytes of SVG`)
