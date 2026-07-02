interface Props {
  enabled: boolean
  seconds: number
  onToggle: (v: boolean) => void
  onChange: (s: number) => void
}

export default function TimerInput({ enabled, seconds, onToggle, onChange }: Props) {
  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div className="timer-toggle-group" style={{ marginBottom: '16px' }}>
      <label className="checkbox-label" style={{ fontSize: '14px' }}>
        <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} />
        Enable timer
      </label>
      {enabled && (
        <div className="timer-presets">
          {[
            { label: '30s', sec: 30 },
            { label: '1m', sec: 60 },
            { label: '5m', sec: 300 },
          ].map(p => (
            <button key={p.sec} type="button" onClick={() => onChange(p.sec)}
              className={`timer-preset-btn ${seconds === p.sec ? '' : ''}`}
              style={seconds === p.sec ? { background: 'var(--accent)', color: 'var(--text-on-accent)' } : undefined}
            >{p.label}</button>
          ))}
          <input
            type="text" value={mmss}
            onChange={e => {
              const m = /^(\d+):(\d+)$/.exec(e.target.value)
              if (m) onChange(parseInt(m[1]) * 60 + parseInt(m[2]))
            }}
            style={{ width: '80px', padding: '4px 8px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
            placeholder="mm:ss"
          />
        </div>
      )}
    </div>
  )
}
