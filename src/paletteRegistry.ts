import { HAMA_PALETTE, PERLER_PALETTE } from './externalPalettes.generated.ts'
import { createBeadColor, MARD_PALETTE, type BeadColor } from './palette.ts'

export type BuiltInPaletteId = 'mard' | 'perler' | 'hama'

export interface PaletteDefinition {
  id: BuiltInPaletteId
  name: string
  detail: string
  colors: BeadColor[]
  sourceUrl: string
}

export const BUILT_IN_PALETTES: PaletteDefinition[] = [
  {
    id: 'mard',
    name: 'MARD 基础',
    detail: `${MARD_PALETTE.length} 色 · 当前项目原色卡`,
    colors: MARD_PALETTE,
    sourceUrl: '项目原有色卡',
  },
  {
    id: 'perler',
    name: 'Perler',
    detail: `${PERLER_PALETTE.length} 色 · MIT 开源参考值`,
    colors: PERLER_PALETTE,
    sourceUrl: 'https://github.com/maxcleme/beadcolors',
  },
  {
    id: 'hama',
    name: 'Hama Midi',
    detail: `${HAMA_PALETTE.length} 色 · MIT 开源参考值`,
    colors: HAMA_PALETTE,
    sourceUrl: 'https://github.com/maxcleme/beadcolors',
  },
]

export function getBuiltInPalette(id: BuiltInPaletteId) {
  return BUILT_IN_PALETTES.find((palette) => palette.id === id) ?? BUILT_IN_PALETTES[0]
}

type JsonColor = { code?: unknown; name?: unknown; hex?: unknown; r?: unknown; g?: unknown; b?: unknown }

const HEX_PATTERN = /^#[0-9A-F]{6}$/i

function rgbHex(r: number, g: number, b: number) {
  const values = [r, g, b]
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) throw new Error('RGB 颜色值必须是 0–255 的整数')
  return `#${values.map((value) => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

function validateRows(rows: Array<{ code: string; name?: string; hex: string }>) {
  if (!rows.length) throw new Error('色卡中没有可用颜色')
  const seen = new Set<string>()
  return rows.map((row) => {
    const code = row.code.trim()
    const hex = row.hex.trim().toUpperCase()
    if (!code) throw new Error('色号不能为空')
    if (seen.has(code)) throw new Error(`发现重复色号：${code}`)
    if (!HEX_PATTERN.test(hex)) throw new Error(`色号 ${code} 的颜色值必须是 #RRGGBB`)
    seen.add(code)
    return createBeadColor(code, hex, '自定义', row.name?.trim() || undefined)
  })
}

export function parseCustomPalette(content: string, format: 'json' | 'csv'): BeadColor[] {
  if (format === 'json') {
    let input: unknown
    try {
      input = JSON.parse(content)
    } catch {
      throw new Error('JSON 文件格式不正确')
    }
    if (!Array.isArray(input)) throw new Error('JSON 色卡必须是颜色数组')
    const rows = input.map((value, index) => {
      const row = value as JsonColor
      const code = typeof row.code === 'string' ? row.code : ''
      const name = typeof row.name === 'string' ? row.name : undefined
      if (typeof row.hex === 'string') return { code, name, hex: row.hex }
      if ([row.r, row.g, row.b].every((channel) => typeof channel === 'number')) {
        return { code, name, hex: rgbHex(row.r as number, row.g as number, row.b as number) }
      }
      throw new Error(`第 ${index + 1} 个颜色缺少有效颜色值`)
    })
    return validateRows(rows)
  }

  const rows = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [code = '', name = '', r = '', g = '', b = ''] = line.split(',').map((field) => field.trim())
      if (index === 0 && code.toLowerCase() === 'code') return null
      return { code, name, hex: rgbHex(Number(r), Number(g), Number(b)) }
    })
    .filter((row): row is { code: string; name: string; hex: string } => Boolean(row))
  return validateRows(rows)
}

export function removeDisabledColors(palette: BeadColor[], disabled: ReadonlySet<string>) {
  return palette.filter((color) => !disabled.has(color.code))
}

export function findClosestColors(source: BeadColor, target: BeadColor[], limit = 3) {
  return target
    .map((color) => ({
      color,
      distance: Math.sqrt(
        (source.lab[0] - color.lab[0]) ** 2
        + (source.lab[1] - color.lab[1]) ** 2
        + (source.lab[2] - color.lab[2]) ** 2,
      ),
    }))
    .sort((a, b) => a.distance - b.distance || a.color.code.localeCompare(b.color.code))
    .slice(0, Math.max(0, Math.floor(limit)))
}
