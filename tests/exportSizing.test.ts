import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createFullExportPlan } from '../src/exportSizing.ts'

describe('createFullExportPlan', () => {
  it('keeps a 120 × 120 pattern in one clear, browser-safe image', () => {
    const plan = createFullExportPlan(120, 120, 40)

    assert.ok(plan.cellSize >= 48)
    assert.ok(plan.pixelWidth <= 12_288)
    assert.ok(plan.pixelHeight <= 12_288)
    assert.ok(plan.pixelWidth * plan.pixelHeight <= 64_000_000)
  })

  it('uses the maximum detail and a bottom legend for ordinary patterns', () => {
    const plan = createFullExportPlan(40, 40, 18)

    assert.equal(plan.cellSize, 96)
    assert.equal(plan.legendPosition, 'bottom')
    assert.ok(plan.coordinateFontScale >= 0.5)
    assert.ok(plan.codeFontScale >= 0.5)
    assert.ok(plan.pixelWidth <= 12_288)
    assert.ok(plan.pixelHeight <= 12_288)
  })

  it('uses readable canvas text instead of oversized pixel glyphs', () => {
    const plan = createFullExportPlan(40, 40, 18)

    assert.equal(plan.pixelText, false)
  })
})
