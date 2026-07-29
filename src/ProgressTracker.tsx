import { Check, EyeOff, FlipHorizontal2, MousePointer2, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { BeadPattern } from './imageProcessing.ts'
import { mirrorPattern, type PatternSelection } from './patternEditing.ts'
import { drawPattern } from './patternRenderer.ts'
import {
  createProgressStorageKey,
  getBoardProgressStats,
  getProgressStats,
  markColorCompleted,
  markRegionCompleted,
  sanitizeCompletedCells,
  toggleCompletedCell,
} from './progressTracking.ts'

const CELL_SIZE = 28

function loadProgress(pattern: BeadPattern) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(createProgressStorageKey(pattern)) ?? '[]') as unknown
    if (!Array.isArray(saved)) return new Set<number>()
    return sanitizeCompletedCells(pattern, new Set(saved.filter((index): index is number => Number.isInteger(index))))
  } catch {
    return new Set<number>()
  }
}

function normalizeSelection(start: number, end: number, width: number): PatternSelection {
  const startX = start % width
  const startY = Math.floor(start / width)
  const endX = end % width
  const endY = Math.floor(end / width)
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(startX - endX) + 1,
    height: Math.abs(startY - endY) + 1,
  }
}

export function ProgressTracker({ pattern, onClose }: { pattern: BeadPattern; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragStartRef = useRef<number | null>(null)
  const storageKey = useMemo(() => createProgressStorageKey(pattern), [pattern])
  const [completed, setCompleted] = useState(() => loadProgress(pattern))
  const [selectedCode, setSelectedCode] = useState(pattern.usage[0]?.color.code ?? 'all')
  const [hideCompleted, setHideCompleted] = useState(false)
  const [regionMode, setRegionMode] = useState(false)
  const [mirrored, setMirrored] = useState(false)
  const [selection, setSelection] = useState<PatternSelection | null>(null)
  const stats = useMemo(() => getProgressStats(pattern, completed), [completed, pattern])
  const boardStats = useMemo(() => getBoardProgressStats(pattern, completed), [completed, pattern])
  const displayPattern = useMemo(() => mirrored ? mirrorPattern(pattern) : pattern, [mirrored, pattern])
  const selectedStats = stats.byColor.find((item) => item.code === selectedCode)

  useEffect(() => {
    setCompleted(loadProgress(pattern))
    setSelectedCode(pattern.usage[0]?.color.code ?? 'all')
    setSelection(null)
  }, [pattern, storageKey])

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify([...completed]))
  }, [completed, storageKey])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawPattern(canvas, displayPattern, {
      cellSize: CELL_SIZE,
      coordinates: false,
      codes: true,
      grid: true,
      boardLines: true,
      pixelRatio: 1,
    })
    const context = canvas.getContext('2d')!
    context.save()
    displayPattern.cells.forEach((cell, displayIndex) => {
      const x = displayIndex % pattern.width
      const y = Math.floor(displayIndex / pattern.width)
      const index = mirrored ? y * pattern.width + (pattern.width - x - 1) : displayIndex
      const px = x * CELL_SIZE
      const py = y * CELL_SIZE
      if (selectedCode !== 'all' && cell.color?.code !== selectedCode) {
        context.fillStyle = 'rgba(255, 254, 250, .78)'
        context.fillRect(px + 1, py + 1, CELL_SIZE - 1, CELL_SIZE - 1)
      }
      if (!completed.has(index)) return
      if (hideCompleted) {
        context.fillStyle = '#f7f6f1'
        context.fillRect(px + 1, py + 1, CELL_SIZE - 1, CELL_SIZE - 1)
      } else {
        context.fillStyle = 'rgba(62, 133, 91, .64)'
        context.fillRect(px + 1, py + 1, CELL_SIZE - 1, CELL_SIZE - 1)
        context.strokeStyle = '#ffffff'
        context.lineWidth = 2.4
        context.lineCap = 'round'
        context.lineJoin = 'round'
        context.beginPath()
        context.moveTo(px + 8, py + 14)
        context.lineTo(px + 12, py + 18)
        context.lineTo(px + 21, py + 9)
        context.stroke()
      }
    })
    if (selection) {
      context.fillStyle = 'rgba(225, 127, 79, .18)'
      context.strokeStyle = '#dc704d'
      context.lineWidth = 3
      context.fillRect(selection.x * CELL_SIZE, selection.y * CELL_SIZE, selection.width * CELL_SIZE, selection.height * CELL_SIZE)
      context.strokeRect(selection.x * CELL_SIZE + 1.5, selection.y * CELL_SIZE + 1.5, selection.width * CELL_SIZE - 3, selection.height * CELL_SIZE - 3)
    }
    context.restore()
  }, [completed, displayPattern, hideCompleted, mirrored, pattern, selectedCode, selection])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const pointerIndex = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.floor((event.clientX - rect.left) * event.currentTarget.width / rect.width / CELL_SIZE)
    const y = Math.floor((event.clientY - rect.top) * event.currentTarget.height / rect.height / CELL_SIZE)
    if (x < 0 || y < 0 || x >= pattern.width || y >= pattern.height) return null
    const displayIndex = y * pattern.width + x
    return mirrored ? y * pattern.width + (pattern.width - x - 1) : displayIndex
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const index = pointerIndex(event)
    if (index === null) return
    event.currentTarget.setPointerCapture(event.pointerId)
    if (regionMode) {
      const displayIndex = mirrored
        ? Math.floor(index / pattern.width) * pattern.width + (pattern.width - (index % pattern.width) - 1)
        : index
      dragStartRef.current = displayIndex
      setSelection(normalizeSelection(displayIndex, displayIndex, pattern.width))
    } else {
      setCompleted((current) => toggleCompletedCell(pattern, current, index))
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!regionMode || dragStartRef.current === null) return
    const index = pointerIndex(event)
    if (index !== null) {
      const displayIndex = mirrored
        ? Math.floor(index / pattern.width) * pattern.width + (pattern.width - (index % pattern.width) - 1)
        : index
      setSelection(normalizeSelection(dragStartRef.current, displayIndex, pattern.width))
    }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragStartRef.current = null
  }

  const resetProgress = () => {
    if (!window.confirm('确定清空这张图纸的全部拼豆进度吗？')) return
    setCompleted(new Set())
    setSelection(null)
  }

  const completeSelection = () => {
    if (!selection) return
    const sourceSelection = mirrored
      ? { ...selection, x: pattern.width - selection.x - selection.width }
      : selection
    setCompleted((current) => markRegionCompleted(pattern, current, sourceSelection))
  }

  return (
    <div className="progress-tracker-backdrop" role="presentation">
      <section className="progress-tracker" role="dialog" aria-modal="true" aria-label="拼豆进度辅助">
        <header>
          <div><strong>拼豆进度辅助</strong><span>高亮当前颜色，点击或框选图纸标记完成</span></div>
          <button type="button" aria-label="关闭进度辅助" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="progress-tracker-body">
          <aside>
            <div className="progress-summary">
              <strong>{stats.percent}%</strong>
              <span>已完成 {stats.completed} / {stats.total} 颗</span>
              <i><b style={{ width: `${stats.percent}%` }} /></i>
              <small>还剩 {stats.remaining} 颗</small>
            </div>
            <label className="progress-color-select">
              <span>当前拼豆颜色</span>
              <select value={selectedCode} onChange={(event) => setSelectedCode(event.target.value)}>
                <option value="all">全部颜色</option>
                {pattern.usage.map((item) => <option key={item.color.code} value={item.color.code}>{item.color.code} · {item.color.family}（{item.count}）</option>)}
              </select>
            </label>
            {selectedCode !== 'all' && (
              <div className="selected-color-progress">
                <i style={{ background: pattern.usage.find((item) => item.color.code === selectedCode)?.color.hex }} />
                <span><strong>{selectedCode}</strong><small>已完成 {selectedStats?.completed ?? 0} / {selectedStats?.total ?? 0}</small></span>
                <button type="button" onClick={() => setCompleted((current) => markColorCompleted(pattern, current, selectedCode))}><Check size={13} /> 完成该色</button>
              </div>
            )}
            <div className="progress-tools">
              <button type="button" className={regionMode ? 'is-active' : ''} onClick={() => { setRegionMode((current) => !current); setSelection(null) }}><MousePointer2 size={14} /> {regionMode ? '正在框选区域' : '按区域框选'}</button>
              <button type="button" className={hideCompleted ? 'is-active' : ''} onClick={() => setHideCompleted((current) => !current)}><EyeOff size={14} /> 隐藏已完成</button>
              <button type="button" className={mirrored ? 'is-active' : ''} onClick={() => { setMirrored((current) => !current); setSelection(null) }}><FlipHorizontal2 size={14} /> {mirrored ? '镜像位置' : '普通位置'}</button>
            </div>
            {regionMode && (
              <div className="region-actions">
                <p>在图纸上按住并拖动，框出准备拼的区域。</p>
                <button type="button" disabled={!selection} onClick={completeSelection}><Check size={13} /> 标记选区完成</button>
              </div>
            )}
            <div className="board-progress-list">
              <strong>29 × 29 板块进度</strong>
              {boardStats.map((board) => <span key={`${board.column}-${board.row}`}>板 {board.column}-{board.row}<i><b style={{ width: `${board.percent}%` }} /></i><em>{board.completed}/{board.total}</em></span>)}
            </div>
            <button type="button" className="reset-progress" onClick={resetProgress}><RotateCcw size={13} /> 清空全部进度</button>
          </aside>
          <main>
            <div className="progress-canvas-scroll">
              <canvas
                ref={canvasRef}
                aria-label="可点击标记完成的拼豆图纸"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            </div>
          </main>
        </div>
        <footer><span>进度仅保存在当前浏览器，不会上传图片或工程。</span><button type="button" className="primary-button" onClick={onClose}>保存并完成</button></footer>
      </section>
    </div>
  )
}
