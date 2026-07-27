import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hasUsablePersonMask, removeSimpleBackgroundFromRgba } from '../src/cartoonCutout.ts'

function setPixel(
  rgba: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  color: readonly [number, number, number, number],
) {
  const offset = (y * width + x) * 4
  rgba.set(color, offset)
}

describe('hasUsablePersonMask', () => {
  it('rejects an empty AI mask so cartoon fallback can run', () => {
    assert.equal(hasUsablePersonMask(new Float32Array(100), 0.46), false)
  })

  it('accepts a mask that contains a meaningful foreground region', () => {
    const mask = new Float32Array(100)
    mask.fill(0.9, 30, 50)

    assert.equal(hasUsablePersonMask(mask, 0.46), true)
  })
})

describe('removeSimpleBackgroundFromRgba', () => {
  it('keeps the main cartoon, fills its enclosed light area, and removes detached decorations', () => {
    const width = 9
    const height = 9
    const rgba = new Uint8ClampedArray(width * height * 4)
    const paleYellow = [250, 246, 183, 255] as const
    const orange = [238, 132, 25, 255] as const
    const white = [255, 255, 255, 255] as const

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) setPixel(rgba, width, x, y, paleYellow)
    }
    setPixel(rgba, width, 1, 1, white)
    for (let y = 3; y <= 5; y += 1) {
      for (let x = 3; x <= 5; x += 1) setPixel(rgba, width, x, y, orange)
    }
    setPixel(rgba, width, 4, 4, white)

    const result = removeSimpleBackgroundFromRgba(rgba, width, height)

    assert.equal(result.applied, true)
    assert.equal(rgba[(0 * width + 0) * 4 + 3], 0, 'plain background should be transparent')
    assert.equal(rgba[(1 * width + 1) * 4 + 3], 0, 'detached white dot should be transparent')
    assert.equal(rgba[(3 * width + 3) * 4 + 3], 255, 'main orange shape should remain')
    assert.equal(rgba[(4 * width + 4) * 4 + 3], 255, 'enclosed white area should remain')
  })

  it('leaves the source untouched when no foreground can be isolated', () => {
    const rgba = new Uint8ClampedArray(6 * 6 * 4)
    for (let offset = 0; offset < rgba.length; offset += 4) {
      rgba.set([240, 240, 240, 255], offset)
    }

    const before = rgba.slice()
    const result = removeSimpleBackgroundFromRgba(rgba, 6, 6)

    assert.equal(result.applied, false)
    assert.deepEqual(rgba, before)
  })
})
