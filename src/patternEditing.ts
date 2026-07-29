import type { BeadColor } from './palette.ts'
import type { BeadPattern, PatternCell } from './imageProcessing.ts'

export interface PatternSelection {
  x: number
  y: number
  width: number
  height: number
}

function cellCode(cell: PatternCell) {
  return cell.color?.code ?? null
}

function inBounds(pattern: BeadPattern, x: number, y: number) {
  return x >= 0 && y >= 0 && x < pattern.width && y < pattern.height
}

export function rebuildPattern(width: number, height: number, cells: PatternCell[]): BeadPattern {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || cells.length !== width * height) {
    throw new Error('图纸尺寸与格子数量不一致')
  }
  const counts = new Map<string, { color: BeadColor; count: number }>()
  for (const cell of cells) {
    if (!cell.color) continue
    const item = counts.get(cell.color.code) ?? { color: cell.color, count: 0 }
    item.count += 1
    counts.set(cell.color.code, item)
  }
  const totalBeads = [...counts.values()].reduce((sum, item) => sum + item.count, 0)
  const usage = [...counts.values()]
    .sort((a, b) => b.count - a.count || a.color.code.localeCompare(b.color.code))
    .map((item) => ({ ...item, percent: totalBeads ? item.count / totalBeads : 0 }))
  return { width, height, cells, usage, totalBeads }
}

export function applyPatternCell(pattern: BeadPattern, x: number, y: number, color: BeadColor | null) {
  if (!inBounds(pattern, x, y)) return pattern
  const index = y * pattern.width + x
  if (cellCode(pattern.cells[index]) === (color?.code ?? null)) return pattern
  const cells = pattern.cells.slice()
  cells[index] = { color }
  return rebuildPattern(pattern.width, pattern.height, cells)
}

export function floodFillPattern(pattern: BeadPattern, startX: number, startY: number, color: BeadColor | null) {
  if (!inBounds(pattern, startX, startY)) return pattern
  const startIndex = startY * pattern.width + startX
  const sourceCode = cellCode(pattern.cells[startIndex])
  const targetCode = color?.code ?? null
  if (sourceCode === targetCode) return pattern

  const cells = pattern.cells.slice()
  const visited = new Uint8Array(cells.length)
  const queue = new Int32Array(cells.length)
  let head = 0
  let tail = 0
  queue[tail++] = startIndex
  visited[startIndex] = 1

  while (head < tail) {
    const index = queue[head++]
    if (cellCode(pattern.cells[index]) !== sourceCode) continue
    cells[index] = { color }
    const x = index % pattern.width
    const y = Math.floor(index / pattern.width)
    const add = (next: number) => {
      if (visited[next]) return
      visited[next] = 1
      queue[tail++] = next
    }
    if (x > 0) add(index - 1)
    if (x < pattern.width - 1) add(index + 1)
    if (y > 0) add(index - pattern.width)
    if (y < pattern.height - 1) add(index + pattern.width)
  }
  return rebuildPattern(pattern.width, pattern.height, cells)
}

export function replacePatternColor(pattern: BeadPattern, sourceCode: string, color: BeadColor | null) {
  if (!sourceCode || sourceCode === color?.code) return pattern
  let changed = false
  const cells = pattern.cells.map((cell) => {
    if (cell.color?.code !== sourceCode) return cell
    changed = true
    return { color }
  })
  return changed ? rebuildPattern(pattern.width, pattern.height, cells) : pattern
}

export function fillPatternSelection(pattern: BeadPattern, selection: PatternSelection, color: BeadColor | null) {
  const cells = pattern.cells.slice()
  let changed = false
  for (let y = 0; y < selection.height; y += 1) {
    for (let x = 0; x < selection.width; x += 1) {
      const targetX = selection.x + x
      const targetY = selection.y + y
      if (!inBounds(pattern, targetX, targetY)) continue
      const index = targetY * pattern.width + targetX
      if (cellCode(cells[index]) === (color?.code ?? null)) continue
      cells[index] = { color }
      changed = true
    }
  }
  return changed ? rebuildPattern(pattern.width, pattern.height, cells) : pattern
}

function transferPatternSelection(
  pattern: BeadPattern,
  selection: PatternSelection,
  targetX: number,
  targetY: number,
  clearSource: boolean,
) {
  const copied: PatternCell[] = []
  for (let y = 0; y < selection.height; y += 1) {
    for (let x = 0; x < selection.width; x += 1) {
      const sourceX = selection.x + x
      const sourceY = selection.y + y
      copied.push(inBounds(pattern, sourceX, sourceY) ? pattern.cells[sourceY * pattern.width + sourceX] : { color: null })
    }
  }

  const cells = pattern.cells.slice()
  if (clearSource) {
    for (let y = 0; y < selection.height; y += 1) {
      for (let x = 0; x < selection.width; x += 1) {
        const sourceX = selection.x + x
        const sourceY = selection.y + y
        if (inBounds(pattern, sourceX, sourceY)) cells[sourceY * pattern.width + sourceX] = { color: null }
      }
    }
  }
  copied.forEach((cell, offset) => {
    const x = offset % selection.width
    const y = Math.floor(offset / selection.width)
    const destinationX = targetX + x
    const destinationY = targetY + y
    if (inBounds(pattern, destinationX, destinationY)) cells[destinationY * pattern.width + destinationX] = { color: cell.color }
  })
  return rebuildPattern(pattern.width, pattern.height, cells)
}

export function copyPatternSelection(pattern: BeadPattern, selection: PatternSelection, targetX: number, targetY: number) {
  return transferPatternSelection(pattern, selection, targetX, targetY, false)
}

export function movePatternSelection(pattern: BeadPattern, selection: PatternSelection, targetX: number, targetY: number) {
  return transferPatternSelection(pattern, selection, targetX, targetY, true)
}

export function mirrorPattern(pattern: BeadPattern) {
  const cells: PatternCell[] = new Array(pattern.cells.length)
  for (let y = 0; y < pattern.height; y += 1) {
    for (let x = 0; x < pattern.width; x += 1) {
      cells[y * pattern.width + (pattern.width - x - 1)] = pattern.cells[y * pattern.width + x]
    }
  }
  return rebuildPattern(pattern.width, pattern.height, cells)
}
