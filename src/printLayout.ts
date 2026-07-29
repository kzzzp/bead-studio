export type PaperSize = 'a4' | 'a3'
export type PrintOrientation = 'portrait' | 'landscape'

export interface PrintLayoutOptions {
  paper: PaperSize
  orientation: PrintOrientation
  beadSizeMm: 2.6 | 5
  overlapCells: number
}

export interface PrintPage {
  index: number
  column: number
  row: number
  startX: number
  startY: number
  width: number
  height: number
  widthMm: number
  heightMm: number
  overlapsLeft: boolean
  overlapsTop: boolean
  overlapsRight: boolean
  overlapsBottom: boolean
}

const PAPER_MM: Record<PaperSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
}

export const PRINT_MARGIN_MM = 12
export const PRINT_HEADER_MM = 20

export function createPrintLayout(patternWidth: number, patternHeight: number, options: PrintLayoutOptions) {
  const basePaper = PAPER_MM[options.paper]
  const paperSizeMm = options.orientation === 'portrait'
    ? basePaper
    : { width: basePaper.height, height: basePaper.width }
  const cellsPerPage = {
    width: Math.max(1, Math.floor((paperSizeMm.width - PRINT_MARGIN_MM * 2) / options.beadSizeMm)),
    height: Math.max(1, Math.floor((paperSizeMm.height - PRINT_MARGIN_MM * 2 - PRINT_HEADER_MM) / options.beadSizeMm)),
  }
  const overlapCells = Math.max(0, Math.min(Math.floor(options.overlapCells), cellsPerPage.width - 1, cellsPerPage.height - 1))
  const stepX = Math.max(1, cellsPerPage.width - overlapCells)
  const stepY = Math.max(1, cellsPerPage.height - overlapCells)
  const startsX: number[] = []
  const startsY: number[] = []
  for (let x = 0; x < patternWidth; x += stepX) startsX.push(x)
  for (let y = 0; y < patternHeight; y += stepY) startsY.push(y)
  const pages: PrintPage[] = []
  for (let row = 0; row < startsY.length; row += 1) {
    for (let column = 0; column < startsX.length; column += 1) {
      const startX = startsX[column]
      const startY = startsY[row]
      const width = Math.min(cellsPerPage.width, patternWidth - startX)
      const height = Math.min(cellsPerPage.height, patternHeight - startY)
      pages.push({
        index: pages.length,
        column,
        row,
        startX,
        startY,
        width,
        height,
        widthMm: width * options.beadSizeMm,
        heightMm: height * options.beadSizeMm,
        overlapsLeft: column > 0,
        overlapsTop: row > 0,
        overlapsRight: column < startsX.length - 1,
        overlapsBottom: row < startsY.length - 1,
      })
    }
  }

  return {
    paperSizeMm,
    cellsPerPage,
    overlapCells,
    pages,
    columns: startsX.length,
    rows: startsY.length,
    marginMm: PRINT_MARGIN_MM,
    headerMm: PRINT_HEADER_MM,
    beadSizeMm: options.beadSizeMm,
  }
}
