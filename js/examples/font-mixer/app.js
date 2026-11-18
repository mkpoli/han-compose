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
const shares = {}
const controls = new Map()
for (const style of FONT_STYLES) {
  shares[style] = 20
  const label = document.createElement('label'),
    output = document.createElement('output')
  const slider = document.createElement('input')
  slider.type = 'range'
  slider.id = style
  slider.min = '0'
  slider.max = '100'
  slider.value = '20'
  label.htmlFor = style
  label.textContent = names[style]
  output.htmlFor.add(style)
  controls.set(style, output)
  slider.addEventListener('input', () => {
    shares[style] = Number(slider.value)
    schedule()
  })
  get('faces').append(label, slider, output)
}
const position = mixPad(get('pad'), FONT_STYLES, names, (weights) => {
  FONT_STYLES.forEach((style, i) => {
    shares[style] = Math.round(weights[i] * 100)
    get(style).value = shares[style]
  })
  schedule()
})
let timer,
  revision = 0,
  svg = '',
  preview,
  controller
function schedule() {
  const current = ++revision
  const total = Object.values(shares).reduce((a, b) => a + b, 0)
  position(FONT_STYLES.map((style) => (total ? shares[style] / total : 0)))
  for (const [style, output] of controls)
    output.value = total ? Math.round((shares[style] * 100) / total) + '%' : '0%'
  get('weight-value').value = get('weight').value + '%'
  get('save').disabled = true
  controller?.abort()
  clearTimeout(timer)
  const sequence = get('ids').value.trim()
  if (!total || !sequence) {
    get('proof').replaceChildren()
    get('status').textContent = total ? 'Enter an ideographic description.' : 'Raise at least one face proportion.'
    return
  }
  get('status').textContent = 'Composing…'
  timer = setTimeout(async () => {
    controller = new AbortController()
    try {
      const drawn = await preview(sequence, {
        signal: controller.signal,
        mix: { shares: { ...shares }, weight: Number(get('weight').value) / 100 }
      })
      if (current !== revision) return
      svg = drawingSvg(drawn)
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
      get('proof').replaceChildren(document.importNode(doc.documentElement, true))
      get('save').disabled = false
      get('status').textContent = drawn.missing?.length ? 'Missing glyphs: ' + drawn.missing.join(' ') : ''
    } catch (error) {
      if (current !== revision) return
      get('proof').replaceChildren()
      get('status').textContent = error.message
    }
  }, 100)
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
