import {
  Check,
  CirclePlay,
  ChevronDown,
  CircleHelp,
  Crop,
  Download,
  FileDown,
  FileCode2,
  FlipHorizontal2,
  FolderOpen,
  Grid3X3,
  Image as ImageIcon,
  Layers3,
  Link2,
  Lock,
  Minus,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Stamp,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CompositionEditor } from './CompositionEditor'
import { CONVERSION_MODES } from './conversionModes'
import { CutoutEditor } from './CutoutEditor'
import { PaletteManager, type CustomPaletteDefinition } from './PaletteManager'
import { PatternEditor } from './PatternEditor'
import { ProjectManager } from './ProjectManager'
import { ProgressTracker } from './ProgressTracker'
import { createFullExportPlan } from './exportSizing'
import { DEFAULT_IMAGE_TRANSFORM } from './imageComposition'
import { processImage, type BeadPattern, type ProcessOptions } from './imageProcessing'
import { getBuiltInPalette, parseCustomPalette, removeDisabledColors, type BuiltInPaletteId } from './paletteRegistry'
import { mirrorPattern } from './patternEditing'
import type { PaperSize, PrintOrientation } from './printLayout'
import { duplicateProjectSnapshot, validateProjectSnapshot, type ProjectSnapshot } from './projectFormat'
import { deleteProjectSnapshot, listProjectSnapshots, saveProjectSnapshot } from './projectStore'
import { createProgressStorageKey } from './progressTracking'
import { cutOutPerson } from './personCutout'
import { canvasToPngBlob, createPatternSvg, downloadBlob, downloadCanvas, downloadText, drawPattern } from './patternRenderer'

type SourceImage = {
  image: HTMLImageElement
  url: string
  name: string
}

type PreviewMode = 'pattern' | 'pixel' | 'beads' | 'mirror' | 'board' | 'poster' | 'original'

type PatternHistoryState = {
  source: BeadPattern | null
  items: BeadPattern[]
  index: number
}

type PaletteSelectionId = BuiltInPaletteId | 'custom'

function loadCustomPalette(): CustomPaletteDefinition | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem('bead-studio-custom-palette') ?? 'null') as { name?: unknown; colors?: unknown }
    if (!saved || typeof saved.name !== 'string' || !Array.isArray(saved.colors)) return null
    return { name: saved.name, colors: parseCustomPalette(JSON.stringify(saved.colors), 'json') }
  } catch {
    return null
  }
}

function loadDisabledPaletteColors() {
  try {
    const saved = JSON.parse(window.localStorage.getItem('bead-studio-disabled-palette-colors') ?? '{}') as Record<string, unknown>
    return Object.fromEntries(Object.entries(saved).map(([id, codes]) => [id, Array.isArray(codes) ? codes.filter((code): code is string => typeof code === 'string') : []]))
  } catch {
    return {} as Record<string, string[]>
  }
}

async function imageUrlToDataUrl(url: string) {
  if (url.startsWith('data:image/')) return url
  const blob = await fetch(url).then((response) => response.blob())
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('图片编码失败'))
    reader.onerror = () => reject(reader.error ?? new Error('图片编码失败'))
    reader.readAsDataURL(blob)
  })
}

const DEFAULT_OPTIONS: ProcessOptions = {
  width: 40,
  height: 40,
  maxColors: 18,
  brightness: 0,
  contrast: 8,
  saturation: 105,
  removeBackground: false,
  backgroundTolerance: 22,
  dither: false,
  fit: 'contain',
  transform: DEFAULT_IMAGE_TRANSFORM,
  mode: 'auto',
}

const DEFAULT_WATERMARK_TEXT = '@小Z拼豆图纸定制'

const SAMPLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720">
  <rect width="720" height="720" rx="64" fill="#f5ead8"/>
  <circle cx="360" cy="370" r="224" fill="#e98539"/>
  <path d="M193 231 222 92l132 104M527 231 498 92 366 196" fill="#dc7730" stroke="#593b35" stroke-width="25" stroke-linejoin="round"/>
  <path d="M225 400c0-80 61-135 135-135s135 55 135 135c0 107-61 181-135 181s-135-74-135-181Z" fill="#fff5e8"/>
  <ellipse cx="278" cy="347" rx="30" ry="39" fill="#fff"/>
  <ellipse cx="442" cy="347" rx="30" ry="39" fill="#fff"/>
  <ellipse cx="283" cy="356" rx="15" ry="24" fill="#35342f"/>
  <ellipse cx="437" cy="356" rx="15" ry="24" fill="#35342f"/>
  <path d="m360 407-25-18h50Z" fill="#df6a72" stroke="#593b35" stroke-width="9" stroke-linejoin="round"/>
  <path d="M360 407c-5 34-46 42-67 18m67-18c5 34 46 42 67 18" fill="none" stroke="#593b35" stroke-width="10" stroke-linecap="round"/>
  <path d="M251 414H110m140 31-122 41m341-72h141m-140 31 122 41" stroke="#593b35" stroke-width="9" stroke-linecap="round"/>
  <path d="M194 546c-58 31-78 89-40 105 42 18 92-28 93-75m279-30c58 31 78 89 40 105-42 18-92-28-93-75" fill="none" stroke="#593b35" stroke-width="25" stroke-linecap="round"/>
