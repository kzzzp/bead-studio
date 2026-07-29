import type { BeadPattern, ProcessOptions } from './imageProcessing.ts'
import type { BeadColor } from './palette.ts'
import type { BuiltInPaletteId } from './paletteRegistry.ts'

export interface ProjectSnapshot {
  version: 1
  id: string
  name: string
  savedAt: string
  sourceName: string
  sourceDataUrl: string
  options: ProcessOptions
  paletteId: BuiltInPaletteId | 'custom'
  disabledPaletteColors: string[]
  customPalette: { name: string; colors: BeadColor[] } | null
  pattern: BeadPattern
  completedProgress: number[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const finiteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const validColor = (value: unknown) => {
  if (!isRecord(value) || typeof value.code !== 'string' || value.code.length > 40 || typeof value.hex !== 'string' || !/^#[0-9A-F]{6}$/i.test(value.hex) || typeof value.family !== 'string') return false
  return Array.isArray(value.rgb) && value.rgb.length === 3 && value.rgb.every((item) => finiteNumber(item) && item >= 0 && item <= 255)
    && Array.isArray(value.lab) && value.lab.length === 3 && value.lab.every(finiteNumber)
}

export function validateProjectSnapshot(input: unknown): ProjectSnapshot {
  if (!isRecord(input) || input.version !== 1) throw new Error('不支持的工程文件版本')
  if (typeof input.id !== 'string' || typeof input.name !== 'string' || typeof input.savedAt !== 'string') throw new Error('工程基本信息不完整')
  if (typeof input.sourceName !== 'string' || typeof input.sourceDataUrl !== 'string' || !input.sourceDataUrl.startsWith('data:image/') || input.sourceDataUrl.length > 30_000_000) throw new Error('工程图片数据无效')
  const options = input.options
  if (!isRecord(options)) throw new Error('工程转换参数无效')
  const transform = options.transform
  if (!Number.isInteger(options.width) || !Number.isInteger(options.height)
    || Number(options.width) <= 0 || Number(options.height) <= 0 || Number(options.width) > 120 || Number(options.height) > 120
    || !['maxColors', 'brightness', 'contrast', 'saturation', 'backgroundTolerance'].every((key) => finiteNumber(options[key]))
    || !['removeBackground', 'dither'].every((key) => typeof options[key] === 'boolean')
    || !['contain', 'cover'].includes(String(options.fit))
    || !['auto', 'cartoon', 'photo', 'pet', 'pixel', 'lineart'].includes(String(options.mode))
    || !isRecord(transform)
    || !['scale', 'offsetX', 'offsetY', 'rotation'].every((key) => finiteNumber(transform[key]))
    || typeof transform.flipHorizontal !== 'boolean') throw new Error('工程转换参数无效')
  if (!['mard', 'perler', 'hama', 'custom'].includes(String(input.paletteId))) throw new Error('工程色卡类型无效')
  if (!Array.isArray(input.disabledPaletteColors) || !input.disabledPaletteColors.every((code) => typeof code === 'string')) throw new Error('工程停用色号无效')
  if (input.customPalette !== null && (!isRecord(input.customPalette) || typeof input.customPalette.name !== 'string' || !Array.isArray(input.customPalette.colors) || input.customPalette.colors.length > 500 || !input.customPalette.colors.every(validColor))) throw new Error('工程自定义色卡无效')
  const pattern = input.pattern
  if (!isRecord(pattern) || !Number.isInteger(pattern.width) || !Number.isInteger(pattern.height) || Number(pattern.width) <= 0 || Number(pattern.height) <= 0 || Number(pattern.width) > 120 || Number(pattern.height) > 120 || !Array.isArray(pattern.cells) || !Array.isArray(pattern.usage) || pattern.usage.length > 500) throw new Error('工程图纸数据无效')
  const patternCells = pattern.cells as unknown[]
  const patternUsage = pattern.usage as unknown[]
  if (patternCells.length !== Number(pattern.width) * Number(pattern.height)) throw new Error('工程图纸尺寸不一致')
  if (!patternCells.every((cell) => isRecord(cell) && (cell.color === null || validColor(cell.color)))) throw new Error('工程格子颜色无效')
  if (!patternUsage.every((item) => isRecord(item) && validColor(item.color) && Number.isInteger(item.count) && finiteNumber(item.percent))) throw new Error('工程用量数据无效')
  const completedProgress = input.completedProgress === undefined ? [] : input.completedProgress
  if (!Array.isArray(completedProgress) || !completedProgress.every((index) => Number.isInteger(index) && Number(index) >= 0 && Number(index) < patternCells.length)) throw new Error('工程拼豆进度无效')
  return { ...(input as unknown as ProjectSnapshot), completedProgress }
}

export function duplicateProjectSnapshot(snapshot: ProjectSnapshot, id: string, savedAt: string): ProjectSnapshot {
  const copy = structuredClone(snapshot)
  return { ...copy, id, savedAt, name: `${snapshot.name} · 副本` }
}
