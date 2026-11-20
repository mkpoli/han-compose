// The tour visits every face along the pad's edges, crosses it along the diagonals,
// then wanders through the interior. Each phase starts and ends on the first face, so
// the tour loops and any phase can be entered on its own.
import { radius, vertices, weightsAt } from './pentagon.js'

export const fps = 30
const hold = 0.45

const ease = (t) => (1 - Math.cos(Math.PI * t)) / 2
const smooth = (t) => t * t * (3 - 2 * t)

// A closed seven-lobed curve inside the pad, entered from and left to the first face.
function wander(styles, t) {
  const turn = 2 * Math.PI
  const reach = radius * Math.cos(Math.PI / 5)
  const free = smooth(Math.min(1, Math.min(t, 1 - t) / 0.12))
  const a = turn * 3 * t - Math.PI / 2,
    b = -turn * 4 * t - Math.PI / 2
  const weights = weightsAt([
    (1 - free) * vertices[0][0] + free * reach * (0.6 * Math.cos(a) + 0.4 * Math.cos(b)),
    (1 - free) * vertices[0][1] + free * reach * (0.6 * Math.sin(a) + 0.4 * Math.sin(b))
  ])
  return Object.fromEntries(styles.map((style, i) => [style, weights[i]]))
}

export function tour(styles, seconds) {
  const frames = [{ [styles[0]]: 1 }]
  const rest = Math.round(hold * fps)
  function pause() {
    for (let i = 0; i < rest; i++) frames.push(frames.at(-1))
  }
  function leg(from, to) {
    const steps = Math.round(seconds * fps)
    for (let i = 1; i < steps; i++) {
      const t = ease(i / steps)
      frames.push({ [styles[from]]: 1 - t, [styles[to]]: t })
    }
    frames.push({ [styles[to]]: 1 })
    pause()
  }
  const phases = []
  function phase(name, build) {
    const start = frames.length
    build()
    phases.push({ name, start, end: frames.length })
  }
  pause()
  phase('neighbours', () => {
    for (let i = 0; i < 5; i++) leg(i, (i + 1) % 5)
  })
  phase('distant', () => {
    for (let i = 0; i < 5; i++) leg((i * 2) % 5, (i * 2 + 2) % 5)
  })
  phase('free', () => {
    const steps = Math.round(5 * seconds * fps)
    for (let i = 1; i < steps; i++) frames.push(wander(styles, i / steps))
    frames.push({ [styles[0]]: 1 })
  })
  return { frames, phases }
}
