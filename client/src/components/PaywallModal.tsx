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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 text-center" onClick={e => e.stopPropagation()}>
        <div className="text-4xl font-extrabold text-[#5b8c5a]">$9<span className="text-lg font-semibold text-[#6b6b60]">/mo</span></div>
        <div className="text-sm text-[#6b6b60] mt-1">Unlimited access</div>
        <h2 className="text-2xl font-extrabold mt-3 mb-2 text-[#2c2e26]">Upgrade to QuikQuiz Pro</h2>
        <p className="text-sm text-[#6b6b60] mb-6">You've used your free quiz. Subscribe to generate unlimited quizzes with PDF export.</p>
        <ul className="text-left space-y-2 mb-6 text-sm text-[#2c2e26]">
          {['Unlimited quiz generation', 'PDF export with answer key', 'Multiple difficulty levels', 'True/False & multiple choice', 'Custom question count & timer'].map(f => (
            <li key={f} className="flex items-center gap-2"><span className="text-[#5b8c5a]">✓</span>{f}</li>
          ))}
        </ul>
        <button onClick={handleUpgrade} className="w-full py-2.5 rounded-full bg-[#5b8c5a] text-white font-semibold hover:bg-[#4a7a49]">Upgrade to Pro</button>
        <button onClick={onClose} className="w-full py-2.5 rounded-full border border-[rgba(218,213,200,0.85)] bg-white/80 text-[#6b6b60] hover:bg-[rgba(239,235,227,0.8)] mt-3">Maybe later</button>
      </div>
    </div>
  )
}
