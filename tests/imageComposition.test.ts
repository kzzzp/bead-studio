import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_IMAGE_TRANSFORM,
  calculateImagePlacement,
  findOpaqueBounds,
  fitSubjectTransform,
} from '../src/imageComposition.ts'

describe('image composition', () => {
  it('contains a landscape image inside a square board', () => {
    const placement = calculateImagePlacement(200, 100, 40, 40, 'contain', DEFAULT_IMAGE_TRANSFORM)

    assert.equal(placement.scale, 0.2)
    assert.equal(placement.renderedWidth, 40)
    assert.equal(placement.renderedHeight, 20)
    assert.deepEqual(placement.center, { x: 20, y: 20 })
  })

  it('covers the board and applies zoom plus normalized offsets', () => {
    const placement = calculateImagePlacement(200, 100, 40, 40, 'cover', {
      ...DEFAULT_IMAGE_TRANSFORM,
      scale: 1.5,
      offsetX: 0.5,
      offsetY: -0.25,
    })

    assert.ok(Math.abs(placement.scale - 0.6) < 1e-9)
    assert.ok(Math.abs(placement.renderedWidth - 120) < 1e-9)
    assert.ok(Math.abs(placement.renderedHeight - 60) < 1e-9)
    assert.deepEqual(placement.center, { x: 30, y: 15 })
  })

  it('uses rotated source dimensions for 90 degree placement', () => {
    const placement = calculateImagePlacement(200, 100, 40, 80, 'contain', {
      ...DEFAULT_IMAGE_TRANSFORM,
      rotation: 90,
    })

    assert.equal(placement.scale, 0.4)
    assert.equal(placement.renderedWidth, 40)
    assert.equal(placement.renderedHeight, 80)
  })

  it('finds the non-transparent subject bounds', () => {
    const bounds = findOpaqueBounds({
      width: 4,
      height: 3,
      data: new Uint8ClampedArray([
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 1, 2, 3, 255, 4, 5, 6, 255, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ]),
    })

    assert.deepEqual(bounds, { x: 1, y: 1, width: 2, height: 1 })
  })

  it('centers and safely enlarges a transparent subject', () => {
    const transform = fitSubjectTransform(
      { x: 60, y: 20, width: 40, height: 60 },
      200,
      100,
      40,
      40,
      'contain',
      DEFAULT_IMAGE_TRANSFORM,
    )

    assert.ok(transform.scale > 1)
    assert.ok(transform.offsetX > 0)
    assert.ok(Math.abs(transform.offsetY) < 1e-9)
  })
})
