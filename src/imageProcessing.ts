import { MARD_PALETTE, rgbToLab, type BeadColor, type Lab, type RGB } from './palette'

export interface ProcessOptions {
  width: number
  height: number
  maxColors: number
  brightness: number
  contrast: number
  saturation: number
  removeBackground: boolean
  backgroundTolerance: number
  dither: boolean
  fit: 'contain' | 'cover'
}

export interface PatternCell {
  color: BeadColor | null
}

export interface ColorUsage {
  color: BeadColor
  count: number
  percent: number
}

export interface BeadPattern {
  width: number
  height: number
  cells: PatternCell[]
  usage: ColorUsage[]
  totalBeads: number
}

const labDistanceSq = (a: Lab, b: Lab) => {
  const dl = a[0] - b[0]
  const da = a[1] - b[1]
  const db = a[2] - b[2]
  return dl * dl + da * da + db * db
}

const clamp = (value: number) => Math.max(0, Math.min(255, value))

function adjustRgb(rgb: RGB, options: ProcessOptions): RGB {
  let [r, g, b] = rgb
  const brightness = options.brightness * 2.55
  r += brightness
  g += brightness
  b += brightness

  const contrast = (259 * (options.contrast + 255)) / (255 * (259 - options.contrast))
  r = contrast * (r - 128) + 128
  g = contrast * (g - 128) + 128
  b = contrast * (b - 128) + 128

  const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722
  const saturation = options.saturation / 100
  r = luminance + (r - luminance) * saturation
  g = luminance + (g - luminance) * saturation
  b = luminance + (b - luminance) * saturation
  return [clamp(Math.round(r)), clamp(Math.round(g)), clamp(Math.round(b))]
}

function nearestColor(lab: Lab, palette: BeadColor[]) {
  let best = palette[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const color of palette) {
    const distance = labDistanceSq(lab, color.lab)
    if (distance < bestDistance) {
      best = color
      bestDistance = distance
    }
  }
  return best
}

function choosePalette(labs: Lab[], maxColors: number): BeadColor[] {
  if (!labs.length) return []
  const target = Math.max(1, Math.min(maxColors, MARD_PALETTE.length))
  const mean: Lab = [0, 0, 0]
  for (const lab of labs) {
    mean[0] += lab[0]
    mean[1] += lab[1]
    mean[2] += lab[2]
  }
  mean[0] /= labs.length
  mean[1] /= labs.length
  mean[2] /= labs.length

  const first = nearestColor(mean, MARD_PALETTE)
  const chosen = [first]
  const chosenCodes = new Set([first.code])
  const distances = labs.map((lab) => labDistanceSq(lab, first.lab))

  while (chosen.length < target) {
    let bestCandidate: BeadColor | null = null
    let bestImprovement = 0
    for (const candidate of MARD_PALETTE) {
      if (chosenCodes.has(candidate.code)) continue
      let improvement = 0
      for (let i = 0; i < labs.length; i += 1) {
        const candidateDistance = labDistanceSq(labs[i], candidate.lab)
        if (candidateDistance < distances[i]) improvement += distances[i] - candidateDistance
      }
      if (improvement > bestImprovement) {
        bestImprovement = improvement
        bestCandidate = candidate
      }
    }
    if (!bestCandidate || bestImprovement < 0.001) break
    chosen.push(bestCandidate)
    chosenCodes.add(bestCandidate.code)
    for (let i = 0; i < labs.length; i += 1) {
      distances[i] = Math.min(distances[i], labDistanceSq(labs[i], bestCandidate.lab))
    }
  }
  return chosen
}

