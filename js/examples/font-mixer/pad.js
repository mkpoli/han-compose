import { pointAt, vertices, weightsAt } from './pentagon.js'

// Drag inside the pentagon to set the five shares; `route` traces a run of mixes across it.
export function mixPad(container, styles, names, change) {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', '-150 -112 300 214')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', `${styles.length}-face mix position`)
  function element(tag, attrs) {
    const el = document.createElementNS(ns, tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    svg.append(el)
    return el
  }
  element('polygon', {
    points: vertices.map((p) => p.join(',')).join(' '),
    fill: 'var(--ui-color-surface)',
    stroke: 'var(--ui-color-control-border)'
  })
  vertices.forEach(([x, y]) => {
    element('line', {
      x1: 0,
      y1: 0,
      x2: x,
      y2: y,
      stroke: 'var(--ui-color-border)'
    })
  })
  const route = element('polyline', {
    fill: 'none',
    stroke: 'var(--ui-color-accent)',
    'stroke-width': 1.5,
    'stroke-linejoin': 'round',
    opacity: 0.45
  })
  const labels = vertices.map(([x, y], i) => {
    element('circle', {
      cx: x,
      cy: y,
      r: 3,
      fill: 'var(--ui-color-ink-muted)'
    })
    const label = element('text', {
      x: x * 1.12,
      y: y * 1.12 + (y < -80 ? -4 : y > 0 ? 14 : 4),
      'text-anchor': Math.abs(x) < 1 || y > 0 ? 'middle' : x > 0 ? 'start' : 'end',
      fill: 'currentColor',
      'font-size': 11
    })
    label.textContent = names[styles[i]]
    return label
  })
  const cursor = element('circle', {
    r: 7,
    fill: 'var(--ui-color-accent)',
    stroke: 'var(--ui-color-surface)',
    'stroke-width': 2.5
  })
  function move(event) {
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse())
    change(weightsAt([point.x, point.y]))
  }
  svg.onpointerdown = (event) => {
    if (!event.isPrimary || event.button !== 0) return
    event.preventDefault()
    svg.setPointerCapture(event.pointerId)
    move(event)
  }
  svg.onpointermove = (event) => {
    if (svg.hasPointerCapture(event.pointerId)) move(event)
  }
  container.append(svg)
  return {
    position(weights) {
      const [x, y] = pointAt(weights)
      cursor.setAttribute('cx', x)
      cursor.setAttribute('cy', y)
      labels.forEach((label, i) => label.setAttribute('font-weight', weights[i] > 0.5 ? 650 : 400))
    },
    // Draw the path a run of mixes takes across the pad; an empty run clears it.
    route(mixes) {
      route.setAttribute('points', mixes.map((weights) => pointAt(weights).join(',')).join(' '))
    }
  }
}
