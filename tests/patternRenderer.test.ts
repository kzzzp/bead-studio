import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { BeadPattern } from '../src/imageProcessing.ts'
import { createPatternSvg } from '../src/patternRenderer.ts'

const pattern: BeadPattern = {
  width: 1,
  height: 1,
  totalBeads: 0,
  usage: [],
  cells: [{ color: null }],
}

describe('createPatternSvg watermark', () => {
  it('adds nine large diagonal watermark marks across the full image', () => {
    const svg = createPatternSvg(pattern, {
      cellSize: 40,
      coordinates: true,
      codes: true,
      grid: true,
      boardLines: false,
      watermark: { text: ' @小Z & 图纸 ', opacity: 0.36 },
    })

    assert.match(svg, /@小Z &amp; 图纸/)
    assert.equal((svg.match(/@小Z &amp; 图纸/g) ?? []).length, 9)
    assert.equal((svg.match(/rotate\(-32/g) ?? []).length, 9)
    assert.match(svg, /fill-opacity="0\.3"/)
    assert.match(svg, /text-anchor="middle"/)
  })

  it('does not add watermark markup when the text is blank', () => {
    const svg = createPatternSvg(pattern, {
      cellSize: 40,
      coordinates: true,
      codes: true,
      grid: true,
      boardLines: false,
      watermark: { text: '   ' },
    })

    assert.doesNotMatch(svg, /fill-opacity=/)
  })
})
