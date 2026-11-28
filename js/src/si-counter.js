// The parenthesized headword in 統外字登記 row 579 places its crossbar about
// 38% down the outline and finishes the upper box about four fifths across.
// https://rare.glyphatlas.org/en/entry/3156#sighting-3322
// Stations are on the light master of each pinned 巳. Move the cap and both
// edges of the crossbar together, keeping their native brush profiles.
/** @type {Record<string, number[]>} */
const crossbars = {
  sans: [315, 460, 46],
  serif: [325, 440, 52],
  fangsong: [368, 449, 32],
  'pen-writing': [360, 441, 29],
}

// Stretch only the horizontals between the upright and the right shoulder.
// Both sides of the descending stroke and its top shoulder travel together.
// [lowest eligible y, fixed left edge, start of shoulder, horizontal shift]
/** @type {Record<string, number[]>} */
const shoulders = {
  sans: [310, 220, 750, -40],
  regular: [390, 253, 486, 133],
  fangsong: [369, 275, 630, 19],
  'pen-writing': [360, 281, 685, 41],
}

/** Adjust the native host before replacing its lower bend. Implied control
 * points and both masters receive the same displacement at each station.
 * @param {any[]} contours @param {string} style */
export function siCounterContours(contours, style) {
  const bar = crossbars[style], shoulder = shoulders[style]
  return contours.map(contour => {
    const light = contour.light.slice(), heavy = contour.heavy.slice()
    for (let i = 0; i < light.length; i += 2) {
      const x = light[i], y = light[i + 1]
      if (bar && y >= bar[0] && y <= bar[1]) {
        light[i + 1] += bar[2]
        heavy[i + 1] += bar[2]
      }
      if (shoulder && y >= shoulder[0]) {
        const [, left, right, reach] = shoulder
        const shift = reach * Math.max(0, Math.min(1, (x - left) / (right - left)))
        light[i] += shift
        heavy[i] += shift
      }
    }
    return { ...contour, light, heavy }
  })
}
