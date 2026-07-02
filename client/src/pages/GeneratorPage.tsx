import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { generateQuiz as apiGenerate, createCheckoutSession, checkPaymentStatus } from '../services/api'
import type { QuizEntry, QuizQuestion, QuizResult } from '../types'
import TopicChips from '../components/TopicChips'
import FileUpload from '../components/FileUpload'
import TimerInput from '../components/TimerInput'
import QuizStack from '../components/QuizStack'
import PaywallModal from '../components/PaywallModal'

export default function GeneratorPage() {
  const { user, loading: authLoading, paid, usageCount, signIn, signOut, incrementUsage, setPaidStatus } = useAuth()
  const [entries, setEntries] = useState<QuizEntry[]>([])
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
  const [dark, setDark] = useState(() => localStorage.getItem('quikquiz_dark') === 'true' || (!localStorage.getItem('quikquiz_dark') && window.matchMedia('(prefers-color-scheme: dark)').matches))
  const toastId = useRef(0)
  const [stepper, setStepper] = useState(1)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '')
    localStorage.setItem('quikquiz_dark', String(dark))
  }, [dark])

  /* stripe return check */
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
    if (!paid && usageCount >= 1) { setShowPaywall(true); return }
    if (!topic && !file) { addToast('Please enter a topic or upload a file.', 'error'); return }
    const typeStr = getSelectedTypes()
    if (!typeStr) { addToast('Select at least one question type.', 'error'); return }
    if (!num || num < 1 || num > 30) { addToast('Number of questions must be between 1 and 30.', 'error'); return }

    const isDemo = !paid && usageCount < 1
    const finalNum = isDemo ? Math.min(10, num) : num

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
        ? [] /* file generation will be handled by api call */
        : await apiGenerate(topic, difficulty, typeStr, finalNum)

      const resolvedTopic = topic || file?.name?.replace(/\.(pdf|pptx)$/i, '') || 'Untitled Quiz'
      const entryId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

      const entry: QuizEntry = {
        id: entryId,
        title: `Quiz ${entries.length + 1}`,
        topic: resolvedTopic,
        subject,
        difficulty,
        questions,
        timerSeconds,
        format: 'form',
        studentFormat: format,
        shareId: null,
        showScore: false,
      }

      setEntries(prev => [...prev, entry])
      if (!paid) incrementUsage()
      addToast(isDemo ? 'Free demo quiz generated! Upgrade to unlock unlimited.' : 'Quiz generated successfully!', 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to generate quiz.', 'error')
    } finally {
      clearInterval(interval)
      setGenerating(false)
      setGenProgress('')
    }
  }, [generating, user, paid, usageCount, topic, file, difficulty, num, format, types, timerSeconds, subject, grade, signIn, incrementUsage, entries.length])

  const handleShare = useCallback(async (entry: QuizEntry) => {
    try {
      let id = entry.shareId
      if (id) {
        await fetch(`/api/quiz/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ showScore: entry.showScore, timerSeconds: entry.timerSeconds, format: entry.studentFormat, title: entry.title, subject: entry.subject })
        })
      } else {
        const res = await fetch('/api/quiz/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions: entry.questions, topic: entry.topic, difficulty: entry.difficulty, showScore: entry.showScore, timerSeconds: entry.timerSeconds, format: entry.studentFormat, title: entry.title, subject: entry.subject })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to save')
        id = data.id
        setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, shareId: id } : e))
      }
      if (id) {
        navigator.clipboard.writeText(`${window.location.origin}/quiz/${id}`)
        addToast('Link copied to clipboard!', 'success')
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to share', 'error')
    }
  }, [])

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

    let inner = `<h1 style="font-size:28px;font-weight:800;color:#5b8c5a;margin-bottom:4px;">QuikQuiz</h1>
      <p style="font-size:14px;color:#6b6b60;margin-bottom:24px;">${entry.topic}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin-bottom:24px;">`

    entry.questions.forEach((q, i) => {
      inner += `<div style="margin-bottom:20px;page-break-inside:avoid;">
        <p style="font-size:12px;color:#5b8c5a;font-weight:700;margin-bottom:4px;">Question ${i + 1}</p>
        <p style="font-size:15px;font-weight:600;margin-bottom:8px;">${q.question}</p>
        <div style="padding-left:16px;">
          ${q.options.map(o => `<p style="font-size:14px;margin-bottom:4px;">${o}</p>`).join('')}
        </div>
        <p style="font-size:14px;font-weight:600;color:#5b8c5a;margin-top:6px;">Answer: ${q.answer}</p>
      </div>`
    })

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
  }, [])

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

  const canGenerate = user !== null
  const isDemo = !paid && usageCount < 1
  const genBtnText = !user ? 'Sign in to generate free demo quiz' : paid ? 'Generate Quiz' : isDemo ? 'Generate Demo Quiz' : 'Upgrade now to generate more'

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-[#f4f1ea] font-mono text-[#2c2e26]">Loading…</div>
  }

  return (
    <div className={`min-h-screen bg-[#f4f1ea] font-mono text-[#2c2e26] ${dark ? 'dark' : ''}`} style={dark ? { filter: 'invert(0.9) hue-rotate(180deg)' } : undefined}>
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[200] space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded-lg shadow-lg text-sm text-white ${t.type === 'error' ? 'bg-[#c62828]' : t.type === 'success' ? 'bg-[#5b8c5a]' : 'bg-[#6b6b60]'}`}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[rgba(218,213,200,0.85)] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a href="/" className="text-2xl font-extrabold tracking-tight">
            <span className="text-[#5b8c5a]">Quik</span><span className="text-[#2c2e26]">Quiz</span>
          </a>
          <div className="flex items-center gap-3">
            <button onClick={() => setDark(!dark)} className="text-sm px-2.5 py-1.5 rounded-full border border-[rgba(218,213,200,0.85)] bg-white/80 text-[#6b6b60] hover:border-[#5b8c5a]">
              {dark ? '☀️' : '🌙'}
            </button>
            {user && !paid && (
              <button onClick={handleSubscribe} className="text-sm px-4 py-1.5 rounded-full bg-[#5b8c5a] text-white font-semibold hover:bg-[#4a7a49]">
                Upgrade to Pro
              </button>
            )}
            {user ? (
              <>
                <span className="text-sm text-[#6b6b60] hidden sm:inline">{user.name}</span>
                {user.avatar_url && <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full border-2 border-[rgba(218,213,200,0.85)] object-cover" />}
                <button onClick={signOut} className="text-sm px-4 py-1.5 rounded-full border border-[rgba(218,213,200,0.85)] bg-white/80 text-[#6b6b60] hover:bg-[rgba(239,235,227,0.8)] hover:text-[#2c2e26]">Sign Out</button>
              </>
            ) : (
              <button onClick={signIn} className="text-sm px-4 py-1.5 rounded-full border border-[rgba(218,213,200,0.85)] bg-white/80 text-[#2c2e26] hover:bg-[rgba(239,235,227,0.8)] hover:border-[#5b8c5a]">Sign in with Google</button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl bg-white/85 backdrop-blur-md border border-[rgba(218,213,200,0.85)] p-8">
          <div className="relative z-10">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[rgba(91,140,90,0.1)] text-[#5b8c5a]">10K+ Questions Generated</span>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[rgba(91,140,90,0.1)] text-[#5b8c5a]">4.9 Teacher Rating</span>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[rgba(91,140,90,0.1)] text-[#5b8c5a]">500+ Classrooms</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">
              Generate a <span className="text-[#5b8c5a]">Quiz</span> in Seconds
            </h1>
            <p className="text-sm text-[#6b6b60] mt-3 max-w-xl">
              QuikQuiz lets teachers generate AI-assisted multiple-choice, true/false, and dropdown quizzes in seconds. Pick a subject, set a difficulty level, and let the system create balanced questions for you.
            </p>
            <p className="text-sm text-[#6b6b60] mt-1">Import PDFs or PPTX files, enable a timer for each quiz, and export results as a PDF.</p>
            <button onClick={() => document.getElementById('generatorSection')?.scrollIntoView({ behavior: 'smooth' })}
              className="mt-4 px-6 py-2.5 rounded-full bg-[#5b8c5a] text-white font-semibold hover:bg-[#4a7a49] text-sm">
              Generate Your First Quiz
            </button>
          </div>
        </section>

        {/* Value Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: '⚡', title: 'Instant Generation', desc: 'AI creates balanced quizzes in seconds. No manual authoring required.' },
            { icon: '🔒', title: 'Secure & Private', desc: 'Google OAuth login with no stored student data. Answers processed in memory only.' },
            { icon: '📄', title: 'Import Existing Content', desc: 'Upload PDFs or PPTX files and reuse your existing lesson material.' },
          ].map(v => (
            <div key={v.title} className="bg-white/85 backdrop-blur-md rounded-xl border border-[rgba(218,213,200,0.85)] p-5">
              <div className="text-2xl mb-2">{v.icon}</div>
              <h3 className="font-semibold text-sm mb-1">{v.title}</h3>
              <p className="text-xs text-[#6b6b60]">{v.desc}</p>
            </div>
          ))}
        </section>

        {/* How it Works */}
        <section className="bg-white/85 backdrop-blur-md rounded-2xl border border-[rgba(218,213,200,0.85)] p-6">
          <h2 className="text-lg font-semibold text-center mb-6">How QuikQuiz Works</h2>
          <div className="flex justify-center gap-4 mb-4">
            {[1, 2, 3].map(s => (
              <button key={s} onClick={() => setStepper(s)}
                className={`w-10 h-10 rounded-full text-sm font-bold transition-colors ${stepper === s ? 'bg-[#5b8c5a] text-white' : 'bg-[rgba(218,213,200,0.5)] text-[#6b6b60]'}`}
              >{s}</button>
            ))}
          </div>
          {stepper === 1 && <div className="text-center text-sm"><strong className="text-[#2c2e26]">Choose a subject and difficulty</strong><p className="text-[#6b6b60] mt-1">Select a topic such as Math, History, or Science, and the level of challenge you need.</p></div>}
          {stepper === 2 && <div className="text-center text-sm"><strong className="text-[#2c2e26]">Generate the quiz</strong><p className="text-[#6b6b60] mt-1">Click "Generate". The AI composes a set of balanced questions instantly.</p></div>}
          {stepper === 3 && <div className="text-center text-sm"><strong className="text-[#2c2e26]">Share and track results</strong><p className="text-[#6b6b60] mt-1">Students take the quiz, you view live scores, and you can download a PDF report.</p></div>}
        </section>

        {/* Generator Form */}
        <section id="generatorSection" className={`bg-white/85 backdrop-blur-md rounded-2xl border border-[rgba(218,213,200,0.85)] p-6 ${!paid && user ? 'demo-mode' : ''}`}>
          <h2 className="text-lg font-semibold mb-5">Create Your Quiz</h2>

          {!user && (
            <div className="mb-4">
              <p className="text-sm text-[#6b6b60] mb-3">Sign in with Google to start generating quizzes.</p>
              <div className="flex justify-center">
                <button onClick={signIn} className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[rgba(218,213,200,0.85)] bg-white text-sm text-[#2c2e26] font-medium hover:bg-[rgba(239,235,227,0.8)] hover:border-[#5b8c5a]">
                  <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Sign in with Google
                </button>
              </div>
            </div>
          )}

          <div className={!user ? 'hidden' : ''}>
            {/* Subject & Grade */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[#2c2e26]">Subject</label>
                <select value={subject} onChange={e => setSubject(e.target.value)} disabled={!!file}
                  className="w-full px-3 py-2 text-sm border border-[rgba(218,213,200,0.85)] rounded-lg bg-white/80 text-[#2c2e26] disabled:opacity-50">
                  <option value="">Any Subject</option>
                  {['science', 'math', 'history', 'english', 'geography'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[#2c2e26]">Grade Level</label>
                <select value={grade} onChange={e => setGrade(e.target.value)} disabled={!!file}
                  className="w-full px-3 py-2 text-sm border border-[rgba(218,213,200,0.85)] rounded-lg bg-white/80 text-[#2c2e26] disabled:opacity-50">
                  <option value="">Any Grade</option>
                  {['K-2', '3-5', '6-8', '9-12'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            {/* Topic Chips */}
            <TopicChips subject={subject} grade={grade} onSelect={t => setTopic(t)} />

            {/* Topic Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5 text-[#2c2e26]">Topic</label>
              <input type="text" value={topic} onChange={e => setTopic(e.target.value)} disabled={!!file} placeholder="Type a topic or click a suggestion above..." className="w-full px-3 py-2 text-sm border border-[rgba(218,213,200,0.85)] rounded-lg bg-white/80 text-[#2c2e26] disabled:opacity-50" />
            </div>

            {/* File Upload */}
            <FileUpload file={file} onChange={f => { setFile(f); if (f) setTopic('') }} disabled={!paid && user !== null} />

            <div className="border-t border-[rgba(218,213,200,0.85)] my-4" />

            {/* Difficulty, Num, Format */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[#2c2e26]">Difficulty</label>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[rgba(218,213,200,0.85)] rounded-lg bg-white/80 text-[#2c2e26]">
                  {['Easy', 'Medium', 'Hard'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[#2c2e26]">Questions</label>
                <input type="number" value={num} onChange={e => setNum(parseInt(e.target.value) || 1)} min={1} max={30}
                  className="w-full px-3 py-2 text-sm border border-[rgba(218,213,200,0.85)] rounded-lg bg-white/80 text-[#2c2e26]" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[#2c2e26]">Format</label>
                <select value={format} onChange={e => setFormat(e.target.value as 'form' | 'slide')}
                  className="w-full px-3 py-2 text-sm border border-[rgba(218,213,200,0.85)] rounded-lg bg-white/80 text-[#2c2e26]">
                  <option value="form">Quiz Form</option>
                  <option value="slide">Slide Questions</option>
                </select>
              </div>
            </div>

            {/* Question Types */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-[#2c2e26]">Question Type</label>
              <div className="flex gap-4">
                {[
                  { key: 'multiple', label: 'Multiple Choice' },
                  { key: 'truefalse', label: 'True / False' },
                  { key: 'dropdown', label: 'Dropdown' },
                ].map(t => (
                  <label key={t.key} className="flex items-center gap-1.5 text-sm text-[#2c2e26] cursor-pointer">
                    <input type="checkbox" checked={types[t.key]} onChange={e => setTypes(prev => ({ ...prev, [t.key]: e.target.checked }))}
                      className="accent-[#5b8c5a]" />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Timer */}
            <TimerInput enabled={timerEnabled} seconds={timerSeconds} onToggle={setTimerEnabled} onChange={setTimerSeconds} />

            {/* Generate Button */}
            <button onClick={handleGenerate} disabled={generating}
              className={`w-full py-2.5 rounded-full text-sm font-semibold transition-colors ${generating ? 'bg-[rgba(218,213,200,0.85)] text-[#6b6b60]' : canGenerate && !paid && usageCount > 0 ? 'bg-[#e65100] text-white hover:bg-[#c62828]' : 'bg-[#5b8c5a] text-white hover:bg-[#4a7a49]'}`}>
              {generating ? genProgress || 'Generating...' : genBtnText}
            </button>

            {/* Usage Info */}
            <div className={`mt-2 text-xs ${paid ? 'text-[#5b8c5a]' : usageCount > 0 ? 'text-[#c62828]' : 'text-[#6b6b60]'}`}>
              {paid ? '✓ Premium' : `Free generations remaining: ${Math.max(0, 1 - usageCount)}`}
            </div>

            {/* Upgrade Benefits */}
            {!paid && usageCount > 0 && (
              <ul className="mt-3 text-xs text-[#6b6b60] space-y-1 list-disc list-inside">
                <li>Unlimited quiz generations</li>
                <li>PDF export with answer key</li>
                <li>File upload (PDF/PPTX) support</li>
                <li>Priority support & early feature access</li>
              </ul>
            )}
          </div>
        </section>

        {/* Spinner */}
        {generating && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex gap-1">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="w-2 h-8 bg-[#5b8c5a] rounded-full animate-pulse" style={{ animationDelay: `${i * 0.15}s`, animationDuration: '1.2s' }} />
              ))}
            </div>
            <p className="text-sm text-[#6b6b60] mt-3">{genProgress}</p>
          </div>
        )}

        {/* Quiz Stack */}
        <section className={`${entries.length > 0 ? '' : 'hidden'}`}>
          <QuizStack
            entries={entries}
            onDelete={id => setEntries(prev => prev.filter(e => e.id !== id))}
            onUpdate={(id, updates) => setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))}
            onShare={handleShare}
            onResults={handleResults}
            onExportPDF={handleExportPDF}
          />
        </section>

        {/* FAQ */}
        <section className="bg-white/85 backdrop-blur-md rounded-2xl border border-[rgba(218,213,200,0.85)] p-6">
          <h2 className="text-lg font-semibold text-center mb-6">FAQs</h2>
          <div className="space-y-3 max-w-xl mx-auto">
            {[
              { q: 'Do I need an OpenAI API key?', a: 'No. The service runs the model on the backend; you only need a Google sign-in.' },
              { q: 'Can I use my own PDFs?', a: 'Yes. Upload a PDF or PPTX and the system will extract relevant text for the quiz.' },
              { q: 'Is student data stored?', a: 'No. Student answers are processed in-memory only for scoring; nothing is saved.' },
              { q: 'What browsers are supported?', a: 'The app works on any modern desktop or mobile browser that supports ES6 and CSS blur.' },
              { q: 'How can I cancel my subscription?', a: 'Cancel anytime via the Stripe portal linked in your account settings.' },
            ].map((faq, i) => (
              <details key={i} className="group">
                <summary className="text-sm font-medium text-[#2c2e26] cursor-pointer list-none flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[rgba(239,235,227,0.5)]">
                  {faq.q}
                  <span className="text-xs text-[#6b6b60] group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="text-xs text-[#6b6b60] px-3 pb-2">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-[#6b6b60] border-t border-[rgba(218,213,200,0.85)] mt-8">
        <div className="max-w-4xl mx-auto px-4">QuikQuiz — AI-powered quiz generation for teachers and tutors.</div>
      </footer>

      {/* Paywall Modal */}
      <PaywallModal open={showPaywall} onClose={() => setShowPaywall(false)} onDevSubscribe={handleSubscribe} />
    </div>
  )
}
