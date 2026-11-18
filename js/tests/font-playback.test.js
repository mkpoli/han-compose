import {expect,it} from 'bun:test'
import {createPlayback} from '../examples/font-mixer/playback.js'

it('prepares both exact endpoints and drops a cancelled run before it can paint',async()=>{
  const descriptors=Object.fromEntries(['requestAnimationFrame','cancelAnimationFrame','document'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
  let tick, release, deferred=true
  Object.assign(globalThis,{requestAnimationFrame:fn=>{tick=fn;return 1}, cancelAnimationFrame:()=>{tick=undefined}, document:{hidden:false}})
  const painted=[]
  const seen=[]
  try {
    const playback=createPlayback({draw:async mix=>{
      seen.push(mix)
      if(deferred) await new Promise(resolve=>{release=resolve})
      return mix
    },paint:frame=>painted.push(frame.image),stateChanged:()=>{},failed:error=>{throw error}})
    const old=playback.start('serif','fangsong',3)
    playback.stop()
    deferred=false
    await playback.start('serif','fangsong',3)
    expect(painted).toEqual([{serif:1,fangsong:0}])
    expect(seen.at(-1)).toEqual({serif:0,fangsong:1})
    release()
    await old
    expect(playback.state).toBe('playing')
    tick(performance.now()+3500)
    expect(painted.at(-1)).toEqual({serif:0,fangsong:1})
    playback.pause()
    expect(tick).toBeUndefined()
    playback.resume()
    expect(typeof tick).toBe('function')
    playback.stop()
    playback.resume()
    expect(playback.state).toBe('idle')
    expect(tick).toBeUndefined()
  } finally {
    for(const [key,descriptor] of Object.entries(descriptors)){
      if(descriptor) Object.defineProperty(globalThis,key,descriptor)
      else delete globalThis[key]
    }
  }
})
