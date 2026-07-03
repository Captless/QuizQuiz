interface Props {
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

export default function Spinner({ size = 'md', text }: Props) {
  const sizeMap = { sm: 16, md: 24, lg: 40 }
  const px = sizeMap[size]

  return (
    <div className="flex-center" style={{ flexDirection: 'column', gap: '8px', padding: '24px 0' }}>
      <svg width={px} height={px} viewBox="0 0 24 24" fill="none" className="spinner-animate" aria-label="Loading">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {text && <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{text}</span>}
    </div>
  )
}
