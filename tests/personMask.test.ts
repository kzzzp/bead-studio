import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyPersonMaskToRgba } from '../src/personMask.ts'

describe('applyPersonMaskToRgba', () => {
  it('turns low-confidence background pixels fully transparent', () => {
    const rgba = new Uint8ClampedArray([
      220, 40, 30, 255,
      40, 80, 220, 255,
    ])

    applyPersonMaskToRgba(rgba, 2, 1, new Float32Array([0.95, 0.05]), 2, 1, 0.5, 0.12)

    assert.equal(rgba[3], 255)
    assert.equal(rgba[7], 0)
  })

  it('preserves source transparency for retained person pixels', () => {
    const rgba = new Uint8ClampedArray([220, 40, 30, 128])

    applyPersonMaskToRgba(rgba, 1, 1, new Float32Array([1]), 1, 1, 0.5, 0.12)

    assert.equal(rgba[3], 128)
  })
})
