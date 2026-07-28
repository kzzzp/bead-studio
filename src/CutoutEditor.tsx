import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Check, Eraser, Eye, Paintbrush, Redo2, RotateCcw, Undo2, X } from 'lucide-react'
import { paintMaskStroke, type MaskBrushMode, type MaskPoint } from './maskEditor'

type CutoutEditorProps = {
  sourceImage: HTMLImageElement
  cutoutImage: HTMLImageElement
  onApply: (blob: Blob) => Promise<void>
  onClose: () => void
}

type EditorPixels = {
  width: number
  height: number
  original: Uint8ClampedArray
  initial: Uint8ClampedArray
  current: Uint8ClampedArray
}

const HISTORY_LIMIT = 20

function canvasPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('无法生成修边结果')), 'image/png')
  })
}

export function CutoutEditor({ sourceImage, cutoutImage, onApply, onClose }: CutoutEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pixelsRef = useRef<EditorPixels | null>(null)
  const undoRef = useRef<Uint8ClampedArray[]>([])
  const redoRef = useRef<Uint8ClampedArray[]>([])
  const drawingRef = useRef(false)
  const previousPointRef = useRef<MaskPoint | null>(null)
  const [mode, setMode] = useState<MaskBrushMode>('restore')
  const [brushSize, setBrushSize] = useState(48)
  const [showOriginal, setShowOriginal] = useState(false)
  const [revision, setRevision] = useState(0)
  const [, refreshHistory] = useState(0)
  const [isApplying, setIsApplying] = useState(false)

  const redraw = () => {
    const canvas = canvasRef.current
    const pixels = pixelsRef.current
    if (!canvas || !pixels) return
    const context = canvas.getContext('2d')
    if (!context) return
    const data = showOriginal ? pixels.original : pixels.current
    context.putImageData(new ImageData(new Uint8ClampedArray(data), pixels.width, pixels.height), 0, 0)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const width = cutoutImage.naturalWidth
    const height = cutoutImage.naturalHeight
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return

    context.clearRect(0, 0, width, height)
    context.drawImage(sourceImage, 0, 0, width, height)
    const original = new Uint8ClampedArray(context.getImageData(0, 0, width, height).data)
    context.clearRect(0, 0, width, height)
    context.drawImage(cutoutImage, 0, 0, width, height)
    const initial = new Uint8ClampedArray(context.getImageData(0, 0, width, height).data)
    pixelsRef.current = {
      width,
      height,
      original,
      initial,
      current: new Uint8ClampedArray(initial),
    }
    undoRef.current = []
    redoRef.current = []
    refreshHistory((value) => value + 1)
    setRevision((value) => value + 1)
  }, [sourceImage, cutoutImage])

  useEffect(redraw, [revision, showOriginal])

  const canvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>): MaskPoint => {
    const canvas = event.currentTarget
    const bounds = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left) * canvas.width / bounds.width,
      y: (event.clientY - bounds.top) * canvas.height / bounds.height,
    }
  }

  const commitHistory = () => {
    const pixels = pixelsRef.current
    if (!pixels) return
    undoRef.current.push(new Uint8ClampedArray(pixels.current))
    if (undoRef.current.length > HISTORY_LIMIT) undoRef.current.shift()
    redoRef.current = []
    refreshHistory((value) => value + 1)
  }

  const paintTo = (point: MaskPoint) => {
    const pixels = pixelsRef.current
    const previous = previousPointRef.current
    if (!pixels || !previous) return
    paintMaskStroke(
      pixels.current,
      pixels.original,
      pixels.width,
      pixels.height,
      previous,
      point,
      brushSize / 2,
      mode,
    )
    previousPointRef.current = point
    setRevision((value) => value + 1)
  }

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (showOriginal || isApplying) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    commitHistory()
    drawingRef.current = true
    const point = canvasPoint(event)
    previousPointRef.current = point
    paintTo(point)
  }

  const continueDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    event.preventDefault()
    paintTo(canvasPoint(event))
  }

  const stopDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    drawingRef.current = false
    previousPointRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const restoreSnapshot = (
    from: { current: Uint8ClampedArray[] },
    to: { current: Uint8ClampedArray[] },
  ) => {
    const pixels = pixelsRef.current
    const snapshot = from.current.pop()
    if (!pixels || !snapshot) return
    to.current.push(new Uint8ClampedArray(pixels.current))
    pixels.current = snapshot
    refreshHistory((value) => value + 1)
    setRevision((value) => value + 1)
  }

  const reset = () => {
    const pixels = pixelsRef.current
    if (!pixels) return
    commitHistory()
    pixels.current = new Uint8ClampedArray(pixels.initial)
    setRevision((value) => value + 1)
  }

  const apply = async () => {
    const canvas = canvasRef.current
    const pixels = pixelsRef.current
    if (!canvas || !pixels || isApplying) return
    setIsApplying(true)
    try {
      const context = canvas.getContext('2d')
      if (!context) throw new Error('当前浏览器无法保存修边结果')
      context.putImageData(new ImageData(new Uint8ClampedArray(pixels.current), pixels.width, pixels.height), 0, 0)
      await onApply(await canvasPngBlob(canvas))
    } catch (error) {
      console.error(error)
      window.alert(error instanceof Error ? error.message : '保存修边结果失败')
      setIsApplying(false)
    }
  }

  return (
    <div className="cutout-editor-backdrop" role="dialog" aria-modal="true" aria-labelledby="cutout-editor-title">
      <div className="cutout-editor">
        <header>
          <div>
            <strong id="cutout-editor-title">人工修边</strong>
            <span>绿色恢复主体，红色擦除背景；保存后会重新计算图纸和用豆数量</span>
          </div>
          <button type="button" className="editor-icon-button" onClick={onClose} aria-label="关闭人工修边"><X size={18} /></button>
        </header>

        <div className="cutout-editor-toolbar">
          <div className="editor-tool-group">
            <button type="button" className={mode === 'restore' ? 'is-active restore-tool' : ''} onClick={() => setMode('restore')}><Paintbrush size={16} /> 恢复主体</button>
            <button type="button" className={mode === 'erase' ? 'is-active erase-tool' : ''} onClick={() => setMode('erase')}><Eraser size={16} /> 擦除背景</button>
          </div>
          <label className="editor-brush-size">
            <span>画笔 {brushSize}px</span>
            <input type="range" min="8" max="180" step="2" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
          </label>
          <div className="editor-tool-group">
            <button type="button" disabled={!undoRef.current.length} onClick={() => restoreSnapshot(undoRef, redoRef)}><Undo2 size={16} /> 撤销</button>
            <button type="button" disabled={!redoRef.current.length} onClick={() => restoreSnapshot(redoRef, undoRef)}><Redo2 size={16} /> 重做</button>
            <button type="button" onClick={reset}><RotateCcw size={16} /> 重置</button>
            <button type="button" className={showOriginal ? 'is-active' : ''} onClick={() => setShowOriginal((value) => !value)}><Eye size={16} /> {showOriginal ? '返回修边图' : '对照原图'}</button>
          </div>
        </div>

        <div className="cutout-editor-stage">
          <div className="editor-checkerboard">
            <canvas
              ref={canvasRef}
              aria-label="人工修边画布"
              className={`${mode === 'restore' ? 'is-restoring' : 'is-erasing'} ${showOriginal ? 'is-comparing' : ''}`}
              onPointerDown={startDrawing}
              onPointerMove={continueDrawing}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
            />
          </div>
          <span className={`editor-mode-tip ${mode}`}>{showOriginal ? '正在查看原图，返回修边图后可继续绘制' : mode === 'restore' ? '恢复画笔：涂过的位置会从原图取回' : '擦除画笔：涂过的位置变成透明，不计豆'}</span>
        </div>

        <footer>
          <span>可撤销 {undoRef.current.length} 步 · 可重做 {redoRef.current.length} 步</span>
          <div>
            <button type="button" className="editor-cancel" onClick={onClose}>取消</button>
            <button type="button" className="editor-save" onClick={apply} disabled={isApplying}><Check size={16} /> {isApplying ? '正在应用…' : '应用修边结果'}</button>
          </div>
        </footer>
      </div>
    </div>
  )
}
