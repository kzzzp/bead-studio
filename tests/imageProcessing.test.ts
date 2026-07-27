import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { processImageData, type ProcessOptions } from '../src/imageProcessing.ts'

const options: ProcessOptions = {
  width: 2,
  height: 1,
  maxColors: 4,
  brightness: 0,
  contrast: 0,
  saturation: 100,
  removeBackground: false,
  backgroundTolerance: 22,
  dither: false,
  fit: 'contain',
}

describe('processImageData', () => {
  it('keeps transparent board cells blank and excludes them from bead counts', () => {
    const pattern = processImageData({
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([
        220, 45, 50, 255,
        255, 255, 255, 0,
      ]),
    }, options)

    assert.ok(pattern.cells[0].color)
    assert.equal(pattern.cells[1].color, null)
    assert.equal(pattern.totalBeads, 1)
    assert.equal(pattern.usage.reduce((total, item) => total + item.count, 0), 1)
  })
})
