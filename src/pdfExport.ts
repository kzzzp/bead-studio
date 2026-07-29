import { jsPDF } from 'jspdf'
import type { BeadPattern } from './imageProcessing.ts'
import { createPrintLayout, type PaperSize, type PrintOrientation } from './printLayout.ts'

export interface PhysicalPdfOptions {
  paper: PaperSize
  orientation: PrintOrientation
  beadSizeMm: 2.6 | 5
  overlapCells: number
  paletteName: string
  mirrored: boolean
}

function textColor(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16)
  const green = Number.parseInt(hex.slice(3, 5), 16)
  const blue = Number.parseInt(hex.slice(5, 7), 16)
  return red * .299 + green * .587 + blue * .114 > 155 ? [45, 45, 45] : [255, 255, 255]
}

function drawAlignmentCross(pdf: jsPDF, x: number, y: number) {
  pdf.setDrawColor(35, 48, 40)
  pdf.setLineWidth(.22)
  pdf.line(x - 2.5, y, x + 2.5, y)
  pdf.line(x, y - 2.5, x, y + 2.5)
  pdf.circle(x, y, 1.3, 'S')
}

export function createPhysicalPdfBlob(pattern: BeadPattern, options: PhysicalPdfOptions) {
  const layout = createPrintLayout(pattern.width, pattern.height, options)
  const pdf = new jsPDF({
    orientation: options.orientation,
    unit: 'mm',
    format: options.paper,
    compress: true,
    putOnlyUsedFonts: true,
    floatPrecision: 16,
  })
  const symbolByCode = new Map(pattern.usage.map((item, index) => [item.color.code, String(index + 1)]))

  layout.pages.forEach((page, pageIndex) => {
    if (pageIndex) pdf.addPage(options.paper, options.orientation)
    const gridX = layout.marginMm
    const gridY = layout.marginMm + layout.headerMm
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(35, 48, 40)
    pdf.text(`BEAD STUDIO  |  ${pattern.width} x ${pattern.height}  |  ${options.paletteName}`, gridX, layout.marginMm)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.text(`Page ${pageIndex + 1}/${layout.pages.length}  |  100%  |  cell ${options.beadSizeMm} mm  |  origin ${page.startX + 1},${page.startY + 1}${options.mirrored ? '  |  MIRRORED' : ''}`, gridX, layout.marginMm + 5)

    for (let y = 0; y < page.height; y += 1) {
      for (let x = 0; x < page.width; x += 1) {
        const cell = pattern.cells[(page.startY + y) * pattern.width + page.startX + x]
        const left = gridX + x * options.beadSizeMm
        const top = gridY + y * options.beadSizeMm
        if (cell.color) {
          pdf.setFillColor(...cell.color.rgb)
          pdf.setDrawColor(185, 185, 180)
          pdf.rect(left, top, options.beadSizeMm, options.beadSizeMm, 'FD')
          const directCode = cell.color.code.length <= (options.beadSizeMm === 5 ? 6 : 3)
          const label = directCode ? cell.color.code : symbolByCode.get(cell.color.code) ?? ''
          const color = textColor(cell.color.hex)
          pdf.setTextColor(color[0], color[1], color[2])
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(options.beadSizeMm === 5 ? (directCode ? 4.2 : 5.2) : (directCode ? 2.8 : 3.3))
          pdf.text(label, left + options.beadSizeMm / 2, top + options.beadSizeMm * .64, { align: 'center' })
        } else {
          pdf.setFillColor(255, 255, 255)
          pdf.setDrawColor(218, 218, 214)
          pdf.rect(left, top, options.beadSizeMm, options.beadSizeMm, 'FD')
        }
      }
    }

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(5)
    pdf.setTextColor(70, 74, 69)
    for (let x = 0; x < page.width; x += 5) pdf.text(String(page.startX + x + 1), gridX + (x + .5) * options.beadSizeMm, gridY - 1.4, { align: 'center' })
    for (let y = 0; y < page.height; y += 5) pdf.text(String(page.startY + y + 1), gridX - 1.4, gridY + (y + .65) * options.beadSizeMm, { align: 'right' })

    const gridWidth = page.widthMm
    const gridHeight = page.heightMm
    drawAlignmentCross(pdf, gridX, gridY)
    drawAlignmentCross(pdf, gridX + gridWidth, gridY)
    drawAlignmentCross(pdf, gridX, gridY + gridHeight)
    drawAlignmentCross(pdf, gridX + gridWidth, gridY + gridHeight)
    pdf.setDrawColor(58, 111, 82)
    pdf.setLineWidth(.5)
    pdf.setLineDashPattern([2, 1.2], 0)
    if (page.overlapsLeft) pdf.line(gridX + layout.overlapCells * options.beadSizeMm, gridY, gridX + layout.overlapCells * options.beadSizeMm, gridY + gridHeight)
    if (page.overlapsTop) pdf.line(gridX, gridY + layout.overlapCells * options.beadSizeMm, gridX + gridWidth, gridY + layout.overlapCells * options.beadSizeMm)
    if (page.overlapsRight) pdf.line(gridX + gridWidth - layout.overlapCells * options.beadSizeMm, gridY, gridX + gridWidth - layout.overlapCells * options.beadSizeMm, gridY + gridHeight)
    if (page.overlapsBottom) pdf.line(gridX, gridY + gridHeight - layout.overlapCells * options.beadSizeMm, gridX + gridWidth, gridY + gridHeight - layout.overlapCells * options.beadSizeMm)
    pdf.setLineDashPattern([], 0)
  })

  pdf.addPage(options.paper, options.orientation)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.setTextColor(35, 48, 40)
  pdf.text(`COLOR LEGEND  |  ${options.paletteName}`, layout.marginMm, layout.marginMm + 2)
  const cardWidth = 43
  const cardHeight = 10
  const columns = Math.max(1, Math.floor((layout.paperSizeMm.width - layout.marginMm * 2) / cardWidth))
  pattern.usage.forEach((item, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = layout.marginMm + column * cardWidth
    const y = layout.marginMm + 9 + row * cardHeight
    if (y + cardHeight > layout.paperSizeMm.height - layout.marginMm) return
    pdf.setFillColor(...item.color.rgb)
    pdf.setDrawColor(205, 205, 200)
    pdf.roundedRect(x, y, 8, 7, 1, 1, 'FD')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(40, 42, 39)
    pdf.text(`${symbolByCode.get(item.color.code)}  ${item.color.code}`, x + 10, y + 3)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6)
    pdf.text(`${item.count} beads${item.color.name ? `  |  ${item.color.name}` : ''}`, x + 10, y + 6.2)
  })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(95, 97, 91)
  pdf.text('Print at Actual Size / 100%. Disable Fit to Page in the print dialog.', layout.marginMm, layout.paperSizeMm.height - 8)

  return { blob: pdf.output('blob'), layout }
}
