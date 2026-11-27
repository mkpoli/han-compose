import { createVariationRegistry } from '../../src/variation-registry.js'
import { createVariationProduct } from '../../src/variation-product.js'
import { expandedVariation, realizeVariation } from '../../src/variation-expression.js'
import { renderU26201 } from '../../src/render-u26201.js'
import { yaoCharacters, yaoDecomposition, yaoOccurrences, selectYao } from '../../src/yao-occurrences.js'
import { isNode, parseDescription } from '../../src/tree.js'
import originals from '../rate-gallery/data/originals-serif.json' with { type: 'json' }
import { expression, family, sites, sources } from './u26201.js'

const registry = createVariationRegistry([family])
const product = createVariationProduct(registry, expression, sites)
const forms = family.forms
const n = forms.length
const $ = id => document.getElementById(id)
const el = (name, text) => {
  const element = document.createElement(name)
  if (text !== undefined) element.textContent = text
  return element
}
function glyph(outline, label) {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', outline.viewBox)
  if (label) {
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', label)
  } else svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS(ns, 'path')
  path.setAttribute('d', outline.d)
  svg.append(path)
  return svg
}
const native = originals['𦈁'][0]
$('original').append(glyph({ ...native, viewBox: '0 0 1000 1000' }, '文津宋體的𦈁'))
$('font-source').href = native.url
const operators = { '⿰': '左右', '⿱': '上下', '⿳': '上中下', '⿴': '全包圍' }
const code = cp => 'U+' + cp.toString(16).toUpperCase()
const analysis = el('p')
analysis.className = 'analysis'
function showAnalysis(text) {
  analysis.replaceChildren()
  for (const char of text) {
    const cp = char.codePointAt(0)
    if (operators[char] || char === '幺' || cp > 0xffff) {
      const token = el(char === '幺' ? 'mark' : 'abbr', char)
      token.title = [operators[char], code(cp)].filter(Boolean).join(' · ')
      analysis.append(token)
    } else analysis.append(char)
  }
}
$('original').closest('section').append(analysis)

for (const [label, href] of [
  ['BabelStone IDS · 2025-06-27', sources['BabelStone IDS 2025-06-27'].url],
  ['Unicode IVD · 2026-08-03', sources.ivd.url],
  ...family.related.map(ref => ['關聯準則 · ' + ref.name + ' #' + ref.id + '（' + [...ref.components].join('／') + '）', ref.url]),
  ['BabelStone Han PUA · Arphic授權', './data/licences/Arphic-Public-License.txt'],
  ['GlyphWiki資料授權', sources.glyphwiki.license],
  ['Yi Bai IDS · MIT', './data/licences/yi-bai-ids-MIT.txt'],
  ['字型授權', './NOTICE.txt'],
]) {
  const link = el('a', label)
  link.href = href
  const item = el('li')
  item.append(link)
  $('sources').append(item)
}

for (const [index, form] of forms.entries()) {
  const group = el('div')
  group.className = 'mapping'
  const list = el('ul')
  for (const ref of form.sources) {
    const label = ref.name === 'IVD' ? [ref.name, ref.sequence, ref.collection, ref.identifier] :
      [ref.name, ref.face, ref.regions?.join('/') ?? ref.region, ref.glyph]
    const link = el('a', label.filter(Boolean).join(' · '))
    link.href = ref.url
    const item = el('li')
    item.append(link)
    list.append(item)
  }
  group.append(glyph(form.outline, '字形' + (index + 1)), list)
  $('mappings').append(group)
}

$('dimensions').textContent = n + ' × ' + n
const table = $('matrix')
const head = table.createTHead().insertRow()
const corner = el('th')
corner.append('率 →', el('br'), '糸 ↓')
head.append(corner)
function axisHeader(axis, i) {
  const cell = el('th')
  cell.scope = axis
  cell.setAttribute('aria-label', (axis === 'col' ? '率' : '糸') + '中的幺，字形' + (i + 1))
  cell.append(glyph(forms[i].outline))
  return cell
}
for (let i = 0; i < n; i++) head.append(axisHeader('col', i))
const body = table.createTBody()
const buttons = []
const designs = []
for (let row = 0; row < n; row++) {
  const tr = body.insertRow()
  tr.append(axisHeader('row', row))
  for (let col = 0; col < n; col++) {
    const button = el('button')
    button.type = 'button'
    button.setAttribute('aria-label', `糸中的幺：字形${row + 1}，率中的幺：字形${col + 1}`)
    const design = renderU26201(forms[row], forms[col])
    designs.push(design)
    button.append(glyph(design))
    button.onclick = () => select(row, col)
    button.onkeydown = event => {
      const offsets = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }
      const offset = offsets[event.key]
      if (!offset) return
      event.preventDefault()
      const r = Math.max(0, Math.min(n - 1, row + offset[0]))
      const c = Math.max(0, Math.min(n - 1, col + offset[1]))
      select(r, c)
      buttons[r * n + c].focus()
    }
    buttons.push(button)
    tr.insertCell().append(button)
  }
}

