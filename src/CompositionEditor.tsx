import { Crosshair, FlipHorizontal2, RotateCcw, RotateCw, X } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  calculateImagePlacement,
  DEFAULT_IMAGE_TRANSFORM,
  findOpaqueBounds,
  fitSubjectTransform,
  type ImageRotation,
  type ImageTransform,
} from './imageComposition.ts'

interface CompositionEditorProps {
  image: HTMLImageElement
  width: number
  height: number
  fit: 'contain' | 'cover'
  transform: ImageTransform
  onApply: (transform: ImageTransform) => void
  onClose: () => void
}

const rotate = (value: ImageRotation, step: 90 | -90) => ((value + step + 360) % 360) as ImageRotation
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))

export function CompositionEditor({ image, width, height, fit, transform, onApply, onClose }: CompositionEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const [draft, setDraft] = useState(transform)
  const [subjectMessage, setSubjectMessage] = useState('自动居中对透明抠图效果最好')

  useEffect(() => setDraft(transform), [transform])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const maximum = 720
    const previewScale = Math.min(maximum / width, maximum / height)
    const canvasWidth = Math.max(1, Math.round(width * previewScale))
    const canvasHeight = Math.max(1, Math.round(height * previewScale))
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    const context = canvas.getContext('2d')!
    context.fillStyle = '#fffefa'
    context.fillRect(0, 0, canvasWidth, canvasHeight)
    context.save()
    context.beginPath()
    context.rect(0, 0, canvasWidth, canvasHeight)
    context.clip()
    const placement = calculateImagePlacement(image.naturalWidth, image.naturalHeight, canvasWidth, canvasHeight, fit, draft)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.translate(placement.center.x, placement.center.y)
    context.rotate(draft.rotation * Math.PI / 180)
    context.scale(draft.flipHorizontal ? -placement.scale : placement.scale, placement.scale)
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)
    context.restore()
    context.strokeStyle = 'rgba(80, 92, 83, .16)'
    context.lineWidth = 1
    const gridX = Math.max(1, canvasWidth / width)
    const gridY = Math.max(1, canvasHeight / height)
    for (let x = gridX; x < canvasWidth; x += gridX) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvasHeight); context.stroke()
    }
    for (let y = gridY; y < canvasHeight; y += gridY) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(canvasWidth, y); context.stroke()
    }
    context.strokeStyle = '#315c48'
    context.lineWidth = 3
    context.strokeRect(1.5, 1.5, canvasWidth - 3, canvasHeight - 3)
  }, [draft, fit, height, image, width])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const centerSubject = () => {
    const maximum = 1024
    const analysisScale = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight))
    const analysisWidth = Math.max(1, Math.round(image.naturalWidth * analysisScale))
    const analysisHeight = Math.max(1, Math.round(image.naturalHeight * analysisScale))
    const analysisCanvas = document.createElement('canvas')
    analysisCanvas.width = analysisWidth
    analysisCanvas.height = analysisHeight
    const context = analysisCanvas.getContext('2d', { willReadFrequently: true })!
    context.drawImage(image, 0, 0, analysisWidth, analysisHeight)
    const bounds = findOpaqueBounds(context.getImageData(0, 0, analysisWidth, analysisHeight))
    if (!bounds) {
      setSubjectMessage('没有检测到可见主体，请手动拖动定位')
      return
    }
    const sourceBounds = {
      x: bounds.x / analysisScale,
      y: bounds.y / analysisScale,
      width: bounds.width / analysisScale,
      height: bounds.height / analysisScale,
    }
    const coversNearlyAll = sourceBounds.width > image.naturalWidth * .94 && sourceBounds.height > image.naturalHeight * .94
    setDraft(fitSubjectTransform(sourceBounds, image.naturalWidth, image.naturalHeight, width, height, fit, draft))
    setSubjectMessage(coversNearlyAll ? '原图没有透明边缘，已按整图居中' : '已识别透明主体并居中放大')
  }

  const startDrag = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY, offsetX: draft.offsetX, offsetY: draft.offsetY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const continueDrag = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const start = dragRef.current
    const canvas = canvasRef.current
    if (!start || !canvas) return
    const bounds = canvas.getBoundingClientRect()
    setDraft((current) => ({
      ...current,
      offsetX: clamp(start.offsetX + (event.clientX - start.x) / (bounds.width / 2), -1, 1),
      offsetY: clamp(start.offsetY + (event.clientY - start.y) / (bounds.height / 2), -1, 1),
    }))
  }

  return (
    <div className="composition-editor-backdrop" role="presentation">
      <section className="composition-editor" role="dialog" aria-modal="true" aria-labelledby="composition-editor-title">
        <header>
          <div><strong id="composition-editor-title">裁剪与构图</strong><span>拖动画面调整位置，网格框就是最终生成范围。</span></div>
          <button type="button" className="editor-icon-button" onClick={onClose} aria-label="关闭裁剪编辑器"><X size={18} /></button>
        </header>
        <div className="composition-editor-body">
          <div className="composition-stage">
            <canvas
              ref={canvasRef}
              aria-label="图纸构图预览"
              onPointerDown={startDrag}
              onPointerMove={continueDrag}
              onPointerUp={() => { dragRef.current = null }}
              onPointerCancel={() => { dragRef.current = null }}
            />
          </div>
          <aside>
            <h3>画面调整</h3>
            <label><span>缩放 <b>{Math.round(draft.scale * 100)}%</b></span><input type="range" min="25" max="400" value={Math.round(draft.scale * 100)} onChange={(event) => setDraft((current) => ({ ...current, scale: Number(event.target.value) / 100 }))} /></label>
            <label><span>左右 <b>{Math.round(draft.offsetX * 100)}</b></span><input type="range" min="-100" max="100" value={Math.round(draft.offsetX * 100)} onChange={(event) => setDraft((current) => ({ ...current, offsetX: Number(event.target.value) / 100 }))} /></label>
            <label><span>上下 <b>{Math.round(draft.offsetY * 100)}</b></span><input type="range" min="-100" max="100" value={Math.round(draft.offsetY * 100)} onChange={(event) => setDraft((current) => ({ ...current, offsetY: Number(event.target.value) / 100 }))} /></label>
            <div className="composition-button-grid">
              <button type="button" onClick={() => setDraft((current) => ({ ...current, rotation: rotate(current.rotation, -90) }))}><RotateCcw size={15} /> 左转</button>
              <button type="button" onClick={() => setDraft((current) => ({ ...current, rotation: rotate(current.rotation, 90) }))}><RotateCw size={15} /> 右转</button>
              <button type="button" className={draft.flipHorizontal ? 'is-active' : ''} onClick={() => setDraft((current) => ({ ...current, flipHorizontal: !current.flipHorizontal }))}><FlipHorizontal2 size={15} /> 水平翻转</button>
              <button type="button" onClick={centerSubject}><Crosshair size={15} /> 主体居中</button>
            </div>
            <p role="status">{subjectMessage}</p>
            <button type="button" className="composition-reset" onClick={() => setDraft(DEFAULT_IMAGE_TRANSFORM)}><RotateCcw size={14} /> 重置构图</button>
          </aside>
        </div>
        <footer>
          <span>{width} × {height} 格 · {fit === 'contain' ? '完整放入' : '铺满裁切'} · 旋转 {draft.rotation}°</span>
          <div><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="button" className="primary-button" onClick={() => { onApply(draft); onClose() }}>应用构图</button></div>
        </footer>
      </section>
    </div>
  )
}
