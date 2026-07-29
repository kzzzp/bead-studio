import type { PixelImageData } from './imageProcessing.ts'

export type ImageRotation = 0 | 90 | 180 | 270

export interface ImageTransform {
  scale: number
  offsetX: number
  offsetY: number
  rotation: ImageRotation
  flipHorizontal: boolean
}

export interface SubjectBounds {
  x: number
  y: number
  width: number
  height: number
}

export const DEFAULT_IMAGE_TRANSFORM: ImageTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  flipHorizontal: false,
}

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))

export function calculateImagePlacement(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: 'contain' | 'cover',
  transform: ImageTransform,
) {
  const quarterTurn = transform.rotation === 90 || transform.rotation === 270
  const rotatedWidth = quarterTurn ? sourceHeight : sourceWidth
  const rotatedHeight = quarterTurn ? sourceWidth : sourceHeight
  const widthScale = targetWidth / rotatedWidth
  const heightScale = targetHeight / rotatedHeight
  const baseScale = fit === 'contain' ? Math.min(widthScale, heightScale) : Math.max(widthScale, heightScale)
  const scale = baseScale * clamp(transform.scale, 0.25, 4)

  return {
    scale,
    baseScale,
    renderedWidth: rotatedWidth * scale,
    renderedHeight: rotatedHeight * scale,
    center: {
      x: targetWidth / 2 + clamp(transform.offsetX, -1, 1) * targetWidth / 2,
      y: targetHeight / 2 + clamp(transform.offsetY, -1, 1) * targetHeight / 2,
    },
  }
}

export function findOpaqueBounds(imageData: PixelImageData, alphaThreshold = 32): SubjectBounds | null {
  let left = imageData.width
  let top = imageData.height
  let right = -1
  let bottom = -1
  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      if (imageData.data[(y * imageData.width + x) * 4 + 3] < alphaThreshold) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  return right < left || bottom < top
    ? null
    : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}

function rotateVector(x: number, y: number, rotation: ImageRotation) {
  if (rotation === 90) return { x: -y, y: x }
  if (rotation === 180) return { x: -x, y: -y }
  if (rotation === 270) return { x: y, y: -x }
  return { x, y }
}

export function fitSubjectTransform(
  bounds: SubjectBounds,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: 'contain' | 'cover',
  current: ImageTransform,
): ImageTransform {
  const quarterTurn = current.rotation === 90 || current.rotation === 270
  const subjectWidth = quarterTurn ? bounds.height : bounds.width
  const subjectHeight = quarterTurn ? bounds.width : bounds.height
  const desiredScale = Math.min(targetWidth / (subjectWidth * 1.12), targetHeight / (subjectHeight * 1.12))
  const placement = calculateImagePlacement(sourceWidth, sourceHeight, targetWidth, targetHeight, fit, {
    ...current,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  })
  const scale = clamp(desiredScale / placement.baseScale, 0.25, 4)
  const absoluteScale = placement.baseScale * scale
  const sourceCenterX = bounds.x + bounds.width / 2 - sourceWidth / 2
  const sourceCenterY = bounds.y + bounds.height / 2 - sourceHeight / 2
  const mirroredX = current.flipHorizontal ? -sourceCenterX : sourceCenterX
  const rotatedCenter = rotateVector(mirroredX, sourceCenterY, current.rotation)

  return {
    ...current,
    scale,
    offsetX: clamp((-rotatedCenter.x * absoluteScale) / (targetWidth / 2), -1, 1),
    offsetY: clamp((-rotatedCenter.y * absoluteScale) / (targetHeight / 2), -1, 1),
  }
}
