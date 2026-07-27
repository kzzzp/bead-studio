export type LegendPosition = 'right' | 'bottom'

export interface PatternLayoutOptions {
  cellSize: number
  coordinates: boolean
  title: boolean
  legend: boolean
  legendPosition: LegendPosition
}

export interface PatternLayout {
  margin: number
  header: number
  width: number
  height: number
  originX: number
  originY: number
  gridWidth: number
  gridHeight: number
  legendX: number
  legendY: number
  legendWidth: number
  legendHeight: number
  legendColumns: number
  legendRows: number
  legendCardWidth: number
  legendCardHeight: number
  legendGap: number
  legendTitleHeight: number
}

export function measurePatternLayout(
  patternWidth: number,
  patternHeight: number,
  colorCount: number,
  options: PatternLayoutOptions,
): PatternLayout {
  const margin = options.coordinates ? Math.ceil(Math.max(28, options.cellSize * 0.95)) : 0
  const header = options.title ? 54 : 0
  const gridWidth = patternWidth * options.cellSize
  const gridHeight = patternHeight * options.cellSize
  const patternPixelHeight = header + margin * 2 + gridHeight
  const originX = margin
  const originY = header + margin

  if (!options.legend) {
    return {
      margin,
      header,
      width: margin * 2 + gridWidth,
      height: patternPixelHeight,
      originX,
      originY,
      gridWidth,
      gridHeight,
      legendX: 0,
      legendY: 0,
      legendWidth: 0,
      legendHeight: 0,
      legendColumns: 0,
      legendRows: 0,
      legendCardWidth: 0,
      legendCardHeight: 0,
      legendGap: 0,
      legendTitleHeight: 0,
    }
  }

  if (options.legendPosition === 'bottom') {
    const legendGap = Math.ceil(Math.max(16, options.cellSize * 0.22))
    const legendTitleHeight = Math.ceil(Math.max(40, options.cellSize * 0.58))
    const targetCardWidth = Math.ceil(Math.max(280, options.cellSize * 3.65))
    const legendColumns = Math.max(1, Math.min(colorCount || 1, Math.floor((gridWidth + legendGap) / (targetCardWidth + legendGap))))
    const legendRows = colorCount ? Math.ceil(colorCount / legendColumns) : 0
    const legendCardWidth = Math.floor((gridWidth - legendGap * (legendColumns - 1)) / legendColumns)
    const legendCardHeight = Math.ceil(Math.max(64, options.cellSize * 0.92))
    const cardsHeight = legendRows
      ? legendRows * legendCardHeight + (legendRows - 1) * legendGap
      : 0
    const legendHeight = legendGap + legendTitleHeight + (legendRows ? legendGap + cardsHeight : 0) + legendGap

    return {
      margin,
      header,
      width: margin * 2 + gridWidth,
      height: patternPixelHeight + legendHeight,
      originX,
      originY,
      gridWidth,
      gridHeight,
      legendX: originX,
      legendY: patternPixelHeight + legendGap,
      legendWidth: gridWidth,
      legendHeight,
      legendColumns,
      legendRows,
      legendCardWidth,
      legendCardHeight,
      legendGap,
      legendTitleHeight,
    }
  }

  const legendWidth = Math.ceil(Math.max(220, options.cellSize * 2.3))
  const legendHeight = header + margin * 2 + 44 + colorCount * 23
  return {
    margin,
    header,
    width: margin * 2 + gridWidth + legendWidth,
    height: Math.max(patternPixelHeight, legendHeight),
    originX,
    originY,
    gridWidth,
    gridHeight,
    legendX: originX + gridWidth + margin + 18,
    legendY: header + margin,
    legendWidth,
    legendHeight,
    legendColumns: 1,
    legendRows: colorCount,
    legendCardWidth: 0,
    legendCardHeight: 23,
    legendGap: 0,
    legendTitleHeight: 32,
  }
}
