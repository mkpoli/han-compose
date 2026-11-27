import { hexOf } from './sha256.js'

// Outer contours of 庙 (⿸广由) and 旬 (⿹勹日) in exports with unlabelled
// components. Each digest identifies the complete pair of outline masters.
/** @type {Record<string, Record<string, number[]>>} */
const outlines = {
  庙: {
    '897d12c4e59562a392af450e81f90ed95405a19f8af5307374e266bce789ee9f': [4, 5, 6], // Sans
    '7212d394b3c71d2e2ec76aa073d3101094b26e78ad21489f83b3336a1d1ab85e': [4, 5, 6], // Serif
    'cf441af10dd4f298d73504a6f6108cab21ee3a7b81368210257c98df3a06e92b': [4, 5], // Fangsong
    'b91feacb867221e03d01e9d467af20ffe79c0703dfb004be41079fa4571239ed': [5], // TW-Kai
    '7c0f6f3f5fcfab5d199b2c8a50430f9175e2431f8de84e5fcf6befeec60863e8': [0], // Kureedo
  },
  旬: {
    '98428b7dd58c721dc6febb0368e294ddba4cf7e046d4eab128340ec85deec551': [3, 4, 5], // Sans
    'd0c68f258dc2bbb78a22c7c5cc40e5140895efac0fd567ca4575580ce388149e': [4, 5, 6], // Serif
  },
}

/** @param {{p: unknown[], v?: number}} record @param {string} donor */
export function directionalDonorCut(record, donor) {
  const candidates = outlines[donor]
  if (!candidates || record.v !== 1) return null
  const frame = candidates[hexOf(JSON.stringify(record.p))]
  if (!frame) return null
  const contents = record.p.map((_, i) => i).filter(i => !frame.includes(i))
  return { frame, contents }
}
