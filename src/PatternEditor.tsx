import {
  ClipboardCopy,
  Copy,
  Droplets,
  Eraser,
  Eye,
  Grid2X2Check,
  Move,
  PaintBucket,
  Pencil,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { BeadPattern } from './imageProcessing.ts'
import type { BeadColor } from './palette.ts'
import {
  applyPatternCell,
  copyPatternSelection,
  fillPatternSelection,
  floodFillPattern,
  movePatternSelection,
  replacePatternColor,
  type PatternSelection,
} from './patternEditing.ts'
import { drawPattern } from './patternRenderer.ts'

type EditorTool = 'pencil' | 'erase' | 'fill' | 'eyedropper' | 'select'
type PendingTransfer = { mode: 'copy' | 'move'; selection: PatternSelection } | null

interface PatternEditorProps {
  pattern: BeadPattern
  originalPattern: BeadPattern
  palette: BeadColor[]
  canUndo: boolean
  canRedo: boolean
  onCommit: (pattern: BeadPattern) => void
  onUndo: () => void
  onRedo: () => void
  onReset: () => void
  onClose: () => void
}

const CELL_SIZE = 28

function normalizedSelection(start: { x: number; y: number }, end: { x: number; y: number }): PatternSelection {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  return { x, y, width: Math.abs(start.x - end.x) + 1, height: Math.abs(start.y - end.y) + 1 }
}

function rasterLine(start: { x: number; y: number }, end: { x: number; y: number }) {
  const points: Array<{ x: number; y: number }> = []
  let x = start.x
  let y = start.y
  const dx = Math.abs(end.x - start.x)
  const dy = Math.abs(end.y - start.y)
  const sx = start.x < end.x ? 1 : -1
  const sy = start.y < end.y ? 1 : -1
  let error = dx - dy
  while (true) {
    points.push({ x, y })
    if (x === end.x && y === end.y) break
    const doubled = error * 2
    if (doubled > -dy) { error -= dy; x += sx }
    if (doubled < dx) { error += dx; y += sy }
  }
  return points
}

export function PatternEditor({
  pattern,
  originalPattern,
  palette,
  canUndo,
  canRedo,
  onCommit,
  onUndo,
  onRedo,
  onReset,
  onClose,
}: PatternEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [workingPattern, setWorkingPattern] = useState(pattern)
  const workingPatternRef = useRef(pattern)
  const [tool, setTool] = useState<EditorTool>('pencil')
  const [selectedColor, setSelectedColor] = useState<BeadColor>(pattern.usage[0]?.color ?? palette[0])
  const [replaceSource, setReplaceSource] = useState(pattern.usage[0]?.color.code ?? '')
  const [selection, setSelection] = useState<PatternSelection | null>(null)
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer>(null)
  const [lastPaintCell, setLastPaintCell] = useState<{ x: number; y: number } | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [compareOriginal, setCompareOriginal] = useState(false)

  useEffect(() => {
    workingPatternRef.current = pattern
    setWorkingPattern(pattern)
  }, [pattern])
  useEffect(() => {
    if (palette.some((color) => color.code === selectedColor.code)) return
    setSelectedColor(pattern.usage[0]?.color ?? palette[0])
  }, [palette, pattern.usage, selectedColor.code])
  useEffect(() => {
    if (pattern.usage.some((item) => item.color.code === replaceSource)) return
    setReplaceSource(pattern.usage[0]?.color.code ?? '')
  }, [pattern, replaceSource])

  const displayPattern = compareOriginal ? originalPattern : workingPattern
  const paletteGroups = useMemo(() => {
    const groups = new Map<string, BeadColor[]>()
    for (const color of palette) groups.set(color.family, [...(groups.get(color.family) ?? []), color])
    return [...groups.entries()]
  }, [palette])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawPattern(canvas, displayPattern, {
      cellSize: CELL_SIZE,
      coordinates: false,
      codes: true,
      grid: true,
      boardLines: true,
      legend: false,
      pixelRatio: 1,
    })
    if (!selection || compareOriginal) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.save()
    context.fillStyle = 'rgba(71, 114, 93, .15)'
    context.strokeStyle = '#315c48'
    context.lineWidth = 3
    context.setLineDash([7, 5])
    context.fillRect(selection.x * CELL_SIZE, selection.y * CELL_SIZE, selection.width * CELL_SIZE, selection.height * CELL_SIZE)
    context.strokeRect(selection.x * CELL_SIZE + 1.5, selection.y * CELL_SIZE + 1.5, selection.width * CELL_SIZE - 3, selection.height * CELL_SIZE - 3)
    context.restore()
  }, [displayPattern, selection, compareOriginal])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (pendingTransfer || selection) {
          setPendingTransfer(null)
          setSelection(null)
        } else onClose()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) onRedo()
        else onUndo()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        onRedo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, onRedo, onUndo, pendingTransfer, selection])

  const cellFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const bounds = canvas.getBoundingClientRect()
    const x = Math.floor(((event.clientX - bounds.left) / bounds.width) * displayPattern.width)
    const y = Math.floor(((event.clientY - bounds.top) / bounds.height) * displayPattern.height)
    return x >= 0 && y >= 0 && x < displayPattern.width && y < displayPattern.height ? { x, y } : null
  }

  const setWorking = (next: BeadPattern) => {
    workingPatternRef.current = next
    setWorkingPattern(next)
  }

  const paintTo = (cell: { x: number; y: number }) => {
    const color = tool === 'erase' ? null : selectedColor
    const points = lastPaintCell ? rasterLine(lastPaintCell, cell) : [cell]
    let next = workingPatternRef.current
    for (const point of points) next = applyPatternCell(next, point.x, point.y, color)
    setWorking(next)
    setLastPaintCell(cell)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (compareOriginal) return
    const cell = cellFromEvent(event)
    if (!cell) return
    event.currentTarget.setPointerCapture(event.pointerId)
    if (pendingTransfer) {
      const next = pendingTransfer.mode === 'copy'
        ? copyPatternSelection(workingPatternRef.current, pendingTransfer.selection, cell.x, cell.y)
        : movePatternSelection(workingPatternRef.current, pendingTransfer.selection, cell.x, cell.y)
      setPendingTransfer(null)
      setSelection(null)
      setWorking(next)
      onCommit(next)
      return
    }
    if (tool === 'fill') {
      const next = floodFillPattern(workingPatternRef.current, cell.x, cell.y, selectedColor)
      setWorking(next)
      onCommit(next)
      return
    }
    if (tool === 'eyedropper') {
      const current = workingPatternRef.current
      const color = current.cells[cell.y * current.width + cell.x].color
      if (color) setSelectedColor(color)
      setTool('pencil')
      return
    }
    if (tool === 'select') {
      setSelectionStart(cell)
      setSelection(normalizedSelection(cell, cell))
      setDrawing(true)
      return
    }
    setSelection(null)
    setDrawing(true)
    setLastPaintCell(cell)
    paintTo(cell)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing || compareOriginal) return
    const cell = cellFromEvent(event)
    if (!cell) return
    if (tool === 'select' && selectionStart) setSelection(normalizedSelection(selectionStart, cell))
    else if (tool === 'pencil' || tool === 'erase') paintTo(cell)
  }

  const finishPointer = () => {
    if (!drawing) return
    setDrawing(false)
    setSelectionStart(null)
    setLastPaintCell(null)
    const latest = workingPatternRef.current
    if ((tool === 'pencil' || tool === 'erase') && latest !== pattern) onCommit(latest)
  }

  const commitSelectionFill = (color: BeadColor | null) => {
    if (!selection) return
    const next = fillPatternSelection(workingPatternRef.current, selection, color)
    setWorking(next)
    onCommit(next)
  }

  const replaceAll = () => {
    if (!replaceSource) return
    const next = replacePatternColor(workingPatternRef.current, replaceSource, selectedColor)
    setWorking(next)
    onCommit(next)
  }

  return (
    <div className="pattern-editor-backdrop" role="presentation">
      <section className="pattern-editor" role="dialog" aria-modal="true" aria-labelledby="pattern-editor-title">
        <header>
          <div>
            <strong id="pattern-editor-title">精修拼豆图纸</strong>
            <span>修改会同步更新用豆统计和所有导出文件；透明格不计数。</span>
          </div>
          <button className="editor-icon-button" type="button" onClick={onClose} aria-label="关闭图纸编辑器"><X size={18} /></button>
        </header>

        <div className="pattern-editor-toolbar" aria-label="图纸编辑工具">
          <div className="editor-tool-group">
            {([
              ['pencil', Pencil, '画笔'],
              ['erase', Eraser, '橡皮'],
              ['fill', PaintBucket, '填充'],
              ['eyedropper', Droplets, '吸管'],
              ['select', Grid2X2Check, '框选'],
            ] as const).map(([value, Icon, label]) => (
              <button key={value} type="button" className={tool === value ? 'is-active' : ''} onClick={() => { setTool(value); setPendingTransfer(null) }} aria-pressed={tool === value}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
          <span className="editor-toolbar-divider" />
          <label className="editor-color-select">
            <span className="bead-swatch" style={{ background: selectedColor.hex }}><i /></span>
            <select value={selectedColor.code} onChange={(event) => setSelectedColor(palette.find((color) => color.code === event.target.value) ?? selectedColor)} aria-label="选择画笔色号">
              {paletteGroups.map(([family, colors]) => (
                <optgroup key={family} label={family}>
                  {colors.map((color) => <option key={color.code} value={color.code}>{color.code} · {color.hex}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <span className="editor-toolbar-divider" />
          <button type="button" onClick={onUndo} disabled={!canUndo} title="撤销（Ctrl+Z）"><Undo2 size={15} /> 撤销</button>
          <button type="button" onClick={onRedo} disabled={!canRedo} title="重做（Ctrl+Y）"><Redo2 size={15} /> 重做</button>
          <button type="button" onClick={() => setCompareOriginal((value) => !value)} className={compareOriginal ? 'is-active' : ''} aria-pressed={compareOriginal}><Eye size={15} /> 对比原结果</button>
        </div>

        <div className="pattern-editor-body">
          <aside className="pattern-editor-sidebar">
            <section>
              <h3>批量替换色号</h3>
              <p>把图纸中某个色号一次性换成当前画笔色。</p>
              <label><span>原色号</span><select value={replaceSource} onChange={(event) => setReplaceSource(event.target.value)}>{workingPattern.usage.map((item) => <option key={item.color.code} value={item.color.code}>{item.color.code} · {item.count} 颗</option>)}</select></label>
              <button className="sidebar-action" type="button" onClick={replaceAll} disabled={!replaceSource}><RotateCcw size={14} /> 全部换成 {selectedColor.code}</button>
            </section>
            <section>
              <h3>框选操作</h3>
              <p>{selection ? `已选择 ${selection.width} × ${selection.height} 格` : '先选择“框选”，再拖动选择区域。'}</p>
              <div className="selection-actions">
                <button type="button" disabled={!selection} onClick={() => commitSelectionFill(selectedColor)}><PaintBucket size={14} /> 填色</button>
                <button type="button" disabled={!selection} onClick={() => commitSelectionFill(null)}><Trash2 size={14} /> 清空</button>
                <button type="button" disabled={!selection} onClick={() => selection && setPendingTransfer({ mode: 'copy', selection })}><Copy size={14} /> 复制</button>
                <button type="button" disabled={!selection} onClick={() => selection && setPendingTransfer({ mode: 'move', selection })}><Move size={14} /> 移动</button>
              </div>
              {pendingTransfer && <small role="status"><ClipboardCopy size={13} /> 请在图纸上点击目标区域左上角</small>}
            </section>
            <section className="editor-help">
              <h3>操作提示</h3>
              <ul>
                <li>拖动画笔可连续修改格子。</li>
                <li>橡皮产生透明空白格，不计入用豆。</li>
                <li>吸管点击图纸即可取得已有色号。</li>
                <li>编辑历史最多保留 50 步。</li>
              </ul>
            </section>
          </aside>
          <div className={`pattern-editor-stage ${compareOriginal ? 'is-comparing' : ''}`}>
            <div className="pattern-editor-scroll">
              <canvas
                ref={canvasRef}
                aria-label="可编辑拼豆图纸"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointer}
                onPointerCancel={finishPointer}
              />
            </div>
            {compareOriginal && <span className="compare-badge">正在查看自动生成的原始结果</span>}
          </div>
        </div>

        <footer>
          <span>{workingPattern.width} × {workingPattern.height} 格 · {workingPattern.totalBeads.toLocaleString()} 颗 · {workingPattern.usage.length} 色</span>
          <div>
            <button type="button" className="secondary-button" onClick={() => { onReset(); setSelection(null); setPendingTransfer(null) }}>恢复自动生成</button>
            <button type="button" className="primary-button" onClick={onClose}>完成编辑</button>
          </div>
        </footer>
      </section>
    </div>
  )
}
