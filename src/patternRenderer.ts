import type { BeadPattern } from './imageProcessing'
import { measurePatternLayout, type LegendPosition } from './patternLayout.ts'

export interface DrawOptions {
  cellSize: number
  coordinates: boolean
  codes: boolean
  grid: boolean
  boardLines: boolean
  title?: string
  legend?: boolean
  pixelRatio?: number
  coordinateOffsetX?: number
  coordinateOffsetY?: number
  pixelText?: boolean
  legendPosition?: LegendPosition
  coordinateFontScale?: number
  codeFontScale?: number
  watermark?: {
    text: string
    opacity?: number
  }
}

function watermarkText(options: DrawOptions) {
  return options.watermark?.text.trim().slice(0, 60) ?? ''
}

function watermarkPositions(canvasWidth: number, canvasHeight: number) {
  const columns = [0.06, 0.5, 0.94]
  const rows = [0.15, 0.5, 0.85]
  return rows.flatMap((y) => columns.map((x) => ({ x: canvasWidth * x, y: canvasHeight * y })))
}

const PIXEL_GLYPHS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['110', '001', '111', '100', '111'],
  '3': ['110', '001', '111', '001', '110'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '110', '001', '110'],
  '6': ['011', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '110'],
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  M: ['101', '111', '111', '101', '101'],
}

function drawPixelText(
  context: CanvasRenderingContext2D,
  value: string,
  centerX: number,
  centerY: number,
  color: string,
  moduleSize: number,
) {
  const chars = [...value.toUpperCase()].filter((char) => PIXEL_GLYPHS[char])
  if (!chars.length) return
  const width = chars.length * 3 * moduleSize + (chars.length - 1) * moduleSize
  const height = 5 * moduleSize
  let startX = Math.round(centerX - width / 2)
  const startY = Math.round(centerY - height / 2)
  context.fillStyle = color
  for (const char of chars) {
    const glyph = PIXEL_GLYPHS[char]
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] === '1') {
          context.fillRect(startX + column * moduleSize, startY + row * moduleSize, moduleSize, moduleSize)
        }
      }
    }
    startX += 4 * moduleSize
  }
}

const contrastColor = (hex: string) => {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return r * 0.299 + g * 0.587 + b * 0.114 > 160 ? '#332f2a' : '#ffffff'
}

