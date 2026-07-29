import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyConversionMode } from '../src/conversionModes.ts'

describe('conversion mode preprocessing', () => {
  it('turns line art into clean black or white pixels', () => {
    assert.deepEqual(applyConversionMode([30, 40, 50], 'lineart'), [28, 28, 28])
    assert.deepEqual(applyConversionMode([240, 245, 250], 'lineart'), [248, 248, 248])
  })

  it('posterizes cartoon colors while keeping them saturated', () => {
    const result = applyConversionMode([218, 83, 51], 'cartoon')
    assert.ok(result.every((channel) => channel >= 0 && channel <= 255))
    assert.notDeepEqual(result, [218, 83, 51])
  })

  it('keeps pixel-art colors untouched', () => {
    assert.deepEqual(applyConversionMode([12, 34, 56], 'pixel'), [12, 34, 56])
  })
})
