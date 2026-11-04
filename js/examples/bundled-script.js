// Draw a Tangut character from the outlines the package carries, with no export at all.
//
//   bun examples/bundled-script.js '𗀀'
//
// A page that has no composer export still draws the scripts whose outlines ship in this package:
// `sourceFor` picks them by what the sequence contains, and reads the package's own `data/` files.
import { compose, drawingSvg } from '@han-compose/composer'
import { sourceFor } from '@han-compose/composer/source'

const sequence = process.argv[2] ?? '𗀀'
const source = sourceFor(sequence, { bundled: true })
await source.ready()
const drawing = await compose(source, sequence)
process.stdout.write(drawingSvg(drawing) + '\n')
console.error(`${sequence}: ${drawing.parts?.length ?? 0} parts from the package's own outlines`)