export function drawPattern(canvas: HTMLCanvasElement, pattern: BeadPattern, options: DrawOptions) {
  const legendPosition = options.legendPosition ?? 'right'
  const layout = measurePatternLayout(pattern.width, pattern.height, pattern.usage.length, {
    cellSize: options.cellSize,
    coordinates: options.coordinates,
    title: Boolean(options.title),
    legend: Boolean(options.legend),
    legendPosition,
  })
  const { width, height, margin, header, originX, originY } = layout
  const pixelRatio = Math.max(1, options.pixelRatio ?? 1)
  canvas.width = Math.ceil(width * pixelRatio)
  canvas.height = Math.ceil(height * pixelRatio)
  canvas.style.width = `${Math.ceil(width)}px`
  canvas.style.height = `${Math.ceil(height)}px`
  const context = canvas.getContext('2d')!
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.imageSmoothingEnabled = false
  context.fillStyle = '#fffefa'
  context.fillRect(0, 0, width, height)
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  if (options.title) {
    context.fillStyle = '#272822'
    context.textAlign = 'left'
    context.font = '700 20px system-ui, sans-serif'
    context.fillText(options.title, margin, 25)
    context.font = '12px system-ui, sans-serif'
    context.fillStyle = '#77766e'
    context.fillText(`${pattern.width} × ${pattern.height} · ${pattern.totalBeads} 颗 · ${pattern.usage.length} 色`, margin, 44)
    context.textAlign = 'center'
  }

  for (let y = 0; y < pattern.height; y += 1) {
    for (let x = 0; x < pattern.width; x += 1) {
      const cell = pattern.cells[y * pattern.width + x]
      const px = originX + x * options.cellSize
      const py = originY + y * options.cellSize
      context.fillStyle = cell.color?.hex ?? '#fffefa'
      context.fillRect(px, py, options.cellSize, options.cellSize)
      if (options.codes && cell.color && options.cellSize >= 16) {
        if (options.pixelText) {
          const length = cell.color.code.length
          const moduleSize = Math.max(2, Math.floor((options.cellSize - 8) / (length * 4 - 1)))
          drawPixelText(context, cell.color.code, px + options.cellSize / 2, py + options.cellSize / 2, contrastColor(cell.color.hex), moduleSize)
        } else {
          context.fillStyle = contrastColor(cell.color.hex)
          const codeFontSize = Math.max(11, options.cellSize * (options.codeFontScale ?? 0.46))
          context.font = `900 ${codeFontSize}px ui-monospace, SFMono-Regular, Consolas, monospace`
          context.fillText(cell.color.code, px + options.cellSize / 2, py + options.cellSize / 2 + 0.5)
        }
      }
    }
  }

  if (options.grid) {
    context.lineWidth = 1
    for (let x = 0; x <= pattern.width; x += 1) {
      context.strokeStyle = x % 10 === 0 ? '#aaa9a0' : '#deddd5'
      context.beginPath()
      context.moveTo(originX + x * options.cellSize + 0.5, originY)
      context.lineTo(originX + x * options.cellSize + 0.5, originY + pattern.height * options.cellSize)
      context.stroke()
    }
    for (let y = 0; y <= pattern.height; y += 1) {
      context.strokeStyle = y % 10 === 0 ? '#aaa9a0' : '#deddd5'
      context.beginPath()
      context.moveTo(originX, originY + y * options.cellSize + 0.5)
      context.lineTo(originX + pattern.width * options.cellSize, originY + y * options.cellSize + 0.5)
      context.stroke()
    }
  }

  if (options.boardLines) {
    context.lineWidth = 2
    context.strokeStyle = 'rgba(229, 102, 76, .72)'
    for (let x = 29; x < pattern.width; x += 29) {
      context.beginPath()
      context.moveTo(originX + x * options.cellSize, originY)
      context.lineTo(originX + x * options.cellSize, originY + pattern.height * options.cellSize)
      context.stroke()
    }
    for (let y = 29; y < pattern.height; y += 29) {
      context.beginPath()
      context.moveTo(originX, originY + y * options.cellSize)
      context.lineTo(originX + pattern.width * options.cellSize, originY + y * options.cellSize)
      context.stroke()
    }
  }

  if (options.coordinates) {
    const offsetX = options.coordinateOffsetX ?? 0
    const offsetY = options.coordinateOffsetY ?? 0
    const coordinateModule = Math.max(2, Math.min(4, Math.floor(options.cellSize / 12)))
    const coordinateFontSize = options.coordinateFontScale
      ? Math.max(12, options.cellSize * options.coordinateFontScale)
      : Math.max(12, Math.min(18, options.cellSize * 0.48))
    context.fillStyle = '#565750'
    context.font = `800 ${coordinateFontSize}px system-ui, sans-serif`
    for (let x = 0; x < pattern.width; x += 1) {
      const px = originX + x * options.cellSize + options.cellSize / 2
      const value = String(x + 1 + offsetX)
      if (options.pixelText) {
        drawPixelText(context, value, px, originY - margin / 2, '#565750', coordinateModule)
        drawPixelText(context, value, px, originY + pattern.height * options.cellSize + margin / 2, '#565750', coordinateModule)
      } else {
        context.fillText(value, px, originY - margin / 2)
        context.fillText(value, px, originY + pattern.height * options.cellSize + margin / 2)
      }
    }
    for (let y = 0; y < pattern.height; y += 1) {
      const py = originY + y * options.cellSize + options.cellSize / 2
      const value = String(y + 1 + offsetY)
      if (options.pixelText) {
        drawPixelText(context, value, originX - margin / 2, py, '#565750', coordinateModule)
        drawPixelText(context, value, originX + pattern.width * options.cellSize + margin / 2, py, '#565750', coordinateModule)
      } else {
        context.fillText(value, originX - margin / 2, py)
        context.fillText(value, originX + pattern.width * options.cellSize + margin / 2, py)
      }
    }
  }

  if (options.legend) {
    context.textAlign = 'left'
    if (legendPosition === 'bottom') {
      context.fillStyle = '#272822'
      context.font = `800 ${Math.max(20, options.cellSize * 0.32)}px system-ui, sans-serif`
      context.fillText(`用豆清单 · ${pattern.usage.length} 色 · 共 ${pattern.totalBeads} 颗`, layout.legendX, layout.legendY + layout.legendTitleHeight / 2)

      const cardsY = layout.legendY + layout.legendTitleHeight + layout.legendGap
      pattern.usage.forEach((item, index) => {
        const column = index % layout.legendColumns
        const row = Math.floor(index / layout.legendColumns)
        const x = layout.legendX + column * (layout.legendCardWidth + layout.legendGap)
        const y = cardsY + row * (layout.legendCardHeight + layout.legendGap)
        const textColor = contrastColor(item.color.hex)
        const radius = Math.max(5, Math.min(12, layout.legendCardHeight * 0.18))

        context.fillStyle = item.color.hex
        context.beginPath()
        context.roundRect(x, y, layout.legendCardWidth, layout.legendCardHeight, radius)
        context.fill()
        context.strokeStyle = 'rgba(45, 45, 40, .16)'
        context.lineWidth = 1
        context.stroke()

        context.fillStyle = textColor
        context.font = `900 ${Math.max(22, layout.legendCardHeight * 0.5)}px ui-monospace, SFMono-Regular, Consolas, monospace`
        context.fillText(item.color.code, x + layout.legendCardHeight * 0.28, y + layout.legendCardHeight / 2)
        context.textAlign = 'right'
        context.font = `800 ${Math.max(18, layout.legendCardHeight * 0.34)}px system-ui, sans-serif`
        context.fillText(`${item.count} 颗`, x + layout.legendCardWidth - layout.legendCardHeight * 0.25, y + layout.legendCardHeight / 2)
        context.textAlign = 'left'
      })
    } else {
      let y = layout.legendY
      context.fillStyle = '#272822'
      context.font = '700 14px system-ui, sans-serif'
      context.fillText('用豆清单', layout.legendX, y + 8)
      y += 32
      for (const item of pattern.usage) {
        context.fillStyle = item.color.hex
        context.beginPath()
        context.arc(layout.legendX + 7, y, 7, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = '#30312c'
        context.font = '600 12px ui-monospace, SFMono-Regular, Consolas, monospace'
        context.fillText(item.color.code, layout.legendX + 22, y)
        context.fillStyle = '#77766e'
        context.font = '12px system-ui, sans-serif'
        context.fillText(`${item.count} 颗`, layout.legendX + 78, y)
        y += 23
        if (y > height - 18) break
      }
    }
  }

  const watermark = watermarkText(options)
  if (watermark) {
    let fontSize = Math.max(28, Math.min(170, options.cellSize * 1.55))
    context.save()
    context.globalAlpha = Math.max(0.1, Math.min(0.3, options.watermark?.opacity ?? 0.18))
    context.fillStyle = '#656a67'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = `700 ${fontSize}px system-ui, sans-serif`
    const measuredWidth = context.measureText(watermark).width
    if (measuredWidth > width * 0.74) {
      fontSize = Math.max(24, fontSize * (width * 0.74 / measuredWidth))
      context.font = `700 ${fontSize}px system-ui, sans-serif`
    }
    for (const position of watermarkPositions(width, height)) {
      context.save()
      context.translate(position.x, position.y)
      context.rotate(-32 * Math.PI / 180)
      context.fillText(watermark, 0, 0)
      context.restore()
    }
    context.restore()
  }
}

const escapeXml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

export function createPatternSvg(pattern: BeadPattern, options: Omit<DrawOptions, 'pixelRatio'>) {
  const margin = options.coordinates ? Math.ceil(Math.max(32, options.cellSize * 1.35)) : 0
  const header = options.title ? 64 : 0
  const legendWidth = options.legend ? 250 : 0
  const width = margin * 2 + pattern.width * options.cellSize + legendWidth
  const patternHeight = header + margin * 2 + pattern.height * options.cellSize
  const legendHeight = options.legend ? header + margin * 2 + 50 + pattern.usage.length * 26 : 0
  const height = Math.max(patternHeight, legendHeight)
  const originX = margin
  const originY = header + margin
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="#fffefa"/>',
  ]

  if (options.title) {
    parts.push(`<text x="${margin}" y="26" fill="#272822" font-family="system-ui,sans-serif" font-size="22" font-weight="700">${escapeXml(options.title)}</text>`)
    parts.push(`<text x="${margin}" y="49" fill="#77766e" font-family="system-ui,sans-serif" font-size="13">${pattern.width} × ${pattern.height} · ${pattern.totalBeads} 颗 · ${pattern.usage.length} 色</text>`)
  }

  for (let y = 0; y < pattern.height; y += 1) {
    for (let x = 0; x < pattern.width; x += 1) {
      const cell = pattern.cells[y * pattern.width + x]
      const px = originX + x * options.cellSize
      const py = originY + y * options.cellSize
      parts.push(`<rect x="${px}" y="${py}" width="${options.cellSize}" height="${options.cellSize}" fill="${cell.color?.hex ?? '#fffefa'}"/>`)
      if (options.codes && cell.color) {
        parts.push(`<text x="${px + options.cellSize / 2}" y="${py + options.cellSize / 2}" fill="${contrastColor(cell.color.hex)}" font-family="ui-monospace,Consolas,monospace" font-size="${Math.max(11, options.cellSize * 0.46)}" font-weight="800" text-anchor="middle" dominant-baseline="central">${cell.color.code}</text>`)
      }
    }
  }

  if (options.grid) {
    for (let x = 0; x <= pattern.width; x += 1) {
      const px = originX + x * options.cellSize
      parts.push(`<line x1="${px}" y1="${originY}" x2="${px}" y2="${originY + pattern.height * options.cellSize}" stroke="${x % 10 === 0 ? '#aaa9a0' : '#deddd5'}" stroke-width="1"/>`)
    }
    for (let y = 0; y <= pattern.height; y += 1) {
      const py = originY + y * options.cellSize
      parts.push(`<line x1="${originX}" y1="${py}" x2="${originX + pattern.width * options.cellSize}" y2="${py}" stroke="${y % 10 === 0 ? '#aaa9a0' : '#deddd5'}" stroke-width="1"/>`)
    }
  }

  if (options.boardLines) {
    for (let x = 29; x < pattern.width; x += 29) {
      const px = originX + x * options.cellSize
      parts.push(`<line x1="${px}" y1="${originY}" x2="${px}" y2="${originY + pattern.height * options.cellSize}" stroke="#e5664c" stroke-width="2"/>`)
    }
    for (let y = 29; y < pattern.height; y += 29) {
      const py = originY + y * options.cellSize
      parts.push(`<line x1="${originX}" y1="${py}" x2="${originX + pattern.width * options.cellSize}" y2="${py}" stroke="#e5664c" stroke-width="2"/>`)
    }
  }

  if (options.coordinates) {
    const offsetX = options.coordinateOffsetX ?? 0
    const offsetY = options.coordinateOffsetY ?? 0
    const fontSize = Math.max(13, Math.min(18, options.cellSize * 0.48))
    for (let x = 0; x < pattern.width; x += 1) {
      const px = originX + x * options.cellSize + options.cellSize / 2
      parts.push(`<text x="${px}" y="${originY - margin / 2}" fill="#565750" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" dominant-baseline="central">${x + 1 + offsetX}</text>`)
      parts.push(`<text x="${px}" y="${originY + pattern.height * options.cellSize + margin / 2}" fill="#565750" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" dominant-baseline="central">${x + 1 + offsetX}</text>`)
    }
    for (let y = 0; y < pattern.height; y += 1) {
      const py = originY + y * options.cellSize + options.cellSize / 2
      parts.push(`<text x="${originX - margin / 2}" y="${py}" fill="#565750" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" dominant-baseline="central">${y + 1 + offsetY}</text>`)
      parts.push(`<text x="${originX + pattern.width * options.cellSize + margin / 2}" y="${py}" fill="#565750" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" dominant-baseline="central">${y + 1 + offsetY}</text>`)
    }
  }

  if (options.legend) {
    const legendX = originX + pattern.width * options.cellSize + margin + 20
    let y = header + margin + 10
    parts.push(`<text x="${legendX}" y="${y}" fill="#272822" font-family="system-ui,sans-serif" font-size="16" font-weight="700">用豆清单</text>`)
    y += 30
    for (const item of pattern.usage) {
      parts.push(`<circle cx="${legendX + 8}" cy="${y}" r="8" fill="${item.color.hex}"/>`)
      parts.push(`<text x="${legendX + 24}" y="${y}" fill="#30312c" font-family="ui-monospace,Consolas,monospace" font-size="13" font-weight="700" dominant-baseline="central">${item.color.code}</text>`)
      parts.push(`<text x="${legendX + 86}" y="${y}" fill="#77766e" font-family="system-ui,sans-serif" font-size="13" dominant-baseline="central">${item.count} 颗</text>`)
      y += 26
    }
  }


  const watermark = watermarkText(options)
  if (watermark) {
    let fontSize = Math.max(28, Math.min(170, options.cellSize * 1.55))
    const approximateTextWidth = watermark.length * fontSize * 0.62
    if (approximateTextWidth > width * 0.74) {
      fontSize = Math.max(24, fontSize * (width * 0.74 / approximateTextWidth))
    }
    const opacity = Math.max(0.1, Math.min(0.3, options.watermark?.opacity ?? 0.18))
    for (const position of watermarkPositions(width, height)) {
      parts.push(`<text x="${position.x}" y="${position.y}" fill="#656a67" fill-opacity="${opacity}" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" dominant-baseline="central" transform="rotate(-32 ${position.x} ${position.y})">${escapeXml(watermark)}</text>`)
    }
  }

  parts.push('</svg>')
  return parts.join('')
}

export function downloadText(content: string, mimeType: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = filename
    link.href = url
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}

export function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG 生成失败')), 'image/png')
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
