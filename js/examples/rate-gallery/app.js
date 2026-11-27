import { rateFormsFor, rateHosts } from '../../src/rate-forms.js'
import { rateDrawing } from '../../src/rate-drawing.js'
import sans from './data/originals-sans.json' with { type: 'json' }
import serif from './data/originals-serif.json' with { type: 'json' }
import regular from './data/originals-regular.json' with { type: 'json' }
import fangsong from './data/originals-fangsong.json' with { type: 'json' }
import pen from './data/originals-pen-writing.json' with { type: 'json' }
import plangothic from './data/plangothic.json' with { type: 'json' }

const faces = {
  sans: { label: '黑体', font: 'Noto Sans CJK JP', originals: sans },
  serif: { label: '宋体', font: 'Noto Serif CJK JP', originals: serif },
  regular: { label: '正楷', font: 'TW-Kai', originals: regular },
  fangsong: { label: '仿宋', font: '朱雀仿宋', originals: fangsong },
  'pen-writing': { label: '文楷', font: 'Kureedo', originals: pen }
}
const sources = [
  ['许可', '字体版权与许可', './licences/NOTICE.txt'],
  ['许可', 'Plangothic P1／P2', './licences/OFL-Plangothic.txt'],
  ['许可', '政府資料開放授權條款', './licences/OGL-1.0.txt'],
  ['字形区分', 'IRG UCV 30', 'https://www.unicode.org/irg/docs/n2978-Complete.pdf'],
  ['异体序列', 'Unicode IVD 2025-07-14', 'https://www.unicode.org/ivd/data/2025-07-14/IVD_Sequences.txt'],
  [
    '黑体',
    'Noto Sans CJK JP 2.004 · SIL OFL 1.1',
    'https://github.com/notofonts/noto-cjk/releases/tag/Sans2.004'
  ],
  [
    '宋体',
    'Noto Serif CJK 2.003 · SIL OFL 1.1',
    'https://github.com/notofonts/noto-cjk/releases/tag/Serif2.003'
  ],
  [
    '宋体补字',
    'WenJin Mincho 2.101 · SIL OFL 1.1',
    'https://github.com/takushun-wu/WenJinMincho/releases/tag/v2.101'
  ],
  [
    '正楷',
    'TW-Kai 11510.1、TW-Kai-Ext-B 11510.2 · 政府資料開放授權條款 1.0',
    'https://www.cns11643.gov.tw/opendata/Fonts_Kai.zip'
  ],
  ['仿宋', '朱雀仿宋 0.212 · SIL OFL 1.1', 'https://github.com/TrionesType/zhuque'],
  ['文楷', 'Kureedo Full 0.5.0 · SIL OFL 1.1'],
  [
    '参考字形',
    `Plangothic P1、P2 ${plangothic.release} · ${plangothic.license} · ${plangothic.copyright}`,
    plangothic.url
  ]
]
// Across the four serif specimens, contours shared by two forms are the strokes
// outside their distinguishing feature. The remaining contours label the axes.
const specimens = rateFormsFor('率').map(form => rateDrawing(form.text, 'serif').match(/M[^M]+/g))
function difference(form, other) {
  return specimens[form].filter(contour => !specimens[other].includes(contour)).join('')
}
const centres = [
  { ink: difference(0, 2), label: '中部笔形，第1行' },
  { ink: difference(2, 0), label: '中部笔形，第2行' }
]
const sides = [
  { ink: difference(0, 1), label: '两侧笔形，第1列' },
  { ink: difference(1, 0), label: '两侧笔形，第2列' }
]
const kinds = { native: '原字', supplement: '补字原字', reference: '参考字形' }
const themes = {
  '': [
    '跟随系统',
    '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor"/>'
  ],
  light: [
    '浅色',
    '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/>'
  ],
  dark: ['深色', '<path d="M13.5 9.5A5.5 5.5 0 1 1 6.5 2.5a4.5 4.5 0 0 0 7 7z"/>']
}

const SVG = 'http://www.w3.org/2000/svg'
const get = (id) => document.getElementById(id)
const node = (tag, text, props) =>
  Object.assign(document.createElement(tag), { textContent: text ?? '' }, props)
const code = (char) => 'U+' + char.codePointAt(0).toString(16).toUpperCase()
const selectorName = (char) => {
  const cp = char.codePointAt(0)
  return cp >= 0xe0100 && cp <= 0xe01ef
    ? 'VS' + (cp - 0xe0100 + 17)
    : cp >= 0xfe00 && cp <= 0xfe0f
      ? 'VS' + (cp - 0xfe00 + 1)
      : ''
}

