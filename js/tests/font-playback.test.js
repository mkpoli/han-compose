import { expect, it } from 'bun:test'
import { createPlayback } from '../examples/font-mixer/playback.js'
import { fps, tour } from '../examples/font-mixer/route.js'
import { FONT_STYLES } from '../src/font-mix.js'

const pure = (style) => ({ [style]: 1 })
const total = (mix) => Object.values(mix).reduce((sum, share) => sum + share, 0)

it('tours the neighbouring faces, then the distant ones, then the interior', () => {
  const { frames, phases } = tour(FONT_STYLES, 3)
  expect(phases.map((phase) => phase.name)).toEqual(['neighbours', 'distant', 'free'])
  expect(phases.at(-1).end).toBe(frames.length)
  const stops = (phase) => {
    const seen = []
    for (const mix of frames.slice(phase.start - 1, phase.end)) {
      const [style, more] = Object.keys(mix)
      if (!more && mix[style] === 1 && seen.at(-1) !== style) seen.push(style)
    }
    return seen
  }
  const [a, b, c, d, e] = FONT_STYLES
  expect(stops(phases[0])).toEqual([a, b, c, d, e, a])
  expect(stops(phases[1])).toEqual([a, c, e, b, d, a])
  expect(stops(phases[2])).toEqual([a])
  for (const mix of frames) expect(total(mix)).toBeCloseTo(1, 9)
  // The loop closes on the face it opens with, and no step leaps across the pad.
  expect(frames[0]).toEqual(pure(a))
  expect(frames.at(-1)).toEqual(pure(a))
  for (let i = 1; i < frames.length; i++) {
    const step = Math.max(...FONT_STYLES.map((s) => Math.abs((frames[i][s] ?? 0) - (frames[i - 1][s] ?? 0))))
    expect(step).toBeLessThan(0.08)
  }
  const interior = frames.slice(phases[2].start, phases[2].end)
  expect(interior.some((mix) => FONT_STYLES.every((style) => mix[style] > 0.1))).toBe(true)
  expect(interior.length).toBe(5 * 3 * fps)
})

it('plays prepared frames in order from any frame and drops a cancelled run before it can paint', async () => {
  const names = ['requestAnimationFrame', 'cancelAnimationFrame', 'document']
  const descriptors = Object.fromEntries(
    names.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)])
  )
  let tick,
    release,
    deferred = true
  Object.assign(globalThis, {
    requestAnimationFrame: (fn) => {
      tick = fn
      return 1
    },
    cancelAnimationFrame: () => {
      tick = undefined
    },
    document: { hidden: false }
  })
  const painted = [],
    drawn = []
  const held = { n: 3 }
  const frames = [{ n: 0 }, { n: 1 }, { n: 2 }, held, held, { n: 4 }]
  try {
    const playback = createPlayback({
      draw: async (mix) => {
        drawn.push(mix.n)
        if (deferred) await new Promise((resolve) => (release = resolve))
        return mix.n
      },
      paint: (frame) => painted.push(frame.image),
      stateChanged: () => {},
      progress: () => {},
      prepared: () => {},
      failed: (error) => {
        throw error
      }
    })
    const old = playback.start(frames)
    playback.stop()
    deferred = false
    await playback.start(frames, 2)
    release()
    await old
    expect(painted).toEqual([2])
    // A held frame is drawn once.
    expect(drawn.filter((n) => n === 3)).toEqual([3])
    expect(playback.state).toBe('playing')
    let now = performance.now()
    const step = (frame) => tick((now += (frame * 1000) / fps))
    step(1.5)
    step(1)
    step(1)
    step(1)
    step(1)
    expect(painted).toEqual([2, 3, 3, 4, 0, 1])
    playback.seek(5)
    expect(painted.at(-1)).toBe(4)
    playback.pause()
    expect(tick).toBeUndefined()
    playback.resume()
    expect(typeof tick).toBe('function')
    playback.stop()
    playback.resume()
    expect(playback.state).toBe('idle')
    expect(tick).toBeUndefined()
  } finally {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})
