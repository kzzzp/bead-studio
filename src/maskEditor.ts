export type MaskBrushMode = 'restore' | 'erase'

export type MaskPoint = {
  x: number
  y: number
}

function paintCircle(
  target: Uint8ClampedArray,
  original: Uint8ClampedArray,
  width: number,
  height: number,
  center: MaskPoint,
  radius: number,
  mode: MaskBrushMode,
) {
  const safeRadius = Math.max(0.5, radius)
  const minX = Math.max(0, Math.floor(center.x - safeRadius))
  const maxX = Math.min(width - 1, Math.ceil(center.x + safeRadius))
  const minY = Math.max(0, Math.floor(center.y - safeRadius))
  const maxY = Math.min(height - 1, Math.ceil(center.y + safeRadius))
  const radiusSquared = safeRadius * safeRadius

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x + 0.5 - center.x
      const dy = y + 0.5 - center.y
      if (dx * dx + dy * dy > radiusSquared) continue
      const offset = (y * width + x) * 4
      if (mode === 'restore') {
        target[offset] = original[offset]
        target[offset + 1] = original[offset + 1]
        target[offset + 2] = original[offset + 2]
        target[offset + 3] = original[offset + 3]
      } else {
        target[offset + 3] = 0
      }
    }
  }
}

export function paintMaskStroke(
  target: Uint8ClampedArray,
  original: Uint8ClampedArray,
  width: number,
  height: number,
  from: MaskPoint,
  to: MaskPoint,
  radius: number,
  mode: MaskBrushMode,
) {
  if (width <= 0 || height <= 0 || target.length !== width * height * 4 || original.length !== target.length) {
    throw new Error('修边像素数据尺寸无效')
  }

  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const spacing = Math.max(1, radius * 0.35)
  const steps = Math.max(1, Math.ceil(distance / spacing))
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps
    paintCircle(target, original, width, height, {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
    }, radius, mode)
  }
}