function select(row, col) {
  const index = row * n + col
  for (const [i, button] of buttons.entries()) {
    button.tabIndex = i === index ? 0 : -1
    button.setAttribute('aria-pressed', String(i === index))
  }
  for (let i = 0; i < n; i++) {
    head.cells[i + 1].classList.toggle('selected', i === col)
    body.rows[i].cells[0].classList.toggle('selected', i === row)
  }
  currentDesign = designs[index]
  if ($('weight').value === '1') {
    requests.delete($('selected-glyph'))
    $('selected-glyph').replaceChildren(glyph(currentDesign, '𦈁，' + buttons[index].getAttribute('aria-label')))
  } else preview('𦈁', $('selected-glyph'), currentDesign.d)
  $('left').replaceChildren(glyph(forms[row].outline))
  $('right').replaceChildren(glyph(forms[col].outline))
  $('left-path').textContent = '[' + sites[0].path.join(', ') + ']'
  $('right-path').textContent = '[' + sites[1].path.join(', ') + ']'
  $('position').textContent = (index + 1) + ' / ' + product.count
  displayIds(realizeVariation(product.at(BigInt(index)), registry))
}
function displayIds(text) {
  $('ids').value = text
  const notation = []
  for (const char of new Set($('ids').value)) {
    const cp = char.codePointAt(0)
    if (!operators[char] && cp <= 0xffff) continue
    const vs = cp >= 0xe0100 && cp <= 0xe01ef
    const term = vs ? 'VS' + (cp - 0xe0100 + 17) : char
    const row = el('li')
    row.append(el('span', term), el('code', code(cp)), el('span', operators[char] ?? ''))
    notation.push(row)
  }
  $('notation').replaceChildren(...notation)
  $('copy').textContent = '複製'
  $('status').textContent = ''
}

$('copy').onclick = async () => {
  const field = $('ids')
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(field.value)
    else {
      field.focus()
      field.select()
      if (!document.execCommand('copy')) throw Error('manual copy')
    }
    $('copy').textContent = '已複製'
    $('status').textContent = '已複製IDS'
  } catch {
    field.focus()
    field.select()
    $('status').textContent = '已選取IDS'
    $('copy').textContent = '已選取'
  }
}
$('theme').onclick = () => {
  const current = document.documentElement.style.colorScheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  document.documentElement.style.colorScheme = current === 'dark' ? 'light' : 'dark'
}
let currentDesign
let host = ''
let selected = ''
const edits = new Map()
let worker
const requests = new Map()
let serial = 0
function preview(text, target, outline) {
  const id = ++serial
  requests.set(target, id)
  target.textContent = '繪製中…'
  try {
    if (!worker) {
      worker = new Worker('./preview.js', {type: 'module'})
      worker.onmessage = ({data}) => {
        for (const [panel, latest] of requests) {
          if (data.id !== latest) continue
          requests.delete(panel)
          if (data.d) {
            panel.replaceChildren(glyph({viewBox: '0 0 1000 1000', d: data.d}, panel === $('original') ? host : selected))
            if (data.approximate?.length) panel.append(el('small', '近似字形'))
          } else panel.textContent = '無法繪製'
        }
      }
      worker.onerror = () => {
        for (const panel of requests.keys()) panel.textContent = '無法載入字形'
        requests.clear()
        worker.terminate()
        worker = undefined
      }
    }
    const weight = target === $('selected-glyph') ? Number($('weight').value) : 1
    worker.postMessage({id, text, outline, weight})
  } catch {
    target.textContent = '無法載入字形'
    requests.delete(target)
  }
}