function glyph(d, label) {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 1000 1000')
  if (label) {
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', label)
  } else svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS(SVG, 'path')
  path.setAttribute('d', d)
  svg.append(path)
  return svg
}

function sample(axis, index) {
  const item = (axis === 'centre' ? centres : sides)[index]
  const svg = glyph(item.ink, item.label)
  svg.setAttribute('viewBox', axis === 'centre' ? '262 160 480 480' : '32 170 920 480')
  svg.setAttribute('class', 'axis-sample')
  return svg
}

function figure(kind, source, samples, d, label) {
  const fig = node('figure', '', { className: kind })
  const caption = node('figcaption')
  caption.append(node('b', kinds[kind] ?? kind), node('span', source))
  if (samples.length) {
    const line = node('span', '', { className: 'reference-axes' })
    line.append(...samples)
    caption.append(line)
  }
  fig.append(d ? glyph(d, label) : node('div', '无原字', { className: 'missing' }), caption)
  return fig
}

function part(d, char) {
  const svg = glyph(d, char)
  svg.setAttribute('class', 'part')
  return svg
}

const operators = {
  '⿰': 'M8 2v12',
  '⿱': 'M2 8h12',
  '⿲': 'M6 2v12M10 2v12',
  '⿺': 'M6 2v8h8'
}

/** The plain-text reading of an IDS, with each invisible variation selector named. */
const readable = (text) => Array.from(text, (char) => selectorName(char) || char).join('')

/**
 * The IDS as nodes: operators and the components system fonts lack are drawn,
 * and each variation selector is named beside its base.
 */
function spelled(text) {
  return Array.from(text, (char) => {
    const name = selectorName(char)
    if (name) return node('sup', name)
    const drawn = plangothic.components[char]
    if (drawn) return part(drawn.d, char)
    if (!operators[char]) return char
    const icon = glyph('M2 2h12v12H2z' + operators[char], char)
    icon.setAttribute('viewBox', '0 0 16 16')
    icon.setAttribute('class', 'operator')
    return icon
  })
}

const params = new URLSearchParams(location.search)
const state = {
  q: params.get('q') ?? '',
  family: params.get('family') ?? '',
  face: Object.hasOwn(faces, params.get('face')) ? params.get('face') : 'serif',
  matrix: params.get('view') === 'matrix'
}
/** @type {Map<string, number>} */
const chosen = new Map()

function writeUrl() {
  const face = state.face === 'serif' ? '' : state.face
  for (const [key, value] of [
    ['q', state.q],
    ['face', face],
    ['view', state.matrix ? 'matrix' : '']
  ]) {
    if (value) params.set(key, value)
    else params.delete(key)
  }
  history.replaceState(null, '', location.pathname + (params.size ? '?' + params : ''))
}

let toastTimer
function announce(text) {
  const status = get('status')
  status.textContent = text
  status.classList.add('shown')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => status.classList.remove('shown'), 1800)
}

async function copy(text, done) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = node('textarea', '', { value: text })
    area.style.cssText = 'position:fixed;opacity:0'
    document.body.append(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    if (!ok) return announce('无法复制')
  }
  announce(done)
}

/** Hosts named in the query as characters, code points, or one of their spellings. */
function matches(query) {
  const text = query.trim()
  if (!text) return rateHosts
  const wanted = new Set(rateFormsFor(text).map((form) => form.host))
  for (const char of text) wanted.add(char)
  for (const [, hex] of text.matchAll(/(?:U\+|\b)([0-9a-f]{4,6})\b/gi))
    wanted.add(String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff)))
  return rateHosts.filter((host) => wanted.has(host))
}

