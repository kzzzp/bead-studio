import { Copy, Download, FileUp, FolderOpen, Trash2, X } from 'lucide-react'
import { useRef } from 'react'
import type { ProjectSnapshot } from './projectFormat.ts'

interface ProjectManagerProps {
  projects: ProjectSnapshot[]
  onLoad: (project: ProjectSnapshot) => void
  onDuplicate: (project: ProjectSnapshot) => void
  onExport: (project: ProjectSnapshot) => void
  onDelete: (project: ProjectSnapshot) => void
  onImport: (file: File) => void
  onClose: () => void
}

export function ProjectManager({ projects, onLoad, onDuplicate, onExport, onDelete, onImport, onClose }: ProjectManagerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="project-manager-backdrop" role="presentation">
      <section className="project-manager" role="dialog" aria-modal="true" aria-labelledby="project-manager-title">
        <header>
          <div><strong id="project-manager-title">本地工程与历史版本</strong><span>工程只保存在这台设备，也可以导出文件备份或换设备导入。</span></div>
          <button type="button" className="editor-icon-button" onClick={onClose} aria-label="关闭工程管理"><X size={18} /></button>
        </header>
        <div className="project-manager-toolbar">
          <span>共 {projects.length} 个本地快照</span>
          <input ref={fileRef} type="file" accept=".bead-project,.json,application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.currentTarget.value = '' }} />
          <button type="button" onClick={() => fileRef.current?.click()}><FileUp size={15} /> 导入工程文件</button>
        </div>
        <main>
          {!projects.length ? <div className="empty-projects"><FolderOpen size={32} /><strong>还没有保存过工程</strong><span>返回主界面，输入工程名称后点击“保存当前工程”。</span></div> : projects.map((project) => (
            <article key={project.id}>
              <div className="project-thumb" style={{ backgroundImage: `url(${project.sourceDataUrl})` }} />
              <div className="project-meta"><strong>{project.name}</strong><span>{project.pattern.width} × {project.pattern.height} 格 · {project.pattern.totalBeads.toLocaleString()} 颗 · {project.pattern.usage.length} 色</span><small>{new Date(project.savedAt).toLocaleString('zh-CN')} · {project.paletteId.toUpperCase()}</small></div>
              <div className="project-actions"><button type="button" className="project-open" onClick={() => onLoad(project)}><FolderOpen size={14} /> 打开</button><button type="button" onClick={() => onDuplicate(project)} title="复制方案"><Copy size={14} /></button><button type="button" onClick={() => onExport(project)} title="导出工程"><Download size={14} /></button><button type="button" className="project-delete" onClick={() => onDelete(project)} title="删除快照"><Trash2 size={14} /></button></div>
            </article>
          ))}
        </main>
        <footer><span>每次保存都会生成独立快照，因此可以保留多个历史版本。</span><button type="button" className="primary-button" onClick={onClose}>完成</button></footer>
      </section>
    </div>
  )
}