const positions = {'⿰': '左右', '⿲': '左中右', '⿱': '上下', '⿳': '上中下', '⿴': '外內'}
function locationOf(path) {
  if (!path.length) return '整字'
  const labels = []
  let node = parseDescription(host)
  for (const index of path) {
    if (!isNode(node)) {
      const record = yaoDecomposition(node)
      if (!record) break
      node = parseDescription(record.ids)
    }
    if (!isNode(node)) break
    const prefix = positions[node.op]?.[index] ?? ('部件' + (index + 1))
    node = node.parts[index]
    labels.push(prefix + (typeof node === 'string' && [...node].length === 1 ? ' ' + node : ''))
  }
  return labels.join(' › ')
}
function switches() {
  const sites = yaoOccurrences(selected)
  const panel = $('occurrences')
  panel.replaceChildren()
  $('dimensions').textContent = sites.length + '處'
  if (!sites.length) panel.append(el('p', '未找到幺部件'))
  for (const [i, site] of sites.entries()) {
    const row = el('fieldset')
    row.className = 'site-row'
    row.append(el('legend', '幺 ' + (i + 1) + '　' + locationOf(site.path)))
    const choices = el('div')
    choices.className = 'choices'
    for (const form of [null, ...forms]) {
      const button = el('button')
      button.type = 'button'
      if (form) {
        button.setAttribute('aria-label', '字形' + (forms.indexOf(form) + 1))
        button.append(glyph(form.outline))
      } else button.textContent = '原形'
      button.setAttribute('aria-pressed', String(site.form === (form?.id ?? null)))
      button.onclick = () => {
        const id = form?.id ?? null
        if (id === site.form) edits.delete(i)
        else edits.set(i, id)
        selected = host
        for (const [index, choice] of edits) selected = selectYao(selected, sites[index].path, choice)
        for (const child of choices.children) child.setAttribute('aria-pressed', String(child === button))
        showSelection()
      }
      choices.append(button)
    }
    row.append(choices)
    panel.append(row)
  }
}

function showSelection() {
  displayIds(selected)
  showAnalysis(selected)
  preview(selected, $('selected-glyph'))
}

function openHost(text) {
  const cp = /^U\+([0-9A-F]{1,6})$/iu.exec(text.trim())
  host = cp && parseInt(cp[1], 16) <= 0x10ffff ? String.fromCodePoint(parseInt(cp[1], 16)) : text.trim()
  if (!host) return
  if (location.protocol.startsWith('http')) {
    const url = new URL(location.href)
    if (host === '𦈁') url.searchParams.delete('char')
    else url.searchParams.set('char', host)
    history.replaceState(null, '', url)
  }
  let savedWeight
  try { savedWeight = localStorage.getItem('yao-weight/' + host) } catch {}
  $('weight').value = ['0.85', '1.15'].includes(savedWeight) ? savedWeight : '1'
  selected = host
  requests.clear()
  edits.clear()
  $('host').value = host
  const matrix = host === '𦈁'
  const scalar = [...host].length === 1
  $('character-code').textContent = scalar ? code(host.codePointAt(0)) : 'IDS'
  $('matrix-title').textContent = matrix ? '兩處幺的組合' : '部件字形'
  $('selection-heading').textContent = matrix ? '所選部件' : '所選組合'
  $('original-heading').textContent = scalar ? '原字' : '輸入字形'
  $('matrix').parentElement.hidden = !matrix
  $('occurrences').hidden = matrix
  document.querySelector('.pair').hidden = !matrix
  $('position').hidden = !matrix
  $('style-label').textContent = matrix ? '文津宋體' : '宋體'
  $('font-source').hidden = !matrix
  if (matrix) {
    $('original').replaceChildren(glyph({...native, viewBox:'0 0 1000 1000'}, '文津宋體的𦈁'))
    $('dimensions').textContent = n + ' × ' + n
    showAnalysis(expandedVariation(expression))
    select(0, 1)
  } else {
    switches()
    preview(host, $('original'))
    showSelection()
  }
}

$('weight').onchange = () => {
  try {
    if ($('weight').value === '1') localStorage.removeItem('yao-weight/' + host)
    else localStorage.setItem('yao-weight/' + host, $('weight').value)
  } catch {}
  if (host === '𦈁') select(Math.floor(designs.indexOf(currentDesign) / n), designs.indexOf(currentDesign) % n)
  else preview(selected, $('selected-glyph'))
}

const hostInput = $('host')
const suggestions = $('suggestions')
function suggest() {
  const query = hostInput.value.trim().toUpperCase()
  const matches = query ? yaoCharacters.filter(char => char === query || code(char.codePointAt(0)).startsWith(query)) : yaoCharacters
  suggestions.replaceChildren(...matches.slice(0, 60).map(char => new Option(code(char.codePointAt(0)), char)))
}
hostInput.addEventListener('input', suggest)
$('host-form').onsubmit = event => { event.preventDefault(); openHost(hostInput.value) }
for (const [id, delta] of [['previous', -1], ['next', 1]]) {
  $(id).onclick = () => {
    const i = yaoCharacters.indexOf(host)
    const start = i >= 0 ? i : delta > 0 ? -1 : 0
    const next = (start + delta + yaoCharacters.length) % yaoCharacters.length
    openHost(yaoCharacters[next])
  }
}
openHost(new URL(location.href).searchParams.get('char') || '𦈁')
suggest()
