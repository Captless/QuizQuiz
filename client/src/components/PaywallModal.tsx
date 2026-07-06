import { createCheckoutSession } from '../services/api'

interface Props {
  open: boolean
  onClose: () => void
  onDevSubscribe: () => void
}

export default function PaywallModal({ open, onClose, onDevSubscribe }: Props) {
  if (!open) return null

  const handleUpgrade = async () => {
    try {
      const url = await createCheckoutSession()
      if (url) { window.location.href = url; return }
    } catch {}
    onDevSubscribe()
  }

  return (
    <div className={`paywall-overlay ${open ? 'active' : ''}`} onClick={onClose}>
      <div className="paywall-modal" onClick={e => e.stopPropagation()}>
        <div className="paywall-price">$6.99<span>/mo</span></div>
        <div className="paywall-period">Unlimited access</div>
        <h2 className="card-title" style={{ fontSize: '24px', marginBottom: '8px' }}>Upgrade to QuikQuiz Pro</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Your free demo quota has been used. Upgrade to unlock unlimited quiz generation, PDF export, and advanced features.</p>
        <ul className="paywall-features">
          {['Unlimited quiz generation', 'PDF export with answer key', 'Multiple difficulty levels', 'All question formats', 'Custom question count and timer'].map(f => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <button onClick={handleUpgrade} className="btn btn-primary btn-block">Upgrade to Pro</button>
        <button onClick={onClose} className="btn btn-block btn-secondary" style={{ marginTop: '12px' }}>Close</button>
      </div>
    </div>
  )
}
