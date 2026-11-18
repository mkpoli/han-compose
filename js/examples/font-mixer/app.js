import { mixPad } from './pad.js'
import { composerPreview, FONT_STYLES, drawingSvg } from '../../src/index.js'

const get = (id) => document.getElementById(id)
const names = {
  sans: 'Sans',
  serif: 'Serif',
  fangsong: 'Fangsong',
  regular: 'Regular Kai',
  'pen-writing': 'Wen Kai'
}
const shares = Object.fromEntries(FONT_STYLES.map((style) => [style, 20]))
const controls = new Map()
for (const style of FONT_STYLES) {
  const label = document.createElement('label'),
    slider = document.createElement('input'),
    output = document.createElement('output')
  slider.type = 'range'
  slider.className = 'ui-range'
  Object.assign(slider, { id: style, min: '0', max: '100', step: '0.1', value: '20' })
  label.htmlFor = style
  label.textContent = names[style]
  output.htmlFor.add(style)
  controls.set(style, { slider, output })
  slider.addEventListener('input', () => {
    const value = slider.valueAsNumber
    const others = FONT_STYLES.filter((face) => face !== style)
    const total = others.reduce((n, face) => n + shares[face], 0)
    for (const face of others)
      shares[face] = (100 - value) * (total > 0 ? shares[face] / total : 1 / others.length)
    shares[style] = value
    schedule()
  })
  get('faces').append(label, slider, output)
}
const position = mixPad(get('pad'), FONT_STYLES, names, (weights) => {
  FONT_STYLES.forEach((style, i) => {
    shares[style] = weights[i] * 100
  })
  schedule()
})
const examples = [
  ['⿰木口', '⿰木口'],
  ['岩', '⿱山石'],
  ['困', '⿴囗木'],
  ['⿲木火木', '⿲木火木'],
  ['淼', '⿱水⿰水水'],
  ['清', '⿰氵青'],
  ['明', '⿰日月'],
  ['好', '⿰女子'],
  ['詩', '⿰言寺'],
  ['雷', '⿱雨田'],
  ['草', '⿱艹早'],
  ['愁', '⿱秋心'],
  ['問', '⿵門口'],
  ['國', '⿴囗或'],
  ['床', '⿸广木'],
  ['道', '⿺辶首'],
  ['品', '⿱口⿰口口'],
  ['棵', '⿰木果']
]
for (const [label, sequence] of examples) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'ui-button'
  button.dataset.size = 'sm'
  button.textContent = label
  button.title = sequence
  button.dataset.sequence = sequence
  button.onclick = () => {
    get('ids').value = sequence
    schedule()
  }
  get('examples').append(button)
}

let preview,
  svg = '',
  frame = 0,
  pending = null,
  running = null,
  revision = 0,
  visibleSequence = ''
function syncRange(slider, output, percentage) {
  const label = Math.round(percentage * 10) / 10 + '%'
  slider.style.setProperty(
    '--fill',
    ((slider.valueAsNumber - Number(slider.min)) / (Number(slider.max) - Number(slider.min))) * 100 + '%'
  )
  slider.setAttribute('aria-valuetext', label)
  output.value = label
}
function schedule() {
  const sequence = get('ids').value.trim()
  const version = ++revision
  const weight = get('weight').valueAsNumber
  position(FONT_STYLES.map((style) => shares[style] / 100))
  for (const [style, { slider, output }] of controls) {
    slider.value = shares[style]
    syncRange(slider, output, shares[style])
  }
  syncRange(get('weight'), get('weight-value'), weight)
  for (const button of get('examples').children)
    button.setAttribute('aria-pressed', String(button.dataset.sequence === sequence))
  get('save').disabled = true
  pending = sequence ? { sequence, version, mix: { shares: { ...shares }, weight: weight / 100 } } : null
  if (running && running.sequence !== sequence) running.controller.abort()
  if (sequence !== visibleSequence) {
    get('proof').replaceChildren()
    get('status').textContent = sequence ? 'Composing…' : 'Enter an ideographic description.'
    visibleSequence = ''
  }
  if (!sequence) get('status').textContent = 'Enter an ideographic description.'
  if (!frame && !running && pending && preview) frame = requestAnimationFrame(render)
}
// While a mix is in flight, retain just the most recent pointer position. Show each
// finished drawing of the active IDS and render the latest position on the next frame.
async function render() {
  frame = 0
  const request = pending
  pending = null
  if (!request) return
  const controller = new AbortController()
  running = { sequence: request.sequence, controller }
  try {
    const drawn = await preview(request.sequence, { signal: controller.signal, mix: request.mix })
    if (controller.signal.aborted) return
    svg = drawingSvg(drawn)
    const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement
    get('proof').replaceChildren(document.importNode(root, true))
    visibleSequence = request.sequence
    get('status').textContent = drawn.missing?.length ? 'Missing glyphs: ' + drawn.missing.join(' ') : ''
    get('save').disabled = request.version !== revision
  } catch (error) {
    if (!controller.signal.aborted && request.version === revision) {
      get('proof').replaceChildren()
      visibleSequence = ''
      get('status').textContent = error.message
    }
  } finally {
    running = null
    if (pending && !frame) frame = requestAnimationFrame(render)
  }
}
get('save').onclick = () => {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  const a = document.createElement('a')
  a.download = 'han-compose-mix.svg'
  a.href = url
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
try {
  const faceBases = await (await fetch('./exports.json')).json()
  for (const style of FONT_STYLES) faceBases[style] = new URL(faceBases[style], location.href).href
  preview = composerPreview({
    base: faceBases.sans,
    faceBases,
    separate: true,
    worker: () => new Worker('./src/worker.js', { type: 'module' })
  })
  get('weight').oninput = get('ids').oninput = schedule
  schedule()
} catch (error) {
  get('status').textContent = error.message
}
