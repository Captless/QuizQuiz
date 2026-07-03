import { useRef, useState, useCallback } from 'react'

interface Props {
  file: File | null
  onChange: (f: File | null) => void
  disabled: boolean
}

export default function FileUpload({ file, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const validate = useCallback((f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (ext !== 'pdf' && ext !== 'pptx') return 'Only PDF and PPTX files are supported.'
    if (f.size > 2 * 1024 * 1024) return 'File exceeds 2MB limit.'
    return null
  }, [])

  const handleFile = useCallback((f: File) => {
    const err = validate(f)
    if (err) { alert(err); return }
    onChange(f)
  }, [onChange, validate])

  return (
    <div className="upload-section">
      <div className="section-divider"><span className="section-divider-text">Or upload a file</span></div>
      {file ? (
        <div className="file-info">
          <span className="file-info-name">{file.name}</span>
          <button onClick={() => onChange(null)} className="btn-icon" disabled={disabled}>✕</button>
        </div>
      ) : (
        <div
          className={`file-drop-zone ${dragOver ? 'drag-over' : ''} ${disabled ? 'hidden' : ''}`}
          role="button" tabIndex={0} aria-label="Upload a PDF or PPTX file"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        >
          <div className="file-drop-content">
            <div className="file-drop-icon">&#8593;</div>
            <p className="file-drop-text">Drop a file here, or click to browse</p>
            <p className="file-drop-hint">Supports PDF and PPTX (max 2MB)</p>
          </div>
          <input ref={inputRef} type="file" accept=".pdf,.pptx" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
      )}
    </div>
  )
}
