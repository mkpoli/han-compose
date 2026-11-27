// Center of the illustrated loop below 人 and 二 in 𠆭, in the guide's y-up
// font units. Each point of reversal belongs to a single continuous stroke.
// -PT_AxH_RV-, Bai IDS example font (OFL 1.1), U+E00B.
// https://github.com/NightFurySL2001/bai-ids/blob/104501af/fonts/example.vfc
const curves = [
  [600, 550, 534, 485, 450, 451],
  [391, 422, 325, 411, 278, 411],
  [211, 411, 174, 441, 174, 492],
  [174, 566, 297, 602, 402, 602],
  [537, 602, 745, 549, 745, 439],
  [745, 377, 590, 333, 418, 315],
  [577, 310, 772, 273, 772, 217],
  [772, 158, 535, 118, 255, 85],
  [475, 84, 691, 57, 873, -18],
]
// Endpoints of the nine Bai strokes. The second cubic of the descent ends
// its first quarter arc. Interior control points stay in the continuous trace.
export const guideLoopTurns = [[600, 803], [600, 715], ...curves.slice(1).map(c => c.slice(-2))]
export const guideLoop = [600, 803, 600, 715]
for (const [cx, cy, dx, dy, x, y] of curves) {
  const i = guideLoop.length - 2, px = guideLoop[i], py = guideLoop[i + 1]
  for (let j = 1; j <= 12; j++) {
    const t = j / 12, u = 1 - t
    guideLoop.push(u ** 3 * px + 3 * u * u * t * cx + 3 * u * t * t * dx + t ** 3 * x,
      u ** 3 * py + 3 * u * u * t * cy + 3 * u * t * t * dy + t ** 3 * y)
  }
}
