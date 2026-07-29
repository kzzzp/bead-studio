import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MARD_PALETTE } from '../src/palette.ts'
import { rebuildPattern } from '../src/patternEditing.ts'
import {
  markColorCompleted,
  markRegionCompleted,
  sanitizeCompletedCells,
  toggleCompletedCell,
  getProgressStats,
  getBoardProgressStats,
} from '../src/progressTracking.ts'

const red = MARD_PALETTE.find((color) => color.code === 'F1')!
const black = MARD_PALETTE.find((color) => color.code === 'H6')!

const pattern = rebuildPattern(3, 2, [red, red, null, black, red, black].map((color) => ({ color })))

describe('pattern progress tracking', () => {
  it('toggles only non-blank cells and keeps the input immutable', () => {
    const original = new Set<number>([0])
    const completed = toggleCompletedCell(pattern, original, 1)
    const blankIgnored = toggleCompletedCell(pattern, completed, 2)

    assert.deepEqual([...original], [0])
    assert.deepEqual([...completed].sort(), [0, 1])
    assert.deepEqual([...blankIgnored].sort(), [0, 1])
    assert.deepEqual([...toggleCompletedCell(pattern, completed, 0)], [1])
  })

  it('marks every bead of one color without including blank cells', () => {
    const completed = markColorCompleted(pattern, new Set([3]), 'F1')

    assert.deepEqual([...completed].sort(), [0, 1, 3, 4])
  })

  it('marks a rectangular region and clips it to pattern bounds', () => {
    const completed = markRegionCompleted(pattern, new Set(), { x: 1, y: 0, width: 4, height: 2 })

    assert.deepEqual([...completed].sort(), [1, 4, 5])
  })

  it('calculates totals by color and removes stale or blank indexes', () => {
    const cleaned = sanitizeCompletedCells(pattern, new Set([-1, 0, 2, 3, 99]))
    const stats = getProgressStats(pattern, cleaned)

    assert.deepEqual([...cleaned].sort(), [0, 3])
    assert.equal(stats.completed, 2)
    assert.equal(stats.total, 5)
    assert.equal(stats.remaining, 3)
    assert.equal(stats.percent, 40)
    assert.deepEqual(stats.byColor, [
      { code: 'F1', completed: 1, total: 3 },
      { code: 'H6', completed: 1, total: 2 },
    ])
  })

  it('reports progress for each physical board region', () => {
    const boards = getBoardProgressStats(pattern, new Set([0, 1, 3]), 2)

    assert.deepEqual(boards, [
      { column: 1, row: 1, completed: 3, total: 4, percent: 75 },
      { column: 2, row: 1, completed: 0, total: 1, percent: 0 },
    ])
  })
})
