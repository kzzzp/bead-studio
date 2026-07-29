import type { RGB } from './palette.ts'

export type ConversionMode = 'auto' | 'cartoon' | 'photo' | 'pet' | 'pixel' | 'lineart'

export const CONVERSION_MODES: Array<{ id: ConversionMode; label: string; description: string }> = [
  { id: 'auto', label: '自动', description: '保留当前素材风格，适合作为默认起点' },
  { id: 'cartoon', label: '卡通', description: '增强纯色分区，减少模糊过渡' },
  { id: 'photo', label: '真人照片', description: '保留肤色与明暗层次' },
  { id: 'pet', label: '宠物', description: '加强毛发与五官对比' },
  { id: 'pixel', label: '像素原图', description: '关闭平滑，尽量逐格还原' },
  { id: 'lineart', label: '线稿', description: '转成清晰黑白轮廓' },
]

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)))

function saturate([red, green, blue]: RGB, amount: number): RGB {
  const luminance = red * .2126 + green * .7152 + blue * .0722
  return [
    clamp(luminance + (red - luminance) * amount),
    clamp(luminance + (green - luminance) * amount),
    clamp(luminance + (blue - luminance) * amount),
  ]
}

export function applyConversionMode(rgb: RGB, mode: ConversionMode): RGB {
  if (mode === 'lineart') {
    const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
    const value = luminance < 176 ? 28 : 248
    return [value, value, value]
  }
  if (mode === 'cartoon') {
    return saturate(rgb.map((channel) => clamp(Math.round(channel / 32) * 32)) as RGB, 1.16)
  }
  if (mode === 'pet') {
    const contrasted = rgb.map((channel) => clamp((channel - 128) * 1.12 + 132)) as RGB
    return saturate(contrasted, 1.08)
  }
  return rgb
}
