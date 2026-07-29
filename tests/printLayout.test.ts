import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createPrintLayout } from '../src/printLayout.ts'

describe('physical print layout', () => {
  it('tiles a 104 × 104 mini-bead pattern over A4 with overlap', () => {
    const layout = createPrintLayout(104, 104, {
      paper: 'a4',
      orientation: 'portrait',
      beadSizeMm: 2.6,
      overlapCells: 2,
    })

    assert.deepEqual(layout.paperSizeMm, { width: 210, height: 297 })
    assert.equal(layout.cellsPerPage.width, 71)
    assert.equal(layout.cellsPerPage.height, 97)
    assert.equal(layout.pages.length, 4)
    assert.equal(layout.pages[1].startX, 69)
    assert.equal(layout.pages[2].startY, 95)
  })

  it('uses A3 landscape dimensions and keeps every page inside printable bounds', () => {
    const layout = createPrintLayout(120, 80, {
      paper: 'a3',
      orientation: 'landscape',
      beadSizeMm: 2.6,
      overlapCells: 2,
    })

    assert.deepEqual(layout.paperSizeMm, { width: 420, height: 297 })
    assert.ok(layout.pages.every((page) => page.width <= layout.cellsPerPage.width && page.height <= layout.cellsPerPage.height))
    assert.ok(layout.pages.every((page) => page.widthMm === page.width * 2.6 && page.heightMm === page.height * 2.6))
  })

  it('supports 5 mm beads without changing scale', () => {
    const layout = createPrintLayout(29, 29, {
      paper: 'a4',
      orientation: 'portrait',
      beadSizeMm: 5,
      overlapCells: 1,
    })

    assert.equal(layout.pages.length, 1)
    assert.equal(layout.pages[0].widthMm, 145)
    assert.equal(layout.pages[0].heightMm, 145)
  })
})
