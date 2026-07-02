interface Props {
  enabled: boolean
  seconds: number
  onToggle: (v: boolean) => void
  onChange: (s: number) => void
}

export default function TimerInput({ enabled, seconds, onToggle, onChange }: Props) {
  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div className="flex items-center gap-4 mb-4 flex-wrap">
      <label className="flex items-center gap-2 text-sm text-[#2c2e26] cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} className="accent-[#5b8c5a]" />
        Enable timer
      </label>
      {enabled && (
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[
              { label: '30s', sec: 30 },
              { label: '1m', sec: 60 },
              { label: '5m', sec: 300 },
            ].map(p => (
              <button key={p.sec} type="button" onClick={() => onChange(p.sec)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${seconds === p.sec ? 'bg-[#5b8c5a] text-white border-[#5b8c5a]' : 'border-[rgba(218,213,200,0.85)] text-[#6b6b60] hover:border-[#5b8c5a]'}`}
              >{p.label}</button>
            ))}
          </div>
          <input
            type="text" value={mmss}
            onChange={e => {
              const m = /^(\d+):(\d+)$/.exec(e.target.value)
              if (m) onChange(parseInt(m[1]) * 60 + parseInt(m[2]))
            }}
            className="w-20 px-2 py-1 text-sm border border-[rgba(218,213,200,0.85)] rounded-lg bg-white/80 text-[#2c2e26]"
            placeholder="mm:ss"
          />
        </div>
      )}
    </div>
  )
}
