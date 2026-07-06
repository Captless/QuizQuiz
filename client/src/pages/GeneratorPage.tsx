import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSavedQuizzes } from '../hooks/useSavedQuizzes'
import { useScrollReveal } from '../hooks/useScrollReveal'
import {
  generateQuiz as apiGenerate,
  createCheckoutSession,
  checkPaymentStatus,
  saveQuiz as apiSaveQuiz,
  updateQuiz as apiUpdateQuiz,
} from '../services/api'
import type { QuizEntry, QuizQuestion, QuizResult } from '../types'
import TopicChips from '../components/TopicChips'
import FileUpload from '../components/FileUpload'
import TimerInput from '../components/TimerInput'
import Spinner from '../components/Spinner'

const QuizStack = lazy(() => import('../components/QuizStack'))
const PaywallModal = lazy(() => import('../components/PaywallModal'))

const VALUE_ITEMS = [
  {
    title: 'Instant Generation',
    desc: 'AI creates balanced quizzes in seconds. No manual authoring required.',
    icon: (
      <svg className="icon" viewBox="0 0 24 24">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    title: 'Secure & Private',
    desc: 'Google OAuth login with no stored student data. Answers processed in memory only.',
    icon: (
      <svg className="icon" viewBox="0 0 24 24">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    title: 'Import Content',
    desc: 'Upload PDFs or PPTX files and reuse your existing lesson material.',
    icon: (
      <svg className="icon" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
]

const FAQS = [
  { q: 'Do I need an OpenAI API key?', a: 'No. The service runs the model on the backend; you only need a Google sign-in.' },
  { q: 'Can I use my own PDFs?', a: 'Yes. Upload a PDF or PPTX and the system will extract relevant text for the quiz.' },
  { q: 'Is student data stored?', a: 'No. Student answers are processed in-memory only for scoring; nothing is saved.' },
  { q: 'What browsers are supported?', a: 'The app works on any modern desktop or mobile browser that supports ES6 and CSS blur.' },
  { q: 'How can I cancel my subscription?', a: 'Cancel anytime via the Stripe portal linked in your account settings.' },
]

export default function GeneratorPage() {
  const { user, loading: authLoading, signIn, signOut, incrementUsage, setPaidStatus, paid: isPaid, usageCount } = useAuth()
  const remainingFree = Math.max(0, 3 - usageCount)
  const outOfFreeQuota = !isPaid && usageCount >= 3
  const { quizzes, loading: quizzesLoading, addQuiz, deleteQuiz, updateQuiz } = useSavedQuizzes()

  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [topic, setTopic] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [difficulty, setDifficulty] = useState('Easy')
  const [num, setNum] = useState(5)
  const [format, setFormat] = useState<'form' | 'slide'>('form')
  const [types, setTypes] = useState<Record<string, boolean>>({ multiple: true, truefalse: false, dropdown: false })
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(300)
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState('')
  const [showPaywall, setShowPaywall] = useState(false)
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([])
  const [quizzesVisible, setQuizzesVisible] = useState(true)
  const [dark, setDark] = useState(() => localStorage.getItem('quikquiz_dark') === 'true' || (!localStorage.getItem('quikquiz_dark') && window.matchMedia('(prefers-color-scheme: dark)').matches))
  const toastId = useRef(0)
  const [stepper, setStepper] = useState(1)
  const [faqOpen, setFaqOpen] = useState<Set<number>>(new Set())
  const toggleFaq = (i: number) => {
    setFaqOpen(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '')
    localStorage.setItem('quikquiz_dark', String(dark))
  }, [dark])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useScrollReveal()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('paid') === 'true') {
      setPaidStatus(true)
      window.history.replaceState({}, '', window.location.pathname)
      return
    }
    const sessionId = params.get('session_id')
    if (sessionId) {
      checkPaymentStatus(sessionId).then(paid => {
        if (paid) {
          setPaidStatus(true)
          addToast('Payment successful! Welcome to QuikQuiz Pro.', 'success')
        }
      })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [setPaidStatus])

  const addToast = (msg: string, type = 'info') => {
    const id = ++toastId.current
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  const getSelectedTypes = () => {
    const checked = Object.entries(types).filter(([, v]) => v).map(([k]) => k)
    return checked.length === 3 ? 'all' : checked.join(',')
  }

  const handleGenerate = useCallback(async () => {
    if (generating) return
    if (!user) { signIn(); return }
    if (!topic && !file) { addToast('Please enter a topic or upload a file.', 'error'); return }
    const typeStr = getSelectedTypes()
    if (!typeStr) { addToast('Select at least one question type.', 'error'); return }
    if (!num || num < 1 || num > 30) { addToast('Number of questions must be between 1 and 30.', 'error'); return }

    if (outOfFreeQuota && !isPaid) {
      setShowPaywall(true)
      return
    }

    setGenerating(true)
    setGenProgress('Generating your quiz...')
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000)
      if (elapsed < 30) setGenProgress(`Generating your quiz... (${elapsed}s)`)
      else if (elapsed < 90) setGenProgress(`This is taking a bit longer... (${elapsed}s)`)
      else setGenProgress(`Thanks for your patience... (${elapsed}s)`)
    }, 1000)

    try {
      const questions: QuizQuestion[] = file
        ? []
        : await apiGenerate(topic, difficulty, typeStr, isPaid ? num : Math.min(10, num), undefined, grade)

      const resolvedTopic = topic || file?.name?.replace(/\.(pdf|pptx)$/i, '') || 'Untitled Quiz'
      const entryId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

      const entry: QuizEntry = {
        id: entryId,
        title: `Quiz ${quizzes.length + 1}`,
        topic: resolvedTopic,
        subject,
        difficulty,
        questions: questions.map(q => ({
          ...q,
          shuffledOptions: [...q.options].sort(() => Math.random() - 0.5),
        })),
        timerSeconds: timerEnabled ? timerSeconds : 0,
        format: 'form',
        studentFormat: format,
        shareId: null,
        showScore: false,
      }

      if (!isPaid) {
        void incrementUsage()
      }

      await addQuiz(entry)
      addToast(isPaid ? 'Quiz generated successfully!' : 'Free demo quiz generated! Upgrade to unlock unlimited.', 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to generate quiz.', 'error')
    } finally {
      clearInterval(interval)
      setGenerating(false)
      setGenProgress('')
    }
  }, [generating, user, signIn, outOfFreeQuota, isPaid, topic, file, difficulty, num, format, types, timerSeconds, subject, quizzes.length, addQuiz, incrementUsage])

  const handleShare = useCallback(async (entry: QuizEntry) => {
    try {
      let id = entry.shareId
      if (id) {
        await apiUpdateQuiz(id, { showScore: entry.showScore, timerSeconds: entry.timerSeconds, format: entry.studentFormat, title: entry.title, subject: entry.subject })
      } else {
        id = await apiSaveQuiz({ questions: entry.questions, topic: entry.topic, difficulty: entry.difficulty, showScore: entry.showScore, timerSeconds: entry.timerSeconds, format: entry.studentFormat, title: entry.title, subject: entry.subject })
        updateQuiz(entry.id, { shareId: id })
      }
      if (id) {
        await navigator.clipboard.writeText(`${window.location.origin}/quiz/${id}`)
        addToast('Link copied to clipboard!', 'success')
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to share', 'error')
    }
  }, [updateQuiz])

  const handleResults = useCallback(async (shareId: string, _questions: QuizQuestion[]): Promise<QuizResult[]> => {
    try {
      const res = await fetch(`/api/quiz/${shareId}/results`)
      const data = await res.json()
      return data.results || []
    } catch { return [] }
  }, [])

  const handleExportPDF = useCallback(async (entry: QuizEntry) => {
    const html2pdf = (await import('html2pdf.js')).default
    const container = document.createElement('div')
    container.style.cssText = 'padding:40px;font-family:Inter,sans-serif;max-width:800px;margin:0 auto'

    let inner = `<div style="position:relative;">
      <h1 style="font-size:28px;font-weight:800;color:#5b8c5a;margin-bottom:4px;">QuikQuiz</h1>
      <p style="font-size:14px;color:#6b6b60;margin-bottom:24px;">${entry.topic}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin-bottom:24px;">`

    entry.questions.forEach((q, i) => {
      inner += `<div style="margin-bottom:20px;page-break-inside:avoid;">
        <p style="font-size:12px;color:#5b8c5a;font-weight:700;margin-bottom:4px;">Question ${i + 1}</p>
        <p style="font-size:15px;font-weight:600;margin-bottom:8px;">${q.question}</p>
        <div style="padding-left:16px;">
          ${q.options ? q.options.map(o => `<p style="font-size:14px;margin-bottom:4px;">${o}</p>`).join('') : '<p style="font-size:14px;margin-bottom:4px;">(fill in the blank)</p>'}
        </div>
        <p style="font-size:14px;font-weight:600;color:#5b8c5a;margin-top:6px;">Answer: ${q.answer}</p>
      </div>`
    })

    // Watermark for free users
    if (!isPaid) {
      inner += `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#9a9a8c;">
        Generated by <strong>QuikQuiz</strong> — quikquiz.app
      </div>`
    }

    inner += '</div>'
    container.innerHTML = inner
    document.body.appendChild(container)

    const safeTopic = entry.topic.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() || 'quiz'
    try {
      await html2pdf().set({
        margin: [15, 15],
        filename: `QuikQuiz-${safeTopic}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'avoid-all' }
      } as any).from(container).save()
    } catch {
      addToast('PDF export failed.', 'error')
    }
    document.body.removeChild(container)
  }, [isPaid])

  const handleSubscribe = useCallback(async () => {
    if (!user) { signIn(); return }
    try {
      const url = await createCheckoutSession()
      if (url) { window.location.href = url; return }
    } catch {}
    setPaidStatus(true)
    setShowPaywall(false)
    addToast('Subscribed! (dev mode)', 'success')
  }, [user, signIn, setPaidStatus])

  const buttonLabel = !user ? 'Sign in to generate free demo quiz' : isPaid ? 'Generate Quiz' : outOfFreeQuota ? 'Out of free generations — Upgrade' : `Generate Demo Quiz (${remainingFree} left)`

  const stepContent = (s: number) => {
    switch (s) {
      case 1: return { title: 'Choose a subject and difficulty', desc: 'Select a topic such as Math, History, or Science, and the level of challenge you need.' }
      case 2: return { title: 'Generate the quiz', desc: 'Click "Generate". The AI composes a set of balanced questions instantly.' }
      case 3: return { title: 'Share and track results', desc: 'Students take the quiz, you view live scores, and you can download a PDF report.' }
      default: return { title: '', desc: '' }
    }
  }

  if (authLoading) {
    return <div className="flex-center" style={{ minHeight: '100vh' }}>Loading…</div>
  }

  return (
    <>
      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>

      {/* Header */}
      <header>
        <div style={{ maxWidth: 'var(--max-content-width)', margin: '0 auto', padding: '0 var(--spacing-base)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
          <a href="/" style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.01em', textDecoration: 'none' }}>
            <span className="gradient-text">QuikQuiz</span>
          </a>
          <div className="flex-center" style={{ gap: '8px' }}>
            <a href="/pricing" style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, display: 'none' }} className="sm:inline">Pricing</a>
            <button onClick={() => setDark(!dark)} className="dark-toggle" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {dark ? '☀' : '☾'}
            </button>
            {user && !isPaid && (
              <button onClick={handleSubscribe} className="btn btn-primary btn-sm">
                Upgrade to Pro
              </button>
            )}
            {user ? (
              <>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'none' }} className="sm:inline">{user.name}</span>
                {user.avatar_url && <img src={user.avatar_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--border)', objectFit: 'cover' }} />}
                <button onClick={signOut} className="btn btn-outline btn-sm">Sign Out</button>
              </>
            ) : (
              <button onClick={signIn} className="btn-custom-google">
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Sign in with Google
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="main-container">
        {/* Hero */}
        <section className="hero reveal reveal-card">
          <div className="hero-bg">
            <div className="blob blob-1" />
            <div className="blob blob-2" />
            <div className="blob blob-3" />
          </div>
          <div className="hero-stats">
            <span className="hero-stat">10K+ Questions Generated</span>
            <span className="hero-stat">4.9 Teacher Rating</span>
            <span className="hero-stat">500+ Classrooms</span>
          </div>
          <h1 className="hero-title">
            Generate a <span className="gradient-text">Quiz</span> in Seconds
          </h1>
          <p className="hero-subtitle">
            QuikQuiz lets teachers generate AI-assisted multiple-choice, true/false, and dropdown quizzes in seconds. Pick a subject, set a difficulty level, and let the system create balanced questions for you.
          </p>
          <p className="hero-subdetail">
            Import PDFs or PPTX files, enable a timer for each quiz, and export results as a PDF.
          </p>
          <button onClick={() => document.getElementById('generatorSection')?.scrollIntoView({ behavior: 'smooth' })}
            className="btn btn-primary btn-lg hero-cta">
            Generate Your First Quiz
          </button>
        </section>

        <div className="hero-divider" />

          {/* Value Cards */}
        <section className="value-cards">
          {VALUE_ITEMS.map(v => (
            <div className="value-card" key={v.title}>
              {v.icon}
              <h3>{v.title}</h3>
              <p>{v.desc}</p>
            </div>
          ))}
        </section>

        {/* Stepper / How it Works */}
        <section className="section-how reveal reveal-card">
          <h2 className="section-title">How QuikQuiz Works</h2>
          <div className="stepper-wrapper">
            <div className="stepper">
              {[1, 2, 3].map(s => (
                <div key={s} onClick={() => setStepper(s)}
                  className={`step ${stepper === s ? 'active' : ''}`}>{s}</div>
              ))}
            </div>
            <div className={`step-overlay ${stepper ? 'show' : ''}`}>
              <h3>{stepContent(stepper).title}</h3>
              <p>{stepContent(stepper).desc}</p>
            </div>
          </div>
        </section>

        {/* Generator Form */}
        <section id="generatorSection" className={`card reveal reveal-card ${!isPaid && user ? 'demo-mode' : ''}`}>
          <h2 className="card-title">Create Your Quiz</h2>

          {!user && (
            <div className="auth-gate">
              <p style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>Sign in with Google to start generating quizzes.</p>
              <button onClick={signIn} className="btn-custom-google">
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Sign in with Google
              </button>
            </div>
          )}

          <div className={!user ? 'hidden' : ''}>
            {/* Subject & Grade */}
            <div className="form-row-2">
              <div className="form-group">
                <label>Subject</label>
                <select value={subject} onChange={e => setSubject(e.target.value)} disabled={!!file}>
                  <option value="">Any Subject</option>
                  {['science', 'math', 'history', 'english', 'geography'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Grade Level</label>
                <select value={grade} onChange={e => setGrade(e.target.value)} disabled={!!file}>
                  <option value="">Any Grade</option>
                  {['K-2', '3-5', '6-8', '9-12'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            {/* Topic Chips */}
            <TopicChips subject={subject} grade={grade} onSelect={t => setTopic(t)} />

            {/* Topic Input */}
            <div className="form-group">
              <label>Topic</label>
              <input type="text" value={topic} onChange={e => setTopic(e.target.value)} disabled={!!file} placeholder="Type a topic or click a suggestion above..." />
            </div>

            {/* File Upload */}
            <FileUpload file={file} onChange={f => { setFile(f); if (f) setTopic('') }} disabled={!isPaid && user !== null} />

            <div className="section-divider"></div>

            {/* Difficulty, Num, Format */}
            <div className="form-row-3">
              <div className="form-group">
                <label>Difficulty</label>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                  {['Easy', 'Medium', 'Hard'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Questions</label>
                <input type="number" value={num} onChange={e => setNum(parseInt(e.target.value) || 1)} min={1} max={30} />
              </div>
              <div className="form-group">
                <label>Format</label>
                <select value={format} onChange={e => setFormat(e.target.value as 'form' | 'slide')}>
                  <option value="form">Quiz Form</option>
                  <option value="slide">Slide Questions</option>
                </select>
              </div>
            </div>

            {/* Question Types */}
            <div className="section-divider"></div>
            <div className="form-group">
              <label>Question Type</label>
              <div className="checkbox-group">
                {[
                  { key: 'multiple', label: 'Multiple Choice' },
                  { key: 'truefalse', label: 'True / False' },
                  { key: 'dropdown', label: 'Dropdown' },
                ].map(t => (
                  <label key={t.key} className="checkbox-label">
                    <input type="checkbox" checked={types[t.key]} onChange={e => setTypes(prev => ({ ...prev, [t.key]: e.target.checked }))} />
                    <span className="custom-checkbox" />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>



              {/* Timer */}
            <TimerInput enabled={timerEnabled} seconds={timerSeconds} onToggle={setTimerEnabled} onChange={setTimerSeconds} />

            {/* Generate Button */}
            <button onClick={outOfFreeQuota && !isPaid ? () => setShowPaywall(true) : handleGenerate} disabled={generating || !user}
              className={`btn btn-block ${generating ? 'btn-secondary' : !user ? 'btn-primary' : isPaid ? 'btn-primary' : outOfFreeQuota ? 'btn-warning' : 'btn-primary'}`}>
              {generating ? genProgress || 'Generating...' : buttonLabel}
            </button>

            {/* Usage Info */}
            <div className="usage-info">
              {isPaid ? 'Premium Plan' : `Free generations remaining: ${remainingFree}`}
            </div>


          </div>
        </section>

        {/* Saved Quizzes */}
        <section className="card reveal reveal-card quiz-stack-section">
          <div className="quiz-stack-header" onClick={() => setQuizzesVisible(v => !v)}>
            <h2 className="card-title" style={{ marginBottom: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Past Quizzes
              <span className="quiz-count-badge">{quizzes.length}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>{quizzesVisible ? '▼' : '▶'}</span>
            </h2>
          </div>
          {quizzesVisible && (
            quizzesLoading ? (
              <Spinner text="Loading quizzes..." />
            ) : (
              <Suspense fallback={<Spinner text="Loading quizzes..." />}>
                {quizzes.length > 0 ? (
                  <QuizStack
                    entries={quizzes}
                    onDelete={id => deleteQuiz(id)}
                    onUpdate={(id, updates) => updateQuiz(id, updates)}
                    onShare={handleShare}
                    onResults={handleResults}
                    onExportPDF={handleExportPDF}
                  />
                ) : (
                  <div className="quiz-stack-empty" style={{ marginTop: '20px' }}>
                    <div className="quiz-stack-empty-icon">—</div>
                    <p className="quiz-stack-empty-title">No quizzes yet</p>
                    <p className="quiz-stack-empty-text">Generate your first quiz above and it will appear here.</p>
                  </div>
                )}
              </Suspense>
            )
          )}
        </section>

        {/* FAQ */}
        <section className="section-faq reveal reveal-card">
          <h2 className="section-title" style={{ marginBottom: 'var(--spacing-xl)' }}>FAQs</h2>
          {FAQS.map((faq, i) => (
            <div key={i} className={`faq-item reveal-card ${faqOpen.has(i) ? 'open' : ''}`}>
              <div className="faq-header" onClick={() => toggleFaq(i)}>{faq.q}</div>
              <div className="faq-body"><p>{faq.a}</p></div>
            </div>
          ))}
        </section>
      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '24px 16px', fontSize: '13px', color: 'var(--text-muted)', borderTop: 'var(--border-width, 0.63px) solid var(--border)' }}>
        <div className="main-container" style={{ padding: '0' }}>
          QuikQuiz — AI-powered quiz generation for teachers and tutors.
        </div>
      </footer>

      {/* Paywall Modal */}
      <Suspense fallback={null}>
        <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} onDevSubscribe={handleSubscribe} />
      </Suspense>
    </>
  )
}