function findBackground(pixels: RGB[], alpha: number[], width: number, height: number, tolerance: number) {
  const result = new Uint8Array(width * height)
  const borderIndexes: number[] = []
  for (let x = 0; x < width; x += 1) {
    borderIndexes.push(x, (height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    borderIndexes.push(y * width, y * width + width - 1)
  }
  const opaqueBorder = borderIndexes.filter((index) => alpha[index] >= 32)
  const referenceIndexes = opaqueBorder.length ? opaqueBorder : borderIndexes
  const reference: RGB = [0, 0, 0]
  for (const index of referenceIndexes) {
    reference[0] += pixels[index][0]
    reference[1] += pixels[index][1]
    reference[2] += pixels[index][2]
  }
  reference[0] = Math.round(reference[0] / referenceIndexes.length)
  reference[1] = Math.round(reference[1] / referenceIndexes.length)
  reference[2] = Math.round(reference[2] / referenceIndexes.length)
  const thresholdSq = tolerance * tolerance * 3
  const matches = (index: number) => {
    if (alpha[index] < 32) return true
    const color = pixels[index]
    const dr = color[0] - reference[0]
    const dg = color[1] - reference[1]
    const db = color[2] - reference[2]
    return dr * dr + dg * dg + db * db <= thresholdSq
  }

  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0
  const push = (index: number) => {
    if (result[index] || !matches(index)) return
    result[index] = 1
    queue[tail++] = index
  }
  for (let x = 0; x < width; x += 1) {
    push(x)
    push((height - 1) * width + x)
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width)
    push(y * width + width - 1)
  }
  while (head < tail) {
    const index = queue[head++]
    const x = index % width
    const y = Math.floor(index / width)
    if (x > 0) push(index - 1)
    if (x < width - 1) push(index + 1)
    if (y > 0) push(index - width)
    if (y < height - 1) push(index + width)
  }
  return result
}

function sampleImage(image: HTMLImageElement, options: ProcessOptions) {
  const canvas = document.createElement('canvas')
  canvas.width = options.width
  canvas.height = options.height
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  const sourceRatio = image.naturalWidth / image.naturalHeight
  const targetRatio = options.width / options.height
  let drawWidth = options.width
  let drawHeight = options.height
  let offsetX = 0
  let offsetY = 0
  if (options.fit === 'contain') {
    if (sourceRatio > targetRatio) {
      drawHeight = options.width / sourceRatio
      offsetY = (options.height - drawHeight) / 2
    } else {
      drawWidth = options.height * sourceRatio
      offsetX = (options.width - drawWidth) / 2
    }
  } else if (sourceRatio > targetRatio) {
    drawWidth = options.height * sourceRatio
    offsetX = (options.width - drawWidth) / 2
  } else {
    drawHeight = options.width / sourceRatio
    offsetY = (options.height - drawHeight) / 2
  }
  context.clearRect(0, 0, options.width, options.height)
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
  return context.getImageData(0, 0, options.width, options.height)
}

export function processImage(image: HTMLImageElement, options: ProcessOptions): BeadPattern {
  const imageData = sampleImage(image, options)
  const count = options.width * options.height
  const pixels: RGB[] = new Array(count)
  const alpha: number[] = new Array(count)
  for (let i = 0; i < count; i += 1) {
    const offset = i * 4
    pixels[i] = adjustRgb(
      [imageData.data[offset], imageData.data[offset + 1], imageData.data[offset + 2]],
      options,
    )
    alpha[i] = imageData.data[offset + 3]
  }

  const background = options.removeBackground
    ? findBackground(pixels, alpha, options.width, options.height, options.backgroundTolerance)
    : new Uint8Array(count)
  const labs: Lab[] = []
  for (let i = 0; i < count; i += 1) {
    if (alpha[i] >= 32 && !background[i]) labs.push(rgbToLab(pixels[i]))
  }
  const palette = choosePalette(labs, options.maxColors)
  const cells: PatternCell[] = new Array(count)

  if (options.dither && palette.length) {
    const work = new Float32Array(count * 3)
    pixels.forEach((pixel, index) => {
      work[index * 3] = pixel[0]
      work[index * 3 + 1] = pixel[1]
      work[index * 3 + 2] = pixel[2]
    })
    const addError = (index: number, er: number, eg: number, eb: number, weight: number) => {
      if (index < 0 || index >= count || background[index] || alpha[index] < 32) return
      work[index * 3] += er * weight
      work[index * 3 + 1] += eg * weight
      work[index * 3 + 2] += eb * weight
    }
    for (let y = 0; y < options.height; y += 1) {
      for (let x = 0; x < options.width; x += 1) {
        const index = y * options.width + x
        if (background[index] || alpha[index] < 32) {
          cells[index] = { color: null }
          continue
        }
        const rgb: RGB = [clamp(work[index * 3]), clamp(work[index * 3 + 1]), clamp(work[index * 3 + 2])]
        const color = nearestColor(rgbToLab(rgb), palette)
        cells[index] = { color }
        const er = rgb[0] - color.rgb[0]
        const eg = rgb[1] - color.rgb[1]
        const eb = rgb[2] - color.rgb[2]
        if (x < options.width - 1) addError(index + 1, er, eg, eb, 7 / 16)
        if (y < options.height - 1) {
          if (x > 0) addError(index + options.width - 1, er, eg, eb, 3 / 16)
          addError(index + options.width, er, eg, eb, 5 / 16)
          if (x < options.width - 1) addError(index + options.width + 1, er, eg, eb, 1 / 16)
        }
      }
    }
  } else {
    for (let i = 0; i < count; i += 1) {
      cells[i] = background[i] || alpha[i] < 32 || !palette.length
        ? { color: null }
        : { color: nearestColor(rgbToLab(pixels[i]), palette) }
    }
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
    .sort((a, b) => b.count - a.count)
    .map((item) => ({ ...item, percent: totalBeads ? item.count / totalBeads : 0 }))
  return { width: options.width, height: options.height, cells, usage, totalBeads }
}
