// A persistent worker keeps the export cache across changes of character and shape.
import { mixDrawings } from '../../src/mix-drawings.js'
import { compose } from '../../src/loader.js'
import { exportSource, sourceFor } from '../../src/source.js'
import exports from '../font-mixer/exports.json' with { type: 'json' }

const base = new URL(process.env.YAO_SERIF_EXPORT || exports.serif, self.location.href).href
const read = path => fetch('./data/' + path)
const exported = exportSource(base, {read})
self.onmessage = async ({data: {id, text, outline, weight}}) => {
  try {
    const drawing = outline ? {d: outline, approximate: []} : await compose(
      sourceFor(text, {exported, read, fontStyle: 'serif'}), text, {fontStyle: 'serif'})
    const {d, approximate} = weight === 1 ? drawing : mixDrawings([drawing], [1], weight)
    self.postMessage({id, d, approximate})
  } catch {
    self.postMessage({id, d: null})
  }
}
