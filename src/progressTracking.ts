import type { BeadPattern } from './imageProcessing.ts'
import type { PatternSelection } from './patternEditing.ts'

export type ProgressStats = {
  completed: number
  total: number
  remaining: number
  percent: number
  byColor: Array<{ code: string; completed: number; total: number }>
}

export function sanitizeCompletedCells(pattern: BeadPattern, completed: ReadonlySet<number>) {
  return new Set([...completed].filter((index) => (
    Number.isInteger(index)
    && index >= 0
    && index < pattern.cells.length
    && pattern.cells[index].color !== null
  )))
}

export function toggleCompletedCell(pattern: BeadPattern, completed: ReadonlySet<number>, index: number) {
  const next = sanitizeCompletedCells(pattern, completed)
  if (!Number.isInteger(index) || !pattern.cells[index]?.color) return next
  if (next.has(index)) next.delete(index)
  else next.add(index)
  return next
}

export function markColorCompleted(pattern: BeadPattern, completed: ReadonlySet<number>, code: string) {
  const next = sanitizeCompletedCells(pattern, completed)
  pattern.cells.forEach((cell, index) => {
    if (cell.color?.code === code) next.add(index)
  })
  return next
}

export function markRegionCompleted(
  pattern: BeadPattern,
  completed: ReadonlySet<number>,
  selection: PatternSelection,
) {
  const next = sanitizeCompletedCells(pattern, completed)
  const startX = Math.max(0, Math.floor(selection.x))
  const startY = Math.max(0, Math.floor(selection.y))
  const endX = Math.min(pattern.width, Math.ceil(selection.x + selection.width))
  const endY = Math.min(pattern.height, Math.ceil(selection.y + selection.height))
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = y * pattern.width + x
      if (pattern.cells[index].color) next.add(index)
    }
  }
  return next
}

export function getProgressStats(pattern: BeadPattern, completed: ReadonlySet<number>): ProgressStats {
  const valid = sanitizeCompletedCells(pattern, completed)
  const completedByCode = new Map<string, number>()
  for (const index of valid) {
    const code = pattern.cells[index].color?.code
    if (code) completedByCode.set(code, (completedByCode.get(code) ?? 0) + 1)
  }
  const byColor = pattern.usage
    .map((item) => ({
      code: item.color.code,
      completed: completedByCode.get(item.color.code) ?? 0,
      total: item.count,
    }))
    .sort((a, b) => a.code.localeCompare(b.code))
  const total = pattern.totalBeads
  const completedCount = valid.size
  return {
    completed: completedCount,
    total,
    remaining: Math.max(0, total - completedCount),
    percent: total ? Math.round(completedCount / total * 100) : 0,
    byColor,
  }
}

export function createProgressStorageKey(pattern: BeadPattern) {
  const signature = pattern.usage
    .slice()
    .sort((a, b) => a.color.code.localeCompare(b.color.code))
    .map((item) => `${item.color.code}:${item.count}`)
    .join('|')
  let hash = 2166136261
  for (const character of signature) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `bead-studio-progress:${pattern.width}x${pattern.height}:${(hash >>> 0).toString(36)}`
}

export function getBoardProgressStats(pattern: BeadPattern, completed: ReadonlySet<number>, boardSize = 29) {
  const valid = sanitizeCompletedCells(pattern, completed)
  const boards = []
  for (let startY = 0; startY < pattern.height; startY += boardSize) {
    for (let startX = 0; startX < pattern.width; startX += boardSize) {
      let total = 0
      let done = 0
      for (let y = startY; y < Math.min(pattern.height, startY + boardSize); y += 1) {
        for (let x = startX; x < Math.min(pattern.width, startX + boardSize); x += 1) {
          const index = y * pattern.width + x
          if (!pattern.cells[index].color) continue
          total += 1
          if (valid.has(index)) done += 1
        }
      }
      boards.push({
        column: Math.floor(startX / boardSize) + 1,
        row: Math.floor(startY / boardSize) + 1,
        completed: done,
        total,
        percent: total ? Math.round(done / total * 100) : 100,
      })
    }
  }
  return boards
}
