import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { createCheckoutSession } from '../services/api'

export default function PricingPage() {
  const navigate = useNavigate()
  const { user, signIn } = useAuth()
  const [dark, setDark] = useState(() => localStorage.getItem('quikquiz_dark') === 'true' || (!localStorage.getItem('quikquiz_dark') && window.matchMedia('(prefers-color-scheme: dark)').matches))

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '')
    localStorage.setItem('quikquiz_dark', String(dark))
  }, [dark])

  const handleSubscribe = async () => {
    if (!user) { signIn(); return }
    try {
      const url = await createCheckoutSession()
      if (url) { window.location.href = url; return }
    } catch {}
    alert('Subscription processing...')
  }

  return (
    <>
      <header>
        <div style={{ maxWidth: 'var(--max-content-width)', margin: '0 auto', padding: '0 var(--spacing-base)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
          <a href="/" style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.01em', textDecoration: 'none' }}>
            <span className="gradient-text">QuikQuiz</span>
          </a>
          <div className="flex-center" style={{ gap: '8px' }}>
            <button onClick={() => setDark(!dark)} className="dark-toggle">{dark ? '☀' : '☾'}</button>
            <button onClick={() => navigate('/generate')} className="btn btn-sm btn-primary">Go to App</button>
          </div>
        </div>
      </header>

      <main className="main-container" style={{ textAlign: 'center' }}>
        <h1 className="section-title">Simple, transparent pricing</h1>
        <p className="section-subtitle">Start free. Upgrade when you outgrow the basics.</p>

        <div className="pricing-cards" style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', marginTop: '32px', maxWidth: '800px', margin: '32px auto 0' }}>
          {/* Free */}
          <div className="pricing-card">
            <div className="pricing-card-header">
              <h4 className="pricing-plan" style={{ fontSize: '18px' }}>Free</h4>
              <div className="pricing-price">$0</div>
              <p className="pricing-desc" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Try before you buy</p>
            </div>
            <ul className="pricing-features" style={{ textAlign: 'left', marginBottom: '24px' }}>
              {[
                ['3 quiz generations', true],
                ['Multiple choice, T/F, dropdown, fill-blank', true],
                ['Basic difficulty levels', true],
                ['Save & share quizzes', true],
                ['Student timer mode', true],
                ['Adaptive difficulty', false],
                ['Gamified mode', false],
                ['Learning mode', false],
                ['PDF export', false],
                ['Performance insights', false],
                ['File upload (PDF/PPTX)', false],
              ].map(([label, included]) => (
                <li key={label as string} className={`pricing-feature ${included ? 'included' : 'excluded'}`}>
                  {label as string}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/generate')} className="btn btn-outline btn-block">
              Get Started Free
            </button>
          </div>

          {/* Pro */}
          <div className="pricing-card featured">
            <div className="pricing-card-header">
              <div className="pricing-badge">Best Value</div>
              <h4 className="pricing-plan" style={{ fontSize: '18px' }}>Pro</h4>
              <div className="pricing-price">$6.99<span>/mo</span></div>
              <p className="pricing-desc" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Everything you need</p>
            </div>
            <ul className="pricing-features" style={{ textAlign: 'left', marginBottom: '24px' }}>
              {[
                ['Unlimited quiz generation', true],
                ['All question types', true],
                ['Adaptive difficulty mode', true],
                ['Gamified mode', true],
                ['Learning mode', true],
                ['PDF export + print', true],
                ['Performance insights & AI recs', true],
                ['File upload (PDF/PPTX)', true],
                ['Save & share unlimited quizzes', true],
                ['Student timer mode', true],
                ['Priority AI generation speed', true],
              ].map(([label, included]) => (
                <li key={label as string} className={`pricing-feature ${included ? 'included' : 'excluded'}`}>
                  {label as string}
                </li>
              ))}
            </ul>
            <button onClick={handleSubscribe} className="btn btn-primary btn-block">
              Subscribe for $6.99/mo
            </button>
          </div>
        </div>

        <div style={{ marginTop: '48px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          <p>Cancel anytime. No long-term contracts. All subscriptions include a 7-day money-back guarantee.</p>
        </div>
      </main>

      <footer style={{ textAlign: 'center', padding: '24px 16px', fontSize: '13px', color: 'var(--text-muted)', borderTop: 'var(--border-width, 0.63px) solid var(--border)' }}>
        <div className="main-container" style={{ padding: '0' }}>
          QuikQuiz — AI-powered quiz generation for teachers and tutors.
        </div>
      </footer>
    </>
  )
}
