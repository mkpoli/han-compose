// Prepare a complete outward pass before starting the clock. The return pass reuses
// those frames, so an export fetch or a slow contour match never stalls a recording.
const fps = 30
const hold = 450

export function createPlayback({ draw, paint, stateChanged, failed }) {
  let state = 'idle',
    generation = 0,
    frameRequest = 0,
    controller
  let frames = [],
    duration = 0,
    elapsed = 0,
    started = 0,
    last = -1
  function stateIs(value) {
    state = value
    stateChanged(value)
  }
  function stop() {
    generation++
    controller?.abort()
    controller = undefined
    cancelAnimationFrame(frameRequest)
    frames = []
    elapsed = 0
    last = -1
    stateIs('idle')
  }
  function tick(time) {
    if (state !== 'playing') return
    const cycle = (elapsed + time - started) % (2 * (duration + hold))
    const t = cycle < duration + hold ? (cycle - hold) / duration : (2 * (duration + hold) - cycle) / duration
    const index = Math.round(Math.max(0, Math.min(1, t)) * (frames.length - 1))
    if (index !== last) {
      paint(frames[index])
      last = index
    }
    frameRequest = requestAnimationFrame(tick)
  }
  function resume() {
    if (state !== 'paused') return
    started = performance.now()
    stateIs('playing')
    frameRequest = requestAnimationFrame(tick)
  }
  function pause() {
    if (state !== 'playing') return
    elapsed += performance.now() - started
    cancelAnimationFrame(frameRequest)
    stateIs('paused')
  }
  async function start(from, to, seconds) {
    stop()
    const mine = generation
    controller = new AbortController()
    duration = seconds * 1000
    const steps = Math.round(seconds * fps)
    stateIs('preparing')
    try {
      for (let i = 0; i <= steps; i++) {
        const t = (1 - Math.cos((Math.PI * i) / steps)) / 2
        const mix = { [from]: 1 - t, [to]: t }
        const image = await draw(mix, controller.signal)
        if (mine !== generation) return
        frames.push({ image, mix })
      }
      controller = undefined
      // Keep the previous manual mix visible until all frames are ready. Cancelling
      // preparation therefore leaves the editor in exactly the state it started in.
      paint(frames[0])
      last = 0
      stateIs('paused')
      if (!document.hidden) resume()
    } catch (error) {
      if (mine !== generation) return
      stop()
      failed(error)
    }
  }
  return {
    start,
    stop,
    pause,
    resume,
    get state() {
      return state
    }
  }
}
