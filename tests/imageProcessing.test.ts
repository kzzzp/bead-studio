import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { processImageData, type ProcessOptions } from '../src/imageProcessing.ts'
import { DEFAULT_IMAGE_TRANSFORM } from '../src/imageComposition.ts'
import { createBeadColor } from '../src/palette.ts'

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
  transform: DEFAULT_IMAGE_TRANSFORM,
  mode: 'auto',
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

  it('matches colors against the selected brand palette', () => {
    const pattern = processImageData({
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]),
    }, options, [
      createBeadColor('CUSTOM-RED', '#FF0000', '测试'),
      createBeadColor('CUSTOM-BLUE', '#0000FF', '测试'),
    ])

    assert.deepEqual(pattern.cells.map((cell) => cell.color?.code), ['CUSTOM-RED', 'CUSTOM-BLUE'])
  })
})