</svg>`

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button className="toggle-row" type="button" onClick={() => onChange(!checked)} aria-pressed={checked}>
      <span>{label}</span>
      <span className={`toggle ${checked ? 'is-on' : ''}`} aria-hidden="true"><i /></span>
    </button>
  )
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}) {
  const progress = ((value - min) / Math.max(1, max - min)) * 100
  return (
    <label className="range-control">
      <span className="control-label"><span>{label}</span><b>{value}{suffix}</b></span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--range-progress': `${progress}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function PatternPreview({
  pattern,
  mode,
  showCodes,
  boardLines,
  zoom,
}: {
  pattern: BeadPattern
  mode: PreviewMode
  showCodes: boolean
  boardLines: boolean
  zoom: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const displayPattern = useMemo(() => mode === 'mirror' ? mirrorPattern(pattern) : pattern, [mode, pattern])
  useEffect(() => {
    if (!ref.current || mode === 'original') return
    drawPattern(ref.current, displayPattern, {
      cellSize: Math.max(12, Math.round(zoom / 4)),
      coordinates: mode === 'pattern' || mode === 'mirror' || mode === 'board',
      codes: (mode === 'pattern' || mode === 'mirror' || mode === 'board') && showCodes,
      grid: mode === 'pattern' || mode === 'mirror' || mode === 'board',
      boardLines: mode === 'board' || ((mode === 'pattern' || mode === 'mirror') && boardLines),
      beadStyle: mode === 'beads' ? 'circle' : 'square',
      title: mode === 'poster' ? '我的拼豆作品' : undefined,
      legend: mode === 'poster',
      legendPosition: 'bottom',
      pixelRatio: Math.max(2, Math.min(window.devicePixelRatio || 1, 2.5)),
    })
  }, [displayPattern, mode, showCodes, boardLines, zoom])
  return <canvas ref={ref} className="pattern-canvas" aria-label="拼豆图纸预览" />
}

function createCsvContent(pattern: BeadPattern) {
  const rows = [
    ['色号', '色系', 'HEX', '数量', '占比'],
    ...pattern.usage.map((item) => [
      item.color.code,
      item.color.family,
      item.color.hex,
      String(item.count),
      `${(item.percent * 100).toFixed(1)}%`,
    ]),
  ]
  return `\uFEFF${rows.map((row) => row.join(',')).join('\n')}`
}

function downloadCsv(pattern: BeadPattern) {
  const csv = createCsvContent(pattern)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.download = '拼豆用量清单.csv'
  link.href = url
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function App() {
  const [source, setSource] = useState<SourceImage | null>(null)
  const [cutout, setCutout] = useState<SourceImage | null>(null)
  const [options, setOptions] = useState(DEFAULT_OPTIONS)
  const [lockedRatio, setLockedRatio] = useState(true)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('pattern')
  const [showCodes, setShowCodes] = useState(true)
  const [boardLines, setBoardLines] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [dragging, setDragging] = useState(false)
  const [exportInfo, setExportInfo] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [isCuttingOut, setIsCuttingOut] = useState(false)
  const [isEditingCutout, setIsEditingCutout] = useState(false)
  const [isEditingComposition, setIsEditingComposition] = useState(false)
  const [isEditingPattern, setIsEditingPattern] = useState(false)
  const [isManagingPalette, setIsManagingPalette] = useState(false)
  const [isManagingProjects, setIsManagingProjects] = useState(false)
  const [isTrackingProgress, setIsTrackingProgress] = useState(false)
  const [projectSnapshots, setProjectSnapshots] = useState<ProjectSnapshot[]>([])
  const [projectName, setProjectName] = useState('未命名拼豆工程')
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [autoSaveCandidate, setAutoSaveCandidate] = useState<ProjectSnapshot | null>(null)
  const [pdfPaper, setPdfPaper] = useState<PaperSize>('a4')
  const [pdfOrientation, setPdfOrientation] = useState<PrintOrientation>('auto')
  const [pdfBeadSize, setPdfBeadSize] = useState(2.6)
  const [pdfScaleMode, setPdfScaleMode] = useState<'actual' | 'fit'>('actual')
  const [pdfCustomPaper, setPdfCustomPaper] = useState({ width: 210, height: 297 })
  const [customPalette, setCustomPalette] = useState<CustomPaletteDefinition | null>(loadCustomPalette)
  const [paletteId, setPaletteId] = useState<PaletteSelectionId>(() => {
    const saved = window.localStorage.getItem('bead-studio-palette-id') as PaletteSelectionId | null
    return saved === 'perler' || saved === 'hama' || saved === 'custom' ? saved : 'mard'
  })
  const [disabledPaletteColors, setDisabledPaletteColors] = useState<Record<string, string[]>>(loadDisabledPaletteColors)
  const [cutoutInfo, setCutoutInfo] = useState('')
  const [watermarkEnabled, setWatermarkEnabled] = useState(() => window.localStorage.getItem('bead-studio-watermark-enabled') === 'true')
  const [watermarkText, setWatermarkText] = useState(() => window.localStorage.getItem('bead-studio-watermark-text') || DEFAULT_WATERMARK_TEXT)
  const [watermarkOpacity, setWatermarkOpacity] = useState(() => {
    const saved = Number(window.localStorage.getItem('bead-studio-watermark-opacity'))
    return saved >= 10 && saved <= 30 ? saved : 18
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const cutoutRequestRef = useRef(0)
  const autoSaveRequestRef = useRef(0)
  const pendingRestoredPatternRef = useRef<BeadPattern | null>(null)
  const patternSource = cutout ?? source
  const selectedPalette = paletteId === 'custom' && customPalette ? customPalette : getBuiltInPalette(paletteId === 'custom' ? 'mard' : paletteId)
  const selectedDisabledCodes = useMemo(() => new Set(disabledPaletteColors[paletteId] ?? []), [disabledPaletteColors, paletteId])
  const activePalette = useMemo(() => {
    const colors = removeDisabledColors(selectedPalette.colors, selectedDisabledCodes)
    return colors.length ? colors : selectedPalette.colors.slice(0, 1)
  }, [selectedDisabledCodes, selectedPalette])
  const watermark = watermarkEnabled && watermarkText.trim()
    ? { text: watermarkText.trim(), opacity: watermarkOpacity / 100 }
    : undefined

  useEffect(() => {
    window.localStorage.setItem('bead-studio-watermark-enabled', String(watermarkEnabled))
  }, [watermarkEnabled])

  useEffect(() => {
    window.localStorage.setItem('bead-studio-watermark-text', watermarkText)
  }, [watermarkText])

  useEffect(() => {
    window.localStorage.setItem('bead-studio-watermark-opacity', String(watermarkOpacity))
  }, [watermarkOpacity])

  useEffect(() => {
    window.localStorage.setItem('bead-studio-palette-id', paletteId)
  }, [paletteId])

  useEffect(() => {
    window.localStorage.setItem('bead-studio-disabled-palette-colors', JSON.stringify(disabledPaletteColors))
  }, [disabledPaletteColors])

  useEffect(() => {
    if (customPalette) window.localStorage.setItem('bead-studio-custom-palette', JSON.stringify(customPalette))
  }, [customPalette])

  useEffect(() => {
    setOptions((current) => current.maxColors <= activePalette.length
      ? current
      : { ...current, maxColors: activePalette.length })
  }, [activePalette.length])

  const generatedPattern = useMemo(() => {
    if (!patternSource) return null
    return processImage(patternSource.image, options, activePalette)
  }, [activePalette, patternSource, options])
  const [patternHistory, setPatternHistory] = useState<PatternHistoryState>({ source: null, items: [], index: -1 })
  const pattern = generatedPattern && patternHistory.source === generatedPattern
    ? patternHistory.items[patternHistory.index] ?? generatedPattern
    : generatedPattern

  useEffect(() => {
    const restored = pendingRestoredPatternRef.current
    if (generatedPattern && restored && restored.width === generatedPattern.width && restored.height === generatedPattern.height) {
      pendingRestoredPatternRef.current = null
      setPatternHistory({ source: generatedPattern, items: [generatedPattern, restored], index: 1 })
    } else {
      setPatternHistory(generatedPattern
        ? { source: generatedPattern, items: [generatedPattern], index: 0 }
        : { source: null, items: [], index: -1 })
    }
    setIsEditingPattern(false)
  }, [generatedPattern])

  const commitPatternEdit = useCallback((next: BeadPattern) => {
    if (!generatedPattern) return
    setPatternHistory((current) => {
      const state = current.source === generatedPattern
        ? current
        : { source: generatedPattern, items: [generatedPattern], index: 0 }
      if (state.items[state.index] === next) return state
      const items = [...state.items.slice(0, state.index + 1), next].slice(-51)
      return { source: generatedPattern, items, index: items.length - 1 }
    })
  }, [generatedPattern])

  const undoPatternEdit = useCallback(() => {
    setPatternHistory((current) => current.index > 0 ? { ...current, index: current.index - 1 } : current)
  }, [])

  const redoPatternEdit = useCallback(() => {
    setPatternHistory((current) => current.index < current.items.length - 1 ? { ...current, index: current.index + 1 } : current)
  }, [])

  const resetPatternEdits = useCallback(() => {
    if (!generatedPattern) return
    setPatternHistory({ source: generatedPattern, items: [generatedPattern], index: 0 })
  }, [generatedPattern])

  const updateOption = <K extends keyof ProcessOptions>(key: K, value: ProcessOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }))
  }

  const selectPalette = (id: PaletteSelectionId) => {
    if (id === 'custom' && !customPalette) return
    setPaletteId(id)
  }

  const importCustomPalette = (palette: CustomPaletteDefinition) => {
    setCustomPalette(palette)
    setDisabledPaletteColors((current) => ({ ...current, custom: [] }))
    setPaletteId('custom')
  }

  const togglePaletteColor = (code: string) => {
    setDisabledPaletteColors((current) => {
      const disabled = new Set(current[paletteId] ?? [])
      if (disabled.has(code)) disabled.delete(code)
      else {
        if (selectedPalette.colors.length - disabled.size <= 1) return current
        disabled.add(code)
      }
      return { ...current, [paletteId]: [...disabled] }
    })
  }

  const setDimension = (dimension: 'width' | 'height', raw: number) => {
    const value = Math.max(8, Math.min(120, Math.round(raw || 8)))
    setOptions((current) => {
      if (!lockedRatio || !source) return { ...current, [dimension]: value }
      const ratio = source.image.naturalWidth / source.image.naturalHeight
      return dimension === 'width'
        ? { ...current, width: value, height: Math.max(8, Math.min(120, Math.round(value / ratio))) }
        : { ...current, height: value, width: Math.max(8, Math.min(120, Math.round(value * ratio))) }
    })
  }

  const setAspectRatio = (ratio: [number, number] | null) => {
    if (!ratio) {
      setLockedRatio(false)
      return
    }
    setLockedRatio(true)
    setOptions((current) => ({
      ...current,
      height: Math.max(8, Math.min(120, Math.round(current.width * ratio[1] / ratio[0]))),
    }))
  }

  const loadUrl = (url: string, name: string, restoredProject?: ProjectSnapshot) => {
    const image = new Image()
    image.onload = () => {
      cutoutRequestRef.current += 1
      setCutout((old) => {
        if (old?.url.startsWith('blob:')) URL.revokeObjectURL(old.url)
        return null
      })
      setIsCuttingOut(false)
      setIsEditingCutout(false)
      setIsEditingComposition(false)
      setCutoutInfo('')
      pendingRestoredPatternRef.current = restoredProject?.pattern ?? null
      setProjectName(restoredProject?.name.replace(/^(自动保存 · )+/, '') ?? name.replace(/\.[^.]+$/, ''))
      setSource((old) => {
        if (old?.url.startsWith('blob:')) URL.revokeObjectURL(old.url)
        return { image, url, name }
      })
      setOptions((current) => restoredProject?.options ?? ({
          ...current,
          height: Math.max(8, Math.min(120, Math.round(current.width / (image.naturalWidth / image.naturalHeight)))),
          transform: DEFAULT_IMAGE_TRANSFORM,
        }))
    }
    image.onerror = () => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      window.alert('图片读取失败，请换一张 JPG、PNG 或 WebP 图片。')
    }
    image.src = url
  }

  const loadFile = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      window.alert('请选择图片文件。')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      window.alert('图片请不要超过 20 MB。')
      return
    }
    loadUrl(URL.createObjectURL(file), file.name)
  }

  const loadSample = () => {
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SAMPLE_SVG)}`
    loadUrl(dataUrl, '橘猫示例.svg')
  }

  const refreshProjectSnapshots = async () => {
    setProjectSnapshots(await listProjectSnapshots())
  }

  const openProjectManager = async () => {
    try {
      await refreshProjectSnapshots()
      setIsManagingProjects(true)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '本地工程读取失败')
    }
  }

  const createCurrentSnapshot = async (): Promise<ProjectSnapshot> => {
    if (!patternSource || !pattern) throw new Error('请先生成图纸')
    return {
      version: 1,
      id: crypto.randomUUID(),
      name: projectName.trim() || '未命名拼豆工程',
      savedAt: new Date().toISOString(),
      sourceName: patternSource.name,
      sourceDataUrl: await imageUrlToDataUrl(patternSource.url),
      options,
      paletteId,
      disabledPaletteColors: [...selectedDisabledCodes],
      customPalette,
      pattern,
      completedProgress: (() => {
        try {
          const saved = JSON.parse(window.localStorage.getItem(createProgressStorageKey(pattern)) ?? '[]') as unknown
          return Array.isArray(saved) ? saved.filter((index): index is number => Number.isInteger(index)) : []
        } catch {
          return []
        }
      })(),
    }
  }

  const saveCurrentProject = async () => {
    if (isSavingProject) return
    setIsSavingProject(true)
    try {
      const snapshot = await createCurrentSnapshot()
      await saveProjectSnapshot(snapshot)
      setExportInfo(`工程已保存 · ${snapshot.name} · ${new Date(snapshot.savedAt).toLocaleTimeString('zh-CN')}`)
      if (isManagingProjects) await refreshProjectSnapshots()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '工程保存失败')
    } finally {
      setIsSavingProject(false)
    }
  }

  const loadProjectSnapshot = (snapshot: ProjectSnapshot) => {
    if (snapshot.paletteId === 'custom' && snapshot.customPalette) setCustomPalette(snapshot.customPalette)
    setPaletteId(snapshot.paletteId === 'custom' && !snapshot.customPalette ? 'mard' : snapshot.paletteId)
    setDisabledPaletteColors((current) => ({ ...current, [snapshot.paletteId]: snapshot.disabledPaletteColors }))
    window.localStorage.setItem(createProgressStorageKey(snapshot.pattern), JSON.stringify(snapshot.completedProgress ?? []))
    loadUrl(snapshot.sourceDataUrl, snapshot.sourceName, snapshot)
    setIsManagingProjects(false)
    setExportInfo(`已打开工程 · ${snapshot.name}`)
  }

  const duplicateProject = async (snapshot: ProjectSnapshot) => {
    const copy = duplicateProjectSnapshot(snapshot, crypto.randomUUID(), new Date().toISOString())
    await saveProjectSnapshot(copy)
    await refreshProjectSnapshots()
  }

  const exportProjectFile = (snapshot: ProjectSnapshot) => {
    downloadText(JSON.stringify(snapshot), 'application/json;charset=utf-8', `${snapshot.name}.bead-project`)
  }

  const importProjectFile = async (file: File) => {
    try {
      const snapshot = validateProjectSnapshot(JSON.parse(await file.text()))
      await saveProjectSnapshot(snapshot)
      await refreshProjectSnapshots()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '工程文件导入失败')
    }
  }

  const removeProject = async (snapshot: ProjectSnapshot) => {
    if (!window.confirm(`确定删除“${snapshot.name}”这个本地快照吗？`)) return
    await deleteProjectSnapshot(snapshot.id)
    await refreshProjectSnapshots()
  }

  useEffect(() => {
    void listProjectSnapshots().then((projects) => {
      const autoSave = projects.find((project) => project.id === 'bead-studio-auto-save')
      if (autoSave) setAutoSaveCandidate(autoSave)
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    const request = ++autoSaveRequestRef.current
    if (!pattern || !patternSource) return
    const timer = window.setTimeout(() => {
      void createCurrentSnapshot().then((snapshot) => {
        if (request !== autoSaveRequestRef.current) return undefined
        return saveProjectSnapshot({
          ...snapshot,
          id: 'bead-studio-auto-save',
          name: `自动保存 · ${snapshot.name.replace(/^(自动保存 · )+/, '')}`,
        })
      }).catch(() => undefined)
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [customPalette, disabledPaletteColors, isTrackingProgress, options, paletteId, pattern, patternSource, projectName])

  const clearSource = () => {
    cutoutRequestRef.current += 1
    if (source?.url.startsWith('blob:')) URL.revokeObjectURL(source.url)
    if (cutout?.url.startsWith('blob:')) URL.revokeObjectURL(cutout.url)
    setCutout(null)
    setSource(null)
    setIsCuttingOut(false)
    setIsEditingCutout(false)
    setCutoutInfo('')
  }

  const togglePersonCutout = async () => {
    if (!source || isCuttingOut) return
    if (cutout) {
      if (cutout.url.startsWith('blob:')) URL.revokeObjectURL(cutout.url)
      setCutout(null)
      setIsEditingCutout(false)
      setCutoutInfo('已恢复完整图片')
      return
    }

    const requestId = cutoutRequestRef.current + 1
    cutoutRequestRef.current = requestId
    setIsCuttingOut(true)
    setCutoutInfo('正在加载本地模型并识别人物，首次使用会稍慢…')
    let resultUrl = ''
    try {
      const result = await cutOutPerson(source.image, 0.46)
      resultUrl = URL.createObjectURL(result.blob)
      const image = new Image()
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('抠图结果读取失败'))
        image.src = resultUrl
      })
      if (cutoutRequestRef.current !== requestId) {
        URL.revokeObjectURL(resultUrl)
        resultUrl = ''
        return
      }
      setCutout({ image, url: resultUrl, name: `${source.name} · AI 抠图` })
      resultUrl = ''
      setOptions((current) => ({ ...current, removeBackground: false }))
      setPreviewMode('pattern')
      setCutoutInfo(result.mode === 'cartoon-background'
        ? '真人模型未识别，已自动切换卡通背景抠图；空白区域不计数'
        : '已保留识别到的主体；请检查宠物、毛发和衣物边缘，必要时使用人工修边')
    } catch (error) {
      if (resultUrl) URL.revokeObjectURL(resultUrl)
      console.warn(error)
      if (cutoutRequestRef.current === requestId) {
        setCutoutInfo(error instanceof Error ? error.message : 'AI 抠图失败，请换一张图片重试')
      }
    } finally {
      if (cutoutRequestRef.current === requestId) setIsCuttingOut(false)
    }
  }

  const applyManualCutout = async (blob: Blob) => {
    if (!source) return
    const resultUrl = URL.createObjectURL(blob)
    const image = new Image()
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('人工修边结果读取失败'))
        image.src = resultUrl
      })
      setCutout((old) => {
        if (old?.url.startsWith('blob:')) URL.revokeObjectURL(old.url)
        return { image, url: resultUrl, name: `${source.name} · 人工修边` }
      })
      setIsEditingCutout(false)
      setPreviewMode('original')
      setCutoutInfo('人工修边已应用；图纸与用豆统计已按新边缘重新计算')
    } catch (error) {
      URL.revokeObjectURL(resultUrl)
      throw error
    }
  }

  const exportFullPattern = async (mirrored: boolean) => {
    if (!pattern || isExporting) return
    setIsExporting(true)
    try {
      const exportPattern = mirrored ? mirrorPattern(pattern) : pattern
      const plan = createFullExportPlan(exportPattern.width, exportPattern.height, exportPattern.usage.length)
      const canvas = document.createElement('canvas')
      drawPattern(canvas, exportPattern, {
        cellSize: plan.cellSize,
        coordinates: true,
        codes: true,
        grid: true,
        boardLines,
        legend: true,
        pixelRatio: 1,
        pixelText: plan.pixelText,
        legendPosition: plan.legendPosition,
        coordinateFontScale: plan.coordinateFontScale,
        codeFontScale: plan.codeFontScale,
        watermark,
      })
      const blob = await canvasToPngBlob(canvas)
      downloadBlob(blob, `${mirrored ? '拼豆镜像成品图纸' : '拼豆完整高清图纸'}-${pattern.width}x${pattern.height}.png`)
      setExportInfo(`已生成${mirrored ? '镜像' : '普通'}单张 PNG · ${canvas.width} × ${canvas.height}px · 每格 ${plan.cellSize}px`)
    } catch (error) {
      console.error(error)
      window.alert('完整 PNG 生成失败，当前设备内存可能不足；请改用 SVG 无损图。')
    } finally {
      setIsExporting(false)
    }
  }

  const exportCurrentStyle = async () => {
    if (!pattern || previewMode === 'original' || isExporting) return
    setIsExporting(true)
    try {
      const displayPattern = previewMode === 'mirror' ? mirrorPattern(pattern) : pattern
      const plan = createFullExportPlan(displayPattern.width, displayPattern.height, displayPattern.usage.length)
      const canvas = document.createElement('canvas')
      drawPattern(canvas, displayPattern, {
        cellSize: plan.cellSize,
        coordinates: previewMode === 'pattern' || previewMode === 'mirror' || previewMode === 'board',
        codes: (previewMode === 'pattern' || previewMode === 'mirror' || previewMode === 'board') && showCodes,
        grid: previewMode === 'pattern' || previewMode === 'mirror' || previewMode === 'board',
        boardLines: previewMode === 'board' || ((previewMode === 'pattern' || previewMode === 'mirror') && boardLines),
        beadStyle: previewMode === 'beads' ? 'circle' : 'square',
        title: previewMode === 'poster' ? projectName : undefined,
        legend: previewMode === 'poster',
        legendPosition: plan.legendPosition,
        pixelRatio: 1,
        watermark,
      })
      downloadBlob(await canvasToPngBlob(canvas), `拼豆-${previewMode}-${pattern.width}x${pattern.height}.png`)
      setExportInfo(`已按当前“${previewMode}”展示样式导出 PNG`)
    } finally {
      setIsExporting(false)
    }
  }

  const exportPhysicalPdf = async (mirrored: boolean) => {
    if (!pattern || isExporting) return
    setIsExporting(true)
    try {
      const exportPattern = mirrored ? mirrorPattern(pattern) : pattern
      const { createPhysicalPdfBlob } = await import('./pdfExport')
      const { blob, layout } = createPhysicalPdfBlob(exportPattern, {
        paper: pdfPaper,
        orientation: pdfOrientation,
        beadSizeMm: pdfBeadSize,
        overlapCells: 2,
        paletteName: selectedPalette.name,
        mirrored,
        customPaperMm: pdfPaper === 'custom' ? pdfCustomPaper : undefined,
        scaleMode: pdfScaleMode,
      })
      downloadBlob(blob, `拼豆真实尺寸-${pdfPaper.toUpperCase()}-${pdfBeadSize}mm${mirrored ? '-镜像' : ''}.pdf`)
      setExportInfo(`已生成 100% 实际尺寸 PDF · ${layout.pages.length} 张图纸页 + 1 张色号表 · ${(blob.size / 1024).toFixed(0)} KB`)
    } catch (error) {
      console.error(error)
      window.alert('PDF 生成失败，请减少图纸尺寸后重试。')
    } finally {
      setIsExporting(false)
    }
  }

  const exportSvg = () => {
    if (!pattern) return
    const svg = createPatternSvg(pattern, {
      cellSize: 40,
      coordinates: true,
      codes: true,
      grid: true,
      boardLines,
      legend: true,
      watermark,
    })
    setExportInfo('已生成 SVG 矢量图，可无限放大')
    downloadText(svg, 'image/svg+xml;charset=utf-8', '拼豆坐标图纸-矢量.svg')
  }

  const exportPixel = () => {
    if (!pattern) return
    const canvas = document.createElement('canvas')
    drawPattern(canvas, pattern, {
      cellSize: 24,
      coordinates: false,
      codes: false,
      grid: false,
      boardLines: false,
      pixelRatio: 2,
      watermark,
    })
    downloadCanvas(canvas, '拼豆像素预览.png')
  }

  const boardSizeMm = 2.6
  const physicalWidth = pattern ? (pattern.width * boardSizeMm / 10).toFixed(1) : '—'
  const physicalHeight = pattern ? (pattern.height * boardSizeMm / 10).toFixed(1) : '—'

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#" aria-label="豆格首页">
          <span className="brand-mark"><i /><i /><i /><i /></span>
          <span><strong>豆格</strong><small>BEAD STUDIO</small></span>
        </a>
        <div className="header-center"><Sparkles size={14} /> 照片变图纸，灵感变成品</div>
        <div className="header-actions">
          <span className="privacy"><ShieldCheck size={15} /> 图片仅在本机处理</span>
          <button className="icon-button" type="button" title="使用说明"><CircleHelp size={18} /></button>
        </div>
      </header>

      {autoSaveCandidate && (
        <div className="restore-banner" role="status">
          <span><strong>发现上次自动保存</strong>{autoSaveCandidate.pattern.width} × {autoSaveCandidate.pattern.height} 格 · {new Date(autoSaveCandidate.savedAt).toLocaleString('zh-CN')}</span>
          <div><button type="button" onClick={() => { loadProjectSnapshot(autoSaveCandidate); setAutoSaveCandidate(null) }}>恢复工程</button><button type="button" onClick={() => setAutoSaveCandidate(null)}>暂不恢复</button></div>
        </div>
      )}

      <main className="workspace">
        <aside className="control-panel panel">
          <div className="panel-heading">
            <div><span className="step-badge">01</span><h2>准备图片</h2></div>
            {source && <button className="text-button" type="button" onClick={clearSource}><X size={14} /> 清除</button>}
          </div>

          {!source ? (
            <div
              className={`upload-zone ${dragging ? 'is-dragging' : ''}`}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); loadFile(event.dataTransfer.files[0]) }}
            >
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => loadFile(event.target.files?.[0])} />
              <span className="upload-icon"><Upload size={24} /></span>
              <strong>拖入照片，或点击上传</strong>
              <p>支持 JPG / PNG / WebP · 最大 20 MB</p>
              <button type="button" className="primary-small" onClick={() => fileRef.current?.click()}>选择图片</button>
              <button type="button" className="sample-link" onClick={loadSample}><WandSparkles size={14} /> 先试试橘猫示例</button>
            </div>
          ) : (
            <div className="source-card">
              <img src={patternSource?.url} alt={cutout ? 'AI 抠图预览' : '已上传原图'} />
              <div>
                <strong title={source.name}>{source.name}</strong>
                <span>{source.image.naturalWidth} × {source.image.naturalHeight}px{cutout ? ' · 已抠图' : ''}</span>
              </div>
              <button type="button" onClick={() => fileRef.current?.click()}><RotateCcw size={14} /> 更换</button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => loadFile(event.target.files?.[0])} />
            </div>
          )}

          <section className={`settings-section ${!source ? 'is-muted' : ''}`}>
            <div className="section-title"><span><Grid3X3 size={16} /> 图纸尺寸</span><em>2.6 mm 小豆</em></div>
            <div className="dimension-row">
              <label><span>宽</span><input type="number" min="8" max="120" value={options.width} onChange={(event) => setDimension('width', Number(event.target.value))} /><small>格</small></label>
              <button type="button" className={`ratio-lock ${lockedRatio ? 'is-active' : ''}`} onClick={() => setLockedRatio(!lockedRatio)} title="锁定原图比例"><Lock size={14} /><Link2 size={12} /></button>
              <label><span>高</span><input type="number" min="8" max="120" value={options.height} onChange={(event) => setDimension('height', Number(event.target.value))} /><small>格</small></label>
            </div>
            <div className="preset-row">
              {[29, 40, 52, 58, 104].map((size) => <button key={size} type="button" className={options.width === size ? 'is-active' : ''} onClick={() => setDimension('width', size)}>{size} 格</button>)}
            </div>
            <div className="ratio-preset-row" aria-label="图纸比例">
              {([
                ['1:1', [1, 1]],
                ['3:4', [3, 4]],
                ['4:3', [4, 3]],
                ['9:16', [9, 16]],
              ] as const).map(([label, ratio]) => (
                <button key={label} type="button" className={options.width * ratio[1] === options.height * ratio[0] && lockedRatio ? 'is-active' : ''} onClick={() => setAspectRatio([...ratio])}>{label}</button>
              ))}
              <button type="button" className={!lockedRatio ? 'is-active' : ''} onClick={() => setAspectRatio(null)}>自由</button>
            </div>
            <div className="segmented wide">
              <button type="button" className={options.fit === 'contain' ? 'is-active' : ''} onClick={() => updateOption('fit', 'contain')}>完整放入</button>
              <button type="button" className={options.fit === 'cover' ? 'is-active' : ''} onClick={() => updateOption('fit', 'cover')}>铺满裁切</button>
            </div>
            <button type="button" className="composition-launch" disabled={!patternSource} onClick={() => setIsEditingComposition(true)}><Crop size={14} /> 裁剪与构图</button>
          </section>

          <section className={`settings-section ${!source ? 'is-muted' : ''}`}>
            <div className="section-title"><span><WandSparkles size={16} /> 转换模式</span><em>{CONVERSION_MODES.find((mode) => mode.id === options.mode)?.label}</em></div>
            <div className="conversion-mode-grid">
              {CONVERSION_MODES.map((mode) => <button key={mode.id} type="button" className={options.mode === mode.id ? 'is-active' : ''} onClick={() => updateOption('mode', mode.id)} title={mode.description}>{mode.label}</button>)}
            </div>
            <small className="conversion-hint">{CONVERSION_MODES.find((mode) => mode.id === options.mode)?.description}</small>
          </section>

          <section className={`settings-section ${!source ? 'is-muted' : ''}`}>
            <div className="section-title"><span><Palette size={16} /> 颜色处理</span><em>{selectedPalette.name}</em></div>
            <div className="palette-select-row">
              <select value={paletteId} onChange={(event) => selectPalette(event.target.value as PaletteSelectionId)} aria-label="选择豆子色卡">
                <option value="mard">MARD 基础</option>
                <option value="perler">Perler</option>
                <option value="hama">Hama Midi</option>
                {customPalette && <option value="custom">{customPalette.name}</option>}
              </select>
              <button type="button" onClick={() => setIsManagingPalette(true)}>管理色卡</button>
            </div>
            <small className="palette-availability">当前可用 {activePalette.length} 色 · 可在管理中停用没有库存的颜色</small>
            <RangeControl label="最多颜色" value={options.maxColors} min={1} max={Math.min(80, activePalette.length)} suffix=" 色" onChange={(value) => updateOption('maxColors', value)} />
            <RangeControl label="饱和度" value={options.saturation} min={60} max={140} suffix="%" onChange={(value) => updateOption('saturation', value)} />
            <div className="dual-range">
              <RangeControl label="亮度" value={options.brightness} min={-30} max={30} onChange={(value) => updateOption('brightness', value)} />
              <RangeControl label="对比度" value={options.contrast} min={-30} max={50} onChange={(value) => updateOption('contrast', value)} />
            </div>
            <Toggle label="像素抖动（保留渐变）" checked={options.dither} onChange={(value) => updateOption('dither', value)} />
            <Toggle label="去除边缘纯色背景" checked={options.removeBackground} onChange={(value) => updateOption('removeBackground', value)} />
            {options.removeBackground && <RangeControl label="去背容差" value={options.backgroundTolerance} min={5} max={60} onChange={(value) => updateOption('backgroundTolerance', value)} />}
          </section>

          <section className={`settings-section ${!source ? 'is-muted' : ''}`}>
            <div className="section-title"><span><WandSparkles size={16} /> 智能抠图与修边</span><em>本机运行</em></div>
            <div className={`cutout-card ${cutout ? 'is-active' : ''}`}>
              <p>先自动抠图，再用恢复/擦除画笔修复宠物、毛发和衣物边缘；透明区域没有色号，也不计豆。</p>
              <div className="cutout-actions">
                <button type="button" onClick={togglePersonCutout} disabled={isCuttingOut}>
                  <Sparkles size={15} />
                  {isCuttingOut ? '正在识别主体…' : cutout ? '恢复完整图片' : '一键只保留主体'}
                </button>
                {cutout && (
                  <button type="button" className="manual-edge-button" onClick={() => setIsEditingCutout(true)}>
                    <WandSparkles size={15} /> 人工修边
                  </button>
                )}
              </div>
              <small role="status" aria-live="polite">{cutoutInfo || '首次使用需加载约 12 MB 的本地模型'}</small>
            </div>
          </section>
        </aside>

        <section className="preview-panel panel">
          <div className="preview-toolbar">
            <div className="segmented">
              <button type="button" className={previewMode === 'pattern' ? 'is-active' : ''} onClick={() => setPreviewMode('pattern')}><Grid3X3 size={14} /> 图纸</button>
              <button type="button" className={previewMode === 'pixel' ? 'is-active' : ''} onClick={() => setPreviewMode('pixel')}><Layers3 size={14} /> 色块</button>
              <button type="button" className={previewMode === 'original' ? 'is-active' : ''} onClick={() => setPreviewMode('original')}><ImageIcon size={14} /> 原图</button>
            </div>
            <div className="preview-actions">
              <select className="display-style-select" aria-label="展示样式" value={previewMode} onChange={(event) => setPreviewMode(event.target.value as PreviewMode)}>
                <option value="pattern">色号图</option><option value="pixel">纯色块图</option><option value="beads">圆珠效果图</option><option value="mirror">镜像图</option><option value="board">1:1 垫板图</option><option value="poster">分享海报</option><option value="original">原图</option>
              </select>
              <button type="button" className="edit-pattern-button" onClick={() => setIsEditingPattern(true)} disabled={!pattern}><Pencil size={13} /> 精修图纸</button>
              <button type="button" className="progress-tracker-button" onClick={() => setIsTrackingProgress(true)} disabled={!pattern}><CirclePlay size={13} /> 开始拼豆</button>
              <label className="compact-check"><input type="checkbox" checked={showCodes} onChange={(event) => setShowCodes(event.target.checked)} /><Check size={11} /> 色号</label>
              <label className="compact-check"><input type="checkbox" checked={boardLines} onChange={(event) => setBoardLines(event.target.checked)} /><Check size={11} /> 拼板线</label>
              <span className="toolbar-divider" />
              <button type="button" className="zoom-step" onClick={() => setZoom(Math.max(50, zoom - 10))}><Minus size={14} /></button>
              <span className="zoom-value">{zoom}%</span>
              <button type="button" className="zoom-step" onClick={() => setZoom(Math.min(180, zoom + 10))}><Plus size={14} /></button>
            </div>
          </div>

          <div className="canvas-stage">
            {!source || !pattern ? (
              <div className="empty-preview">
                <div className="empty-art" aria-hidden="true">
                  <span /><span /><span /><span /><span /><span /><span /><span /><span />
                </div>
                <h1>把喜欢的照片<br />变成一颗颗小豆子</h1>
                <p>上传图片后，图纸会在这里自动生成</p>
                <button type="button" className="primary-button" onClick={() => fileRef.current?.click()}><Upload size={17} /> 上传一张照片</button>
                <button type="button" className="ghost-button" onClick={loadSample}><WandSparkles size={16} /> 查看示例效果</button>
              </div>
            ) : previewMode === 'original' ? (
              <div className={`original-preview ${cutout ? 'has-transparency' : ''}`}><img src={patternSource?.url} alt={cutout ? '抠图结果预览' : '原图预览'} /></div>
            ) : (
              <div className="canvas-scroll">
                <PatternPreview pattern={pattern} mode={previewMode} showCodes={showCodes} boardLines={boardLines} zoom={zoom} />
              </div>
            )}
          </div>
          {pattern && (
            <div className="stage-status">
              <span><i className="status-dot" /> {cutout ? `已抠图 · ${selectedPalette.name} · 空白格不计数` : `已按 ${selectedPalette.name} 完成匹配`}</span>
              <span>{pattern.width} × {pattern.height} 格</span>
            </div>
          )}
        </section>

        <aside className="summary-panel panel">
          <div className="panel-heading summary-heading">
            <div><span className="step-badge">02</span><h2>成品清单</h2></div>
          </div>

          {!pattern ? (
            <div className="summary-empty"><span><FileDown size={25} /></span><strong>等待生成图纸</strong><p>上传图片后，这里会统计尺寸、颜色和每种豆子的用量。</p></div>
          ) : (
            <>
              <div className="metrics-grid">
                <div><span>豆子总数</span><strong>{pattern.totalBeads.toLocaleString()}</strong><small>颗</small></div>
                <div><span>使用颜色</span><strong>{pattern.usage.length}</strong><small>色</small></div>
                <div><span>成品尺寸</span><strong>{physicalWidth} × {physicalHeight}</strong><small>cm</small></div>
                <div><span>预计拼板</span><strong>{Math.ceil(pattern.width / 29)} × {Math.ceil(pattern.height / 29)}</strong><small>块</small></div>
              </div>

              <div className="usage-heading"><span>用豆明细</span><small>按数量排序</small></div>
              <div className="usage-list">
                {pattern.usage.map((item) => (
                  <div className="usage-item" key={item.color.code}>
                    <span className="bead-swatch" style={{ background: item.color.hex }}><i /></span>
                    <div><strong>{item.color.code}</strong><small>{item.color.family}</small></div>
                    <span className="usage-bar"><i style={{ width: `${Math.max(5, item.percent * 100)}%`, background: item.color.hex }} /></span>
                    <b>{item.count}<small> 颗</small></b>
                  </div>
                ))}
              </div>

              <div className="export-card">
                <h3>导出你的图纸</h3>
                <p>一张完整高清图，放大仍清晰。常用操作只保留两项。</p>
                <div className="project-save-row">
                  <input value={projectName} maxLength={60} onChange={(event) => setProjectName(event.target.value)} aria-label="工程名称" placeholder="工程名称" />
                  <button type="button" onClick={saveCurrentProject} disabled={isSavingProject}><Save size={14} /> {isSavingProject ? '保存中' : '保存工程'}</button>
                  <button type="button" onClick={openProjectManager}><FolderOpen size={14} /> 工程管理</button>
                </div>
                <div className="export-primary-row">
                  <button type="button" className="export-primary" onClick={() => exportFullPattern(false)} disabled={isExporting}><Download size={16} /> {isExporting ? '正在生成图纸…' : '普通高清图'}</button>
                  <button type="button" className="export-mirror" onClick={() => exportFullPattern(true)} disabled={isExporting}><FlipHorizontal2 size={16} /> 镜像成品图</button>
                </div>
                {exportInfo && <span className="export-status"><Check size={13} /> {exportInfo}</span>}
                <details className="export-details">
                  <summary><span>水印设置</span><small>{watermarkEnabled ? '已开启' : '未开启'}</small></summary>
                  <div className="export-details-body">
                    <div className="watermark-control">
                      <Toggle label="导出时加水印" checked={watermarkEnabled} onChange={setWatermarkEnabled} />
                      {watermarkEnabled && (
                        <label className="watermark-input">
                          <span><Stamp size={13} /> 水印文字</span>
                          <input type="text" maxLength={60} value={watermarkText} placeholder={DEFAULT_WATERMARK_TEXT} onChange={(event) => setWatermarkText(event.target.value)} />
                          <label className="watermark-strength">
                            <span>水印强度 <b>{watermarkOpacity}%</b></span>
                            <input type="range" min="10" max="30" step="1" value={watermarkOpacity} onChange={(event) => setWatermarkOpacity(Number(event.target.value))} />
                          </label>
                          <small>水印会斜铺在整张导出图上。</small>
                        </label>
                      )}
                    </div>
                  </div>
                </details>
                <details className="export-details">
                  <summary><span>更多导出格式</span><small>PNG · SVG · CSV</small></summary>
                  <div className="export-details-body">
                    <div className="export-actions">
                      <button type="button" onClick={exportCurrentStyle} disabled={isExporting || previewMode === 'original'}><Download size={14} /> 当前样式 PNG</button>
                      <button type="button" onClick={exportSvg} disabled={isExporting}><FileCode2 size={14} /> SVG 无损图</button>
                      <button type="button" onClick={() => downloadCsv(pattern)} disabled={isExporting}><FileDown size={14} /> CSV 清单</button>
                    </div>
                  </div>
                </details>
                <details className="export-details">
                  <summary><span>打印专用 PDF</span><small>需要实际尺寸时使用</small></summary>
                  <div className="export-details-body">
                    <div className="pdf-export-box">
                      <div className="pdf-options">
                        <label><span>纸张</span><select value={pdfPaper} onChange={(event) => setPdfPaper(event.target.value as PaperSize)}><option value="a4">A4</option><option value="a3">A3</option><option value="custom">自定义</option></select></label>
                        <label><span>方向</span><select value={pdfOrientation} onChange={(event) => setPdfOrientation(event.target.value as PrintOrientation)}><option value="auto">自动</option><option value="portrait">纵向</option><option value="landscape">横向</option></select></label>
                        <label><span>比例</span><select value={pdfScaleMode} onChange={(event) => setPdfScaleMode(event.target.value as 'actual' | 'fit')}><option value="actual">100% 原尺寸</option><option value="fit">适合纸张</option></select></label>
                        <label><span>格距 mm</span><input type="number" min="1" max="12" step="0.1" value={pdfBeadSize} onChange={(event) => setPdfBeadSize(Math.max(1, Number(event.target.value) || 2.6))} /></label>
                      </div>
                      {pdfPaper === 'custom' && <div className="custom-paper-row"><label>宽 <input type="number" min="100" value={pdfCustomPaper.width} onChange={(event) => setPdfCustomPaper((value) => ({ ...value, width: Number(event.target.value) }))} /> mm</label><label>高 <input type="number" min="100" value={pdfCustomPaper.height} onChange={(event) => setPdfCustomPaper((value) => ({ ...value, height: Number(event.target.value) }))} /> mm</label></div>}
                      <small>打印时请选择“实际大小 / 100%”，系统会自动排版并附上色号表。</small>
                      <div><button type="button" onClick={() => exportPhysicalPdf(false)} disabled={isExporting}><FileDown size={14} /> 普通 PDF</button><button type="button" onClick={() => exportPhysicalPdf(true)} disabled={isExporting}><FlipHorizontal2 size={14} /> 镜像 PDF</button></div>
                    </div>
                  </div>
                </details>
              </div>
            </>
          )}
          <div className="palette-note"><span className="swatch-stack"><i /><i /><i /></span><p><strong>{selectedPalette.name} · {activePalette.length} 色可用</strong><br />当前品牌色号会同步用于图纸、用量统计与导出；屏幕色值为近似值</p><ChevronDown size={14} /></div>
        </aside>
      </main>
      {source && cutout && isEditingCutout && (
        <CutoutEditor
          sourceImage={source.image}
          cutoutImage={cutout.image}
          onApply={applyManualCutout}
          onClose={() => setIsEditingCutout(false)}
        />
      )}
      {pattern && generatedPattern && isEditingPattern && (
        <PatternEditor
          pattern={pattern}
          originalPattern={generatedPattern}
          palette={activePalette}
          canUndo={patternHistory.index > 0}
          canRedo={patternHistory.index >= 0 && patternHistory.index < patternHistory.items.length - 1}
          onCommit={commitPatternEdit}
          onUndo={undoPatternEdit}
          onRedo={redoPatternEdit}
          onReset={resetPatternEdits}
          onClose={() => setIsEditingPattern(false)}
        />
      )}
      {patternSource && isEditingComposition && (
        <CompositionEditor
          image={patternSource.image}
          width={options.width}
          height={options.height}
          fit={options.fit}
          transform={options.transform}
          onApply={(transform) => updateOption('transform', transform)}
          onClose={() => setIsEditingComposition(false)}
        />
      )}
      {isManagingPalette && (
        <PaletteManager
          selectedId={paletteId}
          selectedPalette={selectedPalette}
          customPalette={customPalette}
          disabledCodes={selectedDisabledCodes}
          onSelect={selectPalette}
          onImport={importCustomPalette}
          onToggleColor={togglePaletteColor}
          onEnableAll={() => setDisabledPaletteColors((current) => ({ ...current, [paletteId]: [] }))}
          onClose={() => setIsManagingPalette(false)}
        />
      )}
      {isManagingProjects && (
        <ProjectManager
          projects={projectSnapshots}
          onLoad={loadProjectSnapshot}
          onDuplicate={(project) => { void duplicateProject(project) }}
          onExport={exportProjectFile}
          onDelete={(project) => { void removeProject(project) }}
          onImport={(file) => { void importProjectFile(file) }}
          onClose={() => setIsManagingProjects(false)}
        />
      )}
      {pattern && isTrackingProgress && (
        <ProgressTracker pattern={pattern} onClose={() => setIsTrackingProgress(false)} />
      )}
    </div>
  )
}

export default App
