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
      <div className="border-t border-[rgba(218,213,200,0.85)] my-4" />
      <label className="block text-sm font-medium mb-1.5 text-[#2c2e26]">Or upload a file (PDF/PPTX)</label>
      {file ? (
        <div className="flex items-center gap-2 px-4 py-2 bg-[rgba(239,235,227,0.5)] rounded-lg text-sm">
          <span className="flex-1 truncate">{file.name}</span>
          <button onClick={() => onChange(null)} className="text-[#6b6b60] hover:text-[#2c2e26]" disabled={disabled}>✕</button>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragOver ? 'border-[#5b8c5a] bg-[rgba(91,140,90,0.05)]' : 'border-[rgba(218,213,200,0.85)] hover:border-[#5b8c5a]'} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        >
          <div className="text-3xl mb-1">📄</div>
          <p className="text-sm text-[#6b6b60]">Drop a file here, or click to browse</p>
          <p className="text-xs text-[#6b6b60] mt-1">Supports PDF and PPTX (max 2MB)</p>
          <input ref={inputRef} type="file" accept=".pdf,.pptx" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
      )}
    </div>
  )
}
