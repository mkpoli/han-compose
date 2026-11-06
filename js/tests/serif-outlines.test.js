import { describe, expect, it } from 'bun:test'
import { partOf, placed, svgPath } from '../src/geometry.js'

// Two records of the serif export `62af8c26f961`, as it stores them: `o` and `6` bottom
// contours whose light master repeats its first point as its last while the heavy one does not.
const records = {
  o: { b: [48.43, -14.63, 547.49, 530.61], p: [
    ['MQ4Q4Q4Q4', 'pgTF/50Dxf/XAboAwgChAsIABwTCAG4F3wFVB6cDSgimBEoIqQVKCHEHVgeOCG8FjggHBI4IoAJ1B7kArwXF/6YExf8=', 'UgAQ/wMArP/N/8H/yv/q/8r/AADK/xcA3f8/ABkAVQBSAFUAiwBVAMcAPwDaABcA2gAAANoA6v/XAMH/oQCs/1IArP8='],
    ['MQ3Q3Q3Q3', 'pgRCANAFQgAmBzACJgcCBCYH1gXQBcsHpgTLB30DywcmAtYFJgICBCYCMAJ9A0IApgRCAA==', 'UgDwAAAAVACO/xoAjv8AAI7/5v8AAKz/UgCs/6cArP8WAeb/FgEAABYBGwCnAFQAUgBUAA=='],
  ] },
  6: { b: [55.8, -14.63, 509.01, 742.67], p: [
    ['MQ4Q5LQ4Q3Q4Q3Q3LLQ2Q4Q4', 'hQTF/2UDxf/AAeYA3wDxAt8AVQTfALIFzgEoCI0DIgoHBmwLlQebC6YHQwvbBeIKbwPuCDoDIAY6AncEOgJ5AnIDQgCJBEIAIgVCABcG+QCoBl4CqAZdA6gGwwSEBT0GhgQ9Bt4DPQapAqgFDgL3BMQBJgXfASYFGQPiBvQE4gbmBeIGPgcGBvQHfAT0B3MD9AdkAhAHugCDBcX/hQTF/w==', 'bwAQ/z8ArP/w/8n/wf/v/8H/AADB/w8A6v8tADMAQwCFAFIAqwBcAK4Av//NALL/7QDM//YA7//2AAAA9gAWALoAVABgAFQARgBUAP3/NQDU/xEA1P8AANT/4/8cAKz/RgCs/3IArP+3ALz/6gCS/+QAQgDtAFQAxwBUANQAVADqAFQA+gA6AAABEgAAAQAAAAHr//AAxP+xAKz/bwCs/w=='],
  ] },
}
const endsApart = contour => Math.hypot(contour.heavy[0] - contour.heavy.at(-2), contour.heavy[1] - contour.heavy.at(-1))

describe('a serif record whose heavy master tears its closed contours', () => {
  for (const key of Object.keys(records)) it(`draws ${key} with every contour closed`, () => {
    const part = partOf(records[key])
    expect(part.contours.length).toBe(records[key].p.length)
    for (const contour of part.contours) expect(endsApart(contour)).toBeLessThan(1e-9)
    // Drawn at the heavy master the path still closes on itself, so a fill leaves no wedge.
    const path = svgPath([placed(part, part.box, part.box, 0, 'test', [1, 1])])
    for (const segment of path.split('M').slice(1)) {
      const nums = segment.match(/-?\d+(?:\.\d+)?/g).map(Number)
      expect(Math.hypot(nums[0] - nums.at(-2), nums[1] - nums.at(-1))).toBeLessThan(1e-9)
    }
  })
})
