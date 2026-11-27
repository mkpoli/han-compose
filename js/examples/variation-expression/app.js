import { createVariationRegistry } from '../../src/variation-registry.js'
import { createVariationProduct } from '../../src/variation-product.js'
import { expandedVariation, realizeVariation } from '../../src/variation-expression.js'
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
function glyph(outline) {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', outline.viewBox)
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS(ns, 'path')
  path.setAttribute('d', outline.d)
  svg.append(path)
  return svg
}
const native = originals['𦈁'][0]
$('original').append(glyph({ ...native, viewBox: '0 0 1000 1000' }))
$('font-source').href = native.url
const operators = { '⿰': '左右', '⿱': '上下', '⿳': '上中下', '⿴': '全包圍' }
const code = cp => 'U+' + cp.toString(16).toUpperCase()
const analysis = el('p')
analysis.className = 'analysis'
for (const char of expandedVariation(expression)) {
  const cp = char.codePointAt(0)
  if (operators[char] || char === '幺' || cp > 0xffff) {
    const token = el(char === '幺' ? 'mark' : 'abbr', char)
    token.title = [operators[char], code(cp)].filter(Boolean).join(' · ')
    analysis.append(token)
  } else analysis.append(char)
}
$('font-source').after(analysis)

for (const [label, href] of [
  ['BabelStone IDS · 2025-06-27', sources['BabelStone IDS 2025-06-27'].url],
  ['Unicode IVD · 2026-08-03', sources.ivd.url],
  ...forms.map((form, i) => ['GlyphWiki · 字形 ' + (i + 1), form.sources[0].url]),
  ['GlyphWiki資料授權', sources.glyphwiki.license],
  ['文津宋體字形授權', './NOTICE.txt'],
]) {
  const link = el('a', label)
  link.href = href
  const item = el('li')
  item.append(link)
  $('sources').append(item)
}

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
for (let row = 0; row < n; row++) {
  const tr = body.insertRow()
  tr.append(axisHeader('row', row))
  for (let col = 0; col < n; col++) {
    const button = el('button')
    button.type = 'button'
    button.setAttribute('aria-label', `糸中的幺：字形${row + 1}，率中的幺：字形${col + 1}`)
    button.append(glyph(forms[row].outline), glyph(forms[col].outline))
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
  $('left').replaceChildren(glyph(forms[row].outline))
  $('right').replaceChildren(glyph(forms[col].outline))
  $('left-path').textContent = '[' + sites[0].path.join(', ') + ']'
  $('right-path').textContent = '[' + sites[1].path.join(', ') + ']'
  $('position').textContent = (index + 1) + ' / ' + product.count
  $('ids').value = realizeVariation(product.at(BigInt(index)), registry)
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
select(0, 1)
