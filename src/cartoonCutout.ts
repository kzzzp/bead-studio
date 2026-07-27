type Rgb = readonly [number, number, number]

export interface CartoonCutoutResult {
  applied: boolean
  retainedFraction: number
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function hasUsablePersonMask(mask: Float32Array, threshold: number) {
  if (!mask.length) return false
  const safeThreshold = clamp(threshold, 0, 1)
  let foregroundPixels = 0
  for (const confidence of mask) {
    if (confidence >= safeThreshold) foregroundPixels += 1
  }
  return foregroundPixels >= Math.max(12, Math.ceil(mask.length * 0.005))
}

function median(values: number[]) {
  values.sort((a, b) => a - b)
  return values[Math.floor(values.length / 2)] ?? 0
}

function colorDistance(rgba: Uint8ClampedArray, pixel: number, reference: Rgb) {
  const offset = pixel * 4
  const red = rgba[offset] - reference[0]
  const green = rgba[offset + 1] - reference[1]
  const blue = rgba[offset + 2] - reference[2]
  return Math.sqrt(red * red + green * green + blue * blue)
}

function sampleCornerBackground(rgba: Uint8ClampedArray, width: number, height: number) {
  const patchWidth = Math.max(1, Math.round(width * 0.08))
  const patchHeight = Math.max(1, Math.round(height * 0.08))
  const step = Math.max(1, Math.floor(Math.min(patchWidth, patchHeight) / 12))
  const reds: number[] = []
  const greens: number[] = []
  const blues: number[] = []
  const samples: number[] = []

  const addPatch = (startX: number, startY: number) => {
    for (let y = startY; y < startY + patchHeight; y += step) {
      for (let x = startX; x < startX + patchWidth; x += step) {
        const pixel = y * width + x
        const offset = pixel * 4
        if (rgba[offset + 3] < 32) continue
        reds.push(rgba[offset])
        greens.push(rgba[offset + 1])
        blues.push(rgba[offset + 2])
        samples.push(pixel)
      }
    }
  }

  addPatch(0, 0)
  addPatch(width - patchWidth, 0)
  addPatch(0, height - patchHeight)
  addPatch(width - patchWidth, height - patchHeight)
  if (!samples.length) return null

  const reference: Rgb = [median(reds), median(greens), median(blues)]
  const distances = samples.map((pixel) => colorDistance(rgba, pixel, reference)).sort((a, b) => a - b)
  const typicalVariation = distances[Math.floor(distances.length * 0.6)] ?? 0
  return {
    reference,
    tolerance: clamp(typicalVariation + 16, 22, 46),
    simpleEnough: typicalVariation <= 32,
  }
}

function largestForegroundComponent(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  reference: Rgb,
  tolerance: number,
) {
  const total = width * height
  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  let largest: number[] = []

  for (let start = 0; start < total; start += 1) {
    if (visited[start] || rgba[start * 4 + 3] < 32 || colorDistance(rgba, start, reference) <= tolerance) {
      visited[start] = 1
      continue
    }

    const component: number[] = []
    let head = 0
    let tail = 0
    visited[start] = 1
    queue[tail++] = start
    while (head < tail) {
      const pixel = queue[head++]
      component.push(pixel)
      const x = pixel % width
      const y = Math.floor(pixel / width)
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if ((!offsetX && !offsetY) || x + offsetX < 0 || x + offsetX >= width || y + offsetY < 0 || y + offsetY >= height) continue
          const neighbor = pixel + offsetY * width + offsetX
          if (visited[neighbor]) continue
          visited[neighbor] = 1
          if (rgba[neighbor * 4 + 3] >= 32 && colorDistance(rgba, neighbor, reference) > tolerance) {
            queue[tail++] = neighbor
          }
        }
      }
    }
    if (component.length > largest.length) largest = component
  }
  return largest
}

function dilate(mask: Uint8Array, width: number, height: number) {
  const expanded = mask.slice()
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel]) continue
    const x = pixel % width
    const y = Math.floor(pixel / width)
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const nextX = x + offsetX
        const nextY = y + offsetY
        if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
          expanded[nextY * width + nextX] = 1
        }
      }
    }
  }
  return expanded
}

function findExterior(barrier: Uint8Array, width: number, height: number) {
  const exterior = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0
  const push = (pixel: number) => {
    if (barrier[pixel] || exterior[pixel]) return
    exterior[pixel] = 1
    queue[tail++] = pixel
  }
  for (let x = 0; x < width; x += 1) {
    push(x)
    push((height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    push(y * width)
    push(y * width + width - 1)
  }
  while (head < tail) {
    const pixel = queue[head++]
    const x = pixel % width
    const y = Math.floor(pixel / width)
    if (x > 0) push(pixel - 1)
    if (x < width - 1) push(pixel + 1)
    if (y > 0) push(pixel - width)
    if (y < height - 1) push(pixel + width)
  }
  return exterior
}

export function removeSimpleBackgroundFromRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): CartoonCutoutResult {
  if (width <= 0 || height <= 0 || rgba.length !== width * height * 4) {
    throw new Error('卡通抠图像素数据尺寸无效')
  }

  const background = sampleCornerBackground(rgba, width, height)
  if (!background?.simpleEnough) return { applied: false, retainedFraction: 1 }
  const component = largestForegroundComponent(
    rgba,
    width,
    height,
    background.reference,
    background.tolerance,
  )
  const total = width * height
  if (component.length < Math.max(8, Math.ceil(total * 0.003)) || component.length > total * 0.94) {
    return { applied: false, retainedFraction: 1 }
  }

  const subject = new Uint8Array(total)
  for (const pixel of component) subject[pixel] = 1
  const exterior = findExterior(dilate(subject, width, height), width, height)
  let retained = 0
  for (let pixel = 0; pixel < total; pixel += 1) {
    if (exterior[pixel]) rgba[pixel * 4 + 3] = 0
    else retained += 1
  }
  return { applied: true, retainedFraction: retained / total }
}
