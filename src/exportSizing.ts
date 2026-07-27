const TARGET_CELL_SIZE = 96
const MIN_CELL_SIZE = 32
const MAX_CANVAS_EDGE = 12_288
const MAX_CANVAS_PIXELS = 64_000_000

export type FullExportPlan = {
  cellSize: number
  pixelWidth: number
  pixelHeight: number
  pixelText: boolean
}

function measureExport(width: number, height: number, colorCount: number, cellSize: number): FullExportPlan {
  const margin = Math.ceil(Math.max(28, cellSize * 1.35))
  const pixelWidth = margin * 2 + width * cellSize + 220
  const patternHeight = margin * 2 + height * cellSize
  const legendHeight = margin * 2 + 44 + colorCount * 23

  return {
    cellSize,
    pixelWidth,
    pixelHeight: Math.max(patternHeight, legendHeight),
    pixelText: false,
  }
}

export function createFullExportPlan(width: number, height: number, colorCount: number): FullExportPlan {
  for (let cellSize = TARGET_CELL_SIZE; cellSize >= MIN_CELL_SIZE; cellSize -= 1) {
    const plan = measureExport(width, height, colorCount, cellSize)
    const fitsEdgeLimit = plan.pixelWidth <= MAX_CANVAS_EDGE && plan.pixelHeight <= MAX_CANVAS_EDGE
    const fitsPixelLimit = plan.pixelWidth * plan.pixelHeight <= MAX_CANVAS_PIXELS

    if (fitsEdgeLimit && fitsPixelLimit) return plan
  }

  throw new Error('图纸尺寸超过单张图片的安全导出范围')
}
