import { measurePatternLayout, type LegendPosition } from './patternLayout.ts'

const TARGET_CELL_SIZE = 96
const MIN_CELL_SIZE = 32
const MAX_CANVAS_EDGE = 12_288
const MAX_CANVAS_PIXELS = 64_000_000

export type FullExportPlan = {
  cellSize: number
  pixelWidth: number
  pixelHeight: number
  pixelText: boolean
  legendPosition: LegendPosition
  coordinateFontScale: number
  codeFontScale: number
}

function measureExport(width: number, height: number, colorCount: number, cellSize: number): FullExportPlan {
  const layout = measurePatternLayout(width, height, colorCount, {
    cellSize,
    coordinates: true,
    title: false,
    legend: true,
    legendPosition: 'bottom',
  })

  return {
    cellSize,
    pixelWidth: layout.width,
    pixelHeight: layout.height,
    pixelText: false,
    legendPosition: 'bottom',
    coordinateFontScale: 0.56,
    codeFontScale: 0.52,
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
