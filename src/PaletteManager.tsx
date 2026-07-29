import { Check, FileUp, LockKeyhole, Palette, Power, X } from 'lucide-react'
import { useRef, useState } from 'react'
import {
  BUILT_IN_PALETTES,
  parseCustomPalette,
  type BuiltInPaletteId,
  type PaletteDefinition,
} from './paletteRegistry.ts'
import type { BeadColor } from './palette.ts'

export interface CustomPaletteDefinition {
  name: string
  colors: BeadColor[]
}

interface PaletteManagerProps {
  selectedId: BuiltInPaletteId | 'custom'
  selectedPalette: PaletteDefinition | CustomPaletteDefinition
  customPalette: CustomPaletteDefinition | null
  disabledCodes: ReadonlySet<string>
  onSelect: (id: BuiltInPaletteId | 'custom') => void
  onImport: (palette: CustomPaletteDefinition) => void
  onToggleColor: (code: string) => void
  onEnableAll: () => void
  onClose: () => void
}

const unavailableBrands = ['COCO', '漫漫', '盼盼']

export function PaletteManager({
  selectedId,
  selectedPalette,
  customPalette,
  disabledCodes,
  onSelect,
  onImport,
  onToggleColor,
  onEnableAll,
  onClose,
}: PaletteManagerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [customName, setCustomName] = useState(customPalette?.name ?? '我的色卡')
  const [message, setMessage] = useState('CSV：code,name,r,g,b；JSON：[{ code, name, hex }]')

  const importFile = async (file?: File) => {
    if (!file) return
    const format = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv'
    try {
      const colors = parseCustomPalette(await file.text(), format)
      const palette = { name: customName.trim() || file.name.replace(/\.[^.]+$/, ''), colors }
      onImport(palette)
      setMessage(`已导入 ${colors.length} 色：${palette.name}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '色卡导入失败')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="palette-manager-backdrop" role="presentation">
      <section className="palette-manager" role="dialog" aria-modal="true" aria-labelledby="palette-manager-title">
        <header>
          <div><strong id="palette-manager-title">色卡管理</strong><span>选择实际使用的豆子品牌，或导入你自己的色卡。</span></div>
          <button type="button" className="editor-icon-button" onClick={onClose} aria-label="关闭色卡管理"><X size={18} /></button>
        </header>
        <div className="palette-manager-body">
          <aside>
            <h3>内置色卡</h3>
            {BUILT_IN_PALETTES.map((palette) => (
              <button key={palette.id} type="button" className={selectedId === palette.id ? 'is-active' : ''} onClick={() => onSelect(palette.id)}>
                <span><b>{palette.name}</b><small>{palette.detail}</small></span>{selectedId === palette.id && <Check size={16} />}
              </button>
            ))}
            <h3>等待授权数据</h3>
            {unavailableBrands.map((brand) => <div className="unavailable-palette" key={brand}><span><b>{brand}</b><small>可先导入官方 CSV / JSON 使用</small></span><LockKeyhole size={14} /></div>)}
            {customPalette && <button type="button" className={selectedId === 'custom' ? 'is-active' : ''} onClick={() => onSelect('custom')}><span><b>{customPalette.name}</b><small>{customPalette.colors.length} 色 · 本地自定义</small></span>{selectedId === 'custom' && <Check size={16} />}</button>}
          </aside>
          <main>
            <div className="palette-manager-summary">
              <span className="palette-manager-icon"><Palette size={20} /></span>
              <div><strong>{selectedPalette.name}</strong><span>{selectedPalette.colors.length - disabledCodes.size} / {selectedPalette.colors.length} 色可用</span></div>
              <button type="button" onClick={onEnableAll} disabled={!disabledCodes.size}><Power size={14} /> 全部启用</button>
            </div>
            <div className="palette-color-grid" aria-label={`${selectedPalette.name} 颜色开关`}>
              {selectedPalette.colors.map((color) => {
                const disabled = disabledCodes.has(color.code)
                return <button key={color.code} type="button" className={disabled ? 'is-disabled' : ''} onClick={() => onToggleColor(color.code)} title={`${color.code}${color.name ? ` · ${color.name}` : ''}`} aria-pressed={!disabled}><i style={{ background: color.hex }} /><b>{color.code}</b></button>
              })}
            </div>
            <section className="custom-palette-import">
              <div><strong>导入自定义色卡</strong><span>适合 COCO、漫漫、盼盼或你自己的库存色号。</span></div>
              <label><span>色卡名称</span><input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="例如：COCO 官方色卡" /></label>
              <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={(event) => importFile(event.target.files?.[0])} />
              <button type="button" onClick={() => fileRef.current?.click()}><FileUp size={15} /> 选择 CSV / JSON</button>
              <p role="status">{message}</p>
            </section>
          </main>
        </div>
        <footer><span>屏幕 RGB 仅用于近似匹配，实物颜色会受批次、光线与显示器影响。</span><button type="button" className="primary-button" onClick={onClose}>完成</button></footer>
      </section>
    </div>
  )
}
