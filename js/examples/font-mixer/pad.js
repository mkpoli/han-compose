// Each triangle of the pentagon blends its adjacent poles with the equal mix at the centre.
export function mixPad(container, styles, names, change) {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', '-143 -112 286 224')
  svg.setAttribute('aria-label', 'Five-face mix position')
  const vertices = styles.map((_, i) => {
    const angle = ((i * 2) / 5 - 0.5) * Math.PI
    return [Math.cos(angle) * 76, Math.sin(angle) * 76]
  })
  function element(tag, attrs) {
    const el = document.createElementNS(ns, tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    svg.append(el)
    return el
  }
  element('polygon', { points: vertices.map((p) => p.join(',')).join(' '), fill: '#eeeef9', stroke: '#9b9fc3' })
  vertices.forEach(([x, y], i) => {
    element('line', { x1: 0, y1: 0, x2: x, y2: y, stroke: '#d0d2e7' })
    element('circle', { cx: x, cy: y, r: 3, fill: '#525796' })
    const label = element('text', {
      x: x * 1.27,
      y: y * 1.26 + 4,
      'text-anchor': 'middle',
      fill: 'currentColor',
      'font-size': 15
    })
    label.textContent = names[styles[i]]
  })
  const cursor = element('circle', { r: 6, fill: '#3e44ba', stroke: 'white', 'stroke-width': 2 })
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0]
  function move(event) {
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse())
    for (let i = 0; i < 5; i++) {
      const j = (i + 1) % 5,
        a = vertices[i],
        b = vertices[j],
        p = [point.x, point.y],
        area = cross(a, b)
      let u = cross(p, b) / area,
        v = cross(a, p) / area
      if (u < -1e-7 || v < -1e-7) continue
      u = Math.max(u, 0)
      v = Math.max(v, 0)
      const sum = Math.max(1, u + v)
      const weights = Array(5).fill(Math.max(0, 1 - u - v) / 5)
      weights[i] += u / sum
      weights[j] += v / sum
      change(weights)
      break
    }
  }
  svg.onpointerdown = (event) => {
    svg.setPointerCapture(event.pointerId)
    move(event)
  }
  svg.onpointermove = (event) => {
    if (svg.hasPointerCapture(event.pointerId)) move(event)
  }
  container.append(svg)
  return (weights) => {
    cursor.setAttribute(
      'cx',
      vertices.reduce((v, p, i) => v + weights[i] * p[0], 0)
    )
    cursor.setAttribute(
      'cy',
      vertices.reduce((v, p, i) => v + weights[i] * p[1], 0)
    )
  }
}
