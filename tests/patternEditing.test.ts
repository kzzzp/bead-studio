import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { BeadPattern, PatternCell } from '../src/imageProcessing.ts'
import { MARD_PALETTE } from '../src/palette.ts'
import {
  applyPatternCell,
  copyPatternSelection,
  floodFillPattern,
  mirrorPattern,
  movePatternSelection,
  rebuildPattern,
  replacePatternColor,
} from '../src/patternEditing.ts'

const red = MARD_PALETTE.find((color) => color.code === 'F1')!
const black = MARD_PALETTE.find((color) => color.code === 'H6')!

function pattern(width: number, height: number, colors: Array<typeof red | null>): BeadPattern {
  return rebuildPattern(width, height, colors.map((color): PatternCell => ({ color })))
}

describe('pattern editing', () => {
  it('rebuilds usage and excludes blank cells from totals', () => {
    const result = pattern(3, 1, [red, null, red])

    assert.equal(result.totalBeads, 2)
    assert.equal(result.usage.length, 1)
    assert.equal(result.usage[0].color.code, 'F1')
    assert.equal(result.usage[0].count, 2)
    assert.equal(result.usage[0].percent, 1)
  })

  it('changes one cell without mutating the original pattern', () => {
    const original = pattern(2, 1, [red, null])
    const edited = applyPatternCell(original, 1, 0, black)

    assert.equal(original.cells[1].color, null)
    assert.equal(edited.cells[1].color?.code, 'H6')
    assert.equal(edited.totalBeads, 2)
  })

  it('fills only the connected region with the same source color', () => {
    const original = pattern(3, 2, [red, red, black, red, black, black])
    const edited = floodFillPattern(original, 0, 0, null)

    assert.deepEqual(edited.cells.map((cell) => cell.color?.code ?? null), [null, null, 'H6', null, 'H6', 'H6'])
    assert.equal(edited.totalBeads, 3)
  })

  it('replaces a color globally without touching blanks or other colors', () => {
    const original = pattern(4, 1, [red, null, black, red])
    const edited = replacePatternColor(original, 'F1', black)

    assert.deepEqual(edited.cells.map((cell) => cell.color?.code ?? null), ['H6', null, 'H6', 'H6'])
    assert.equal(edited.totalBeads, 3)
  })

  it('copies and moves rectangular selections inside pattern bounds', () => {
    const original = pattern(4, 2, [red, black, null, null, null, null, null, null])
    const copied = copyPatternSelection(original, { x: 0, y: 0, width: 2, height: 1 }, 2, 1)
    const moved = movePatternSelection(original, { x: 0, y: 0, width: 2, height: 1 }, 2, 1)

    assert.deepEqual(copied.cells.map((cell) => cell.color?.code ?? null), ['F1', 'H6', null, null, null, null, 'F1', 'H6'])
    assert.deepEqual(moved.cells.map((cell) => cell.color?.code ?? null), [null, null, null, null, null, null, 'F1', 'H6'])
  })

  it('mirrors cell positions while keeping color objects and statistics readable', () => {
    const original = pattern(3, 1, [red, null, black])
    const mirrored = mirrorPattern(original)

    assert.deepEqual(mirrored.cells.map((cell) => cell.color?.code ?? null), ['H6', null, 'F1'])
    assert.equal(mirrored.totalBeads, original.totalBeads)
    assert.deepEqual(mirrored.usage.map((item) => item.color.code), original.usage.map((item) => item.color.code))
  })
})
