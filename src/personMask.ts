const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function sampleMask(
  mask: Float32Array,
  maskWidth: number,
  maskHeight: number,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
) {
  const maskX = (sourceX + 0.5) * maskWidth / sourceWidth - 0.5
  const maskY = (sourceY + 0.5) * maskHeight / sourceHeight - 0.5
  const x0 = clamp(Math.floor(maskX), 0, maskWidth - 1)
  const y0 = clamp(Math.floor(maskY), 0, maskHeight - 1)
  const x1 = Math.min(maskWidth - 1, x0 + 1)
  const y1 = Math.min(maskHeight - 1, y0 + 1)
  const tx = clamp(maskX - x0, 0, 1)
  const ty = clamp(maskY - y0, 0, 1)
  const top = mask[y0 * maskWidth + x0] * (1 - tx) + mask[y0 * maskWidth + x1] * tx
  const bottom = mask[y1 * maskWidth + x0] * (1 - tx) + mask[y1 * maskWidth + x1] * tx
  return top * (1 - ty) + bottom * ty
}

function smoothStep(edge0: number, edge1: number, value: number) {
  const progress = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1)
  return progress * progress * (3 - 2 * progress)
}

export function applyPersonMaskToRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  personMask: Float32Array,
  maskWidth: number,
  maskHeight: number,
  threshold = 0.5,
  feather = 0.12,
) {
  if (width <= 0 || height <= 0 || maskWidth <= 0 || maskHeight <= 0) {
    throw new Error('人物蒙版尺寸无效')
  }
  if (rgba.length !== width * height * 4 || personMask.length !== maskWidth * maskHeight) {
    throw new Error('人物蒙版数据长度不匹配')
  }
  const safeThreshold = clamp(threshold, 0, 1)
  const safeFeather = clamp(feather, 0, 1)
  const edge0 = safeThreshold - safeFeather / 2
  const edge1 = safeThreshold + safeFeather / 2

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alphaIndex = (y * width + x) * 4 + 3
      const confidence = sampleMask(personMask, maskWidth, maskHeight, x, y, width, height)
      const personAlpha = smoothStep(edge0, edge1, confidence)
      rgba[alphaIndex] = Math.round(rgba[alphaIndex] * personAlpha)
    }
  }
  return rgba
}