function card(host) {
  const face = faces[state.face]
  const forms = rateFormsFor(host)
  const drawings = forms.map((form) => rateDrawing(form.text, state.face))
  const art = node('article')
  const title = node('h2')
  const ids = node('output')
  const buttons = []

  function select(index) {
    chosen.set(host, index)
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)))
    const around = node('span', '', { className: 'host' })
    around.append(...spelled(structure(host)))
    title.replaceChildren(glyph(drawings[index] ?? '', host), node('small', code(host)), around)
    ids.replaceChildren(...spelled(forms[index].text))
    ids.setAttribute('aria-label', readable(forms[index].text))
  }

  const originals = node('div', '', { className: 'originals' })
  const own = face.originals[host] ?? []
  for (const item of own) {
    const samples = []
    if (item.centre === 'cn' || item.centre === 'jp') samples.push(sample('centre', Number(item.centre === 'jp')))
    if (item.dots === 'chevron' || item.dots === 'strokes') samples.push(sample('sides', Number(item.dots === 'strokes')))
    originals.append(figure(item.kind, item.source, samples, item.d, host + ' · ' + item.source))
  }
  const reference = plangothic.glyphs[host]
  if (reference) {
    const name = `${plangothic.name} ${reference.font} ${plangothic.release}`
    originals.append(figure('reference', name, [], reference.d, host + ' · ' + name))
  }
  if (!own.length && !reference) originals.append(figure('native', face.font, [], null))

  const table = node('table', '', { className: 'matrix' })
  table.setAttribute('aria-label', host + ' · 幺形与两侧笔形')
  const head = table.createTHead().insertRow()
  head.append(node('td'))
  sides.forEach((_, c) => {
    const heading = node('th', '', { scope: 'col' })
    heading.append(sample('sides', c))
    head.append(heading)
  })
  const body = table.createTBody()
  centres.forEach((_, r) => {
    const row = body.insertRow()
    const heading = node('th', '', { scope: 'row' })
    heading.append(sample('centre', r))
    row.append(heading)
    sides.forEach((_, c) => {
      const index = r * sides.length + c
      const form = forms[index]
      const label = readable(form.text)
      const button = node('button', '', { type: 'button', className: 'cell', title: label })
      button.setAttribute('aria-label', label)
      button.append(
        drawings[index] ? glyph(drawings[index]) : node('div', '无字形', { className: 'missing' })
      )
      button.onclick = () => {
        select(index)
        copy(form.text, '已复制 ' + readable(form.text))
      }
      buttons.push(button)
      row.insertCell().append(button)
    })
  })
  const box = node('div', '', { className: 'matrix-box' })
  const line = node('div', '', { className: 'ids' })
  const again = node('button', '复制', { type: 'button', className: 'btn small' })
  again.setAttribute('aria-label', '复制' + host + '的 IDS')
  again.onclick = () => {
    const form = forms[chosen.get(host) ?? 0]
    copy(form.text, '已复制 ' + readable(form.text))
  }
  line.append(ids, again)
  box.append(table, line)

  const pair = node('div', '', { className: 'pair' })
  pair.append(originals, box)
  art.append(title, pair)
  select(chosen.get(host) ?? 0)
  return art
}

/** The host's structure around 率, e.g. ⿰扌率; empty for 率 itself. */
function structure(host) {
  const text = [...rateFormsFor(host)[2].text].filter((char) => !selectorName(char)).join('')
  return text === host ? '' : text
}

function show() {
  const grid = get('grid')
  const hosts = state.family && state.family !== '30' ? [] : matches(state.q)
  grid.replaceChildren(...hosts.map(card))
  if (!hosts.length) grid.append(node('p', '没有符合条件的字形。'))
  get('total').textContent = hosts.length + '／' + rateHosts.length + ' 字'
}

function paintTheme() {
  const button = get('theme')
  const [name, icon] = themes[document.documentElement.dataset.theme ?? '']
  button.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true">' + icon + '</svg>'
  button.title = '配色：' + name
  button.setAttribute('aria-label', button.title)
}
get('theme').onclick = () => {
  const order = Object.keys(themes)
  const next = order[(order.indexOf(document.documentElement.dataset.theme ?? '') + 1) % order.length]
  try {
    if (next) localStorage.setItem('rate-gallery-theme', next)
    else localStorage.removeItem('rate-gallery-theme')
  } catch {}
  if (next) document.documentElement.dataset.theme = next
  else delete document.documentElement.dataset.theme
  paintTheme()
}
paintTheme()

for (const [id, { label }] of Object.entries(faces)) {
  const radio = node('input', '', { type: 'radio', name: 'face', value: id, checked: id === state.face })
  radio.onchange = () => {
    state.face = id
    writeUrl()
    show()
  }
  const option = node('label', label)
  option.prepend(radio)
  get('faces').querySelector('.segments').append(option)
}

const query = get('query')
query.value = state.q
query.oninput = () => {
  state.q = query.value
  writeUrl()
  show()
}

const matrixOnly = get('matrix-only')
function paintView() {
  matrixOnly.setAttribute('aria-checked', String(state.matrix))
  document.documentElement.classList.toggle('matrix-only', state.matrix)
}
matrixOnly.onclick = () => {
  state.matrix = !state.matrix
  paintView()
  writeUrl()
}
paintView()

get('share').onclick = () => copy(location.href, '已复制链接')
get('about').onclick = () => get('sources').showModal()
for (const [role, name, url] of sources) {
  const value = node('dd')
  value.append(url ? node('a', name, { href: url, rel: 'noopener' }) : name)
  get('source-list').append(node('dt', role), value)
}

show()
