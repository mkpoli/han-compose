// Frames are prepared in playing order, ahead of the playhead. Some kinds of frame
// take longer to prepare than to play, so samples from across the route are timed
// first, and the clock starts once the timings show every frame will be ready before
// it is needed. A recording then never waits on an export fetch or a slow contour
// match. Later rounds reuse the frames.
import { fps } from './route.js'

const interval = 1000 / fps

// Sampling at a stride that shares no period with the route's own rhythm.
const stride = 17

// The mean time of the recent draws. An occasional slow frame counts in full: the
// playhead has to wait for it like any other.
const typical = (times) =>
  times.slice(-200).reduce((sum, time) => sum + time, 0) / Math.min(times.length, 200)

// `kind` names what a mix costs to draw; frames of one kind are timed together.
export function createPlayback({ draw, kind = () => '', paint, stateChanged, progress, prepared, failed }) {
  let state = 'idle',
    generation = 0,
    frameRequest = 0,
    controller
  let mixes = [],
    images = [],
    first = 0,
    done = 0,
    elapsed = 0,
    started = 0,
    last = -1
  function stateIs(value) {
    state = value
    stateChanged(value)
  }
  function halt() {
    generation++
    controller?.abort()
    controller = undefined
    cancelAnimationFrame(frameRequest)
    last = -1
  }
  function stop() {
    halt()
    mixes = []
    images = []
    stateIs('idle')
  }
  function show(index) {
    if (index === last) return
    last = index
    paint({ image: images[index], mix: mixes[index] }, index)
  }
  function tick(time) {
    if (state !== 'playing') return
    elapsed += time - started
    started = time
    const count = mixes.length
    let index = Math.floor(elapsed / interval) % count
    // The playhead waits on a frame that is still being prepared.
    if ((index - first + count) % count >= done) {
      index = (first + done - 1) % count
      elapsed = index * interval
    }
    show(index)
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
    cancelAnimationFrame(frameRequest)
    stateIs('paused')
  }
  async function prepare(from) {
    const mine = generation,
      count = mixes.length
    const signal = (controller = new AbortController()).signal
    const at = (position) => (from + position) % count
    const repeats = (position) => position > 0 && mixes[at(position)] === mixes[at(position - 1)]
    async function ready(position) {
      const index = at(position)
      images[index] ??=
        repeats(position) && images[at(position - 1)]
          ? images[at(position - 1)]
          : await draw(mixes[index], signal)
      return mine === generation
    }
    first = from
    done = 0
    elapsed = from * interval
    stateIs('preparing')
    try {
      // Time the second of two neighbouring frames; the first one pays for whatever
      // that part of the route loads.
      const drawn = (position) => !repeats(position) && !images[at(position)]
      const taken = new Map()
      const timed = (position, time) => {
        const name = kind(mixes[at(position)])
        taken.set(name, [...(taken.get(name) ?? []), time])
      }
      for (let position = 0; position + 1 < count; position += stride) {
        if (!drawn(position + 1)) continue
        if (!(await ready(position))) return
        const before = performance.now()
        if (!(await ready(position + 1))) return
        timed(position + 1, performance.now() - before)
        progress(position / count / 8)
      }
      for (let position = 0; position < count; position++) {
        const fresh = drawn(position),
          before = performance.now()
        if (!(await ready(position))) return
        done = position + 1
        if (fresh) timed(position, performance.now() - before)
        if (state !== 'preparing') continue
        const all = taken.size ? typical([...taken.values()].flat()) : 0
        const cost = new Map([...taken].map(([name, times]) => [name, typical(times)]))
        let late = done < Math.min(count, fps / 2),
          wait = 0
        for (let later = done; later < count && !late; later++) {
          if (drawn(later)) wait += cost.get(kind(mixes[at(later)])) ?? all
          late = wait > 0.9 * later * interval
        }
        if (late) {
          progress(0.125 + (0.875 * done) / count)
          continue
        }
        // Keep the previous manual mix visible until playback can begin. Cancelling
        // preparation therefore leaves the editor in exactly the state it started in.
        show(from)
        stateIs('paused')
        if (!document.hidden) resume()
      }
      controller = undefined
      prepared()
    } catch (error) {
      if (mine !== generation) return
      stop()
      failed(error)
    }
  }
  function start(frames, from = 0) {
    stop()
    mixes = frames
    return prepare(from)
  }
  // Jump to a frame. One that is not prepared yet becomes the next to prepare.
  function seek(index) {
    if (state === 'idle') return
    const count = mixes.length
    if (state !== 'preparing' && (index - first + count) % count < done) {
      elapsed = index * interval
      show(index)
      return
    }
    halt()
    return prepare(index)
  }
  return {
    start,
    stop,
    pause,
    resume,
    seek,
    get state() {
      return state
    }
  }
}
