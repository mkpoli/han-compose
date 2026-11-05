// Known constructs whose last operands are one designed body. The body is a part record cut from
// the host glyph (han-compose's han-constructs.tsv), carried here so the browser composer needs no
// runtime cut. Outlines: Noto Sans CJK JP and its fallbacks, SIL OFL 1.1 / CC0.
import { partOf, placed } from './geometry.js'

/** The bottom of 𱵺 (⿳𠆳𠚍禸): 𠚍禸, 离's lower body. */
const XIE_BOTTOM = {"b":[135.0,-69.0,872.0,538.0],"p":[["MLQ2LQ2","SATUBugEIAeoBcgGIAZkBoAFDAYQBXAGSATUBg==","U//6AP//awBMAFMA+QDw/+3/iv+w/6//wf+p/w=="],["MLQ2Q2LQ2Q2LQ2Q2Q2Q2Q2","0AScB3QF+AfABnQH4AfwBuAIhAeoCSwIiArsB6AJOAeYCJwGxAkMBsAKfAUUChAFHAmkBegHPAacBogFGAX4BNwEMAV0BGgF+AXwBTAHlAYYBhQH0AScBw==","O//xAPb/awA3AFkA+f9tAK//UADf/2sAMgEpAE8AsP8rAQkAQQBWABIBBAACAI7/vf+r/wMAk/86AKj/3/+Q/63/sf+k/hMAyP9ZAMH++v/I/6f/yv+m/w=="],["MLQ2LQ2","sAYQCEQHaAgACBQIhAi0B/AHVAd4B6wHsAYQCA==","Mv/uAPf/bQBHAFQA+QD7//v/iv+2/63/wf+p/w=="],["MLQ2LQ2","lAnIBjQKHAfwCsAGcAtYBtAKAAZgCmAGlAnIBg==","Rf/1AP7/bQBMAFIA+wDw/+7/i/+x/6//wP+q/w=="],["MLQ2LLQ2LQ2LQ2LQ2Q2Q2LQ2Q2Q2LLLLLQ2LLLLLQ2LQ2LLLLLLQ2LLQ3Q2Q2Q3","LAzQ/zQM0P90DND/dAwEAHQMcAIgB3AClAa4AQAGFAGYCVQBTAmwAfAIEALICVwC7ApAAYALSACUCvD/ZApEACgKmABEBkwApAU4AAQFIADkBBAA5AQUAMQEgACEBAQB4AQcAVAFrAGEBeQB6AVwAjwDcAI8A+z+HALs/hwCQAN0BkADqAaUA9gG7APsAuwD7ALcB/wD3Af8A8AERAjABNQHHAUUB4AFtAfMBWwIcAXwCAwFaAjABKQLwASkC9wHvAzcB7wM7AMgCOwD6AeUA7QHQAOgDUADoA0EAKANqP9gDTj/EA0g/3wM9P7UCvz+sApo/2wK0P8YC8z/+AvM/ywM0P8=","AAAVAQAAYQBz/2EAc/8AAHP/n/9GAJ//bQDC/1IBcQDl/lQAl//A/wP/KgAkAG8AbwA9ANAAzv/B/4j/if/M/7z/m/8OAKD/EwCg/ysAov9z/2P/c//y/3z/3f82/0AArv9VAJX/PwCT/z0A7v6f/40An/+NAJ//c/+f/3P/YQCy/2EAhv8xABP/n/9z/5//c/9hAI0AYQCNAGEAhf5dALL/r//E/gQAAgBsAEsAUwABAfT/hQFGAHP/YQBz/2EAjQBhAI0An/9NAJ//dwDM//0AYQCNAGEAjQAAAI0A5v9eAK7/KACj/xMAn/+a/6D/gP/V//j+ZQACAGEA+/9hAPX/YQA="]],"w":[71.66,51.79]}

export const CONSTRUCTS = {
  '⿳山𠚍禸': { host: '𱵺', keep: 'bottom', keepParts: 1, body: XIE_BOTTOM },
}

/**
 * A construct's kept parts, and its body fitted to the box of the parts it replaces. A drawing
 * with nothing to replace is left alone.
 * @param {{ host: string, keep: string, keepParts: number, body: any }} spec
 * @param {any[]} out
 */
export function constructParts(spec, out) {
  const kept = out.slice(0, spec.keepParts)
  const rest = out.slice(spec.keepParts)
  if (!rest.length) return out
  const body = partOf(spec.body)
  const box = [
    Math.min(...rest.map(p => p.target[0])), Math.min(...rest.map(p => p.target[1])),
    Math.max(...rest.map(p => p.target[2])), Math.max(...rest.map(p => p.target[3])),
  ]
  return [...kept, placed(body, body.box, box, 0, `construct ${spec.host} ${spec.keep}`)]
}
