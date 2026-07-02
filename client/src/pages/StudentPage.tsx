import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import type { SharedQuiz, QuizQuestion } from '../types'

export default function StudentPage() {
  const { id } = useParams<{ id: string }>()
  const [quiz, setQuiz] = useState<SharedQuiz | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [started, setStarted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [timerRemaining, setTimerRemaining] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [slideIdx, setSlideIdx] = useState(0)
  const [unanswered, setUnanswered] = useState<number[] | null>(null)
  const [score, setScore] = useState<{ correct: number; total: number; pct: number } | null>(null)
  const [dark, setDark] = useState(() => localStorage.getItem('quikquiz_dark') === 'true' || (!localStorage.getItem('quikquiz_dark') && window.matchMedia('(prefers-color-scheme: dark)').matches))
  const timerRef = useRef<number | null>(null)
  const submittedRef = useRef(false)
  const answersRef = useRef<Record<number, string>>({})

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '')
    localStorage.setItem('quikquiz_dark', String(dark))
  }, [dark])

  useEffect(() => {
    if (!id) { setLoading(false); setError(true); return }
    fetch(`/api/quiz/${id}`)
      .then(res => { if (!res.ok) throw new Error('not found'); return res.json() })
      .then(data => { setQuiz(data); setLoading(false) })
      .catch(() => { setLoading(false); setError(true) })
  }, [id])

  const startTimer = useCallback((seconds: number) => {
    if (seconds <= 0) return
    setTimerRemaining(seconds)
    setTimerActive(true)
  }, [])

  useEffect(() => {
    if (!timerActive || timerRemaining <= 0) return
    const intervalId = window.setInterval(() => {
      setTimerRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalId)
          timerRef.current = null
          doSubmit(true, answersRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    timerRef.current = intervalId
    return () => { if (intervalId) clearInterval(intervalId) }
  }, [timerActive])

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  useEffect(() => { answersRef.current = answers }, [answers])

  const handleStart = () => {
    if (!quiz) return
    setStarted(true)
    startTimer(quiz.timerSeconds)
  }

  const handleAnswer = (qi: number, value: string) => {
    if (submittedRef.current) return
    setAnswers(prev => ({ ...prev, [qi]: value }))
    if (quiz?.format === 'slide' && qi < quiz.questions.length - 1) {
      setTimeout(() => setSlideIdx(qi + 1), 200)
    }
  }

  const doSubmit = useCallback((timedOut: boolean, currentAnswers: Record<number, string>) => {
    if (submittedRef.current) return
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setTimerActive(false)

    if (!timedOut && quiz) {
      const unans: number[] = []
      quiz.questions.forEach((_, i) => { if (!currentAnswers[i]) unans.push(i) })
      if (unans.length > 0) {
        setUnanswered(unans)
        return
      }
    }

    submittedRef.current = true
    setSubmitted(true)

    const correct = quiz?.questions.filter((q, i) => currentAnswers[i] === q.answer).length ?? 0
    const total = quiz?.questions.length ?? 0
    const pct = total ? Math.round((correct / total) * 100) : 0
    setScore({ correct, total, pct })

    fetch(`/api/quiz/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: currentAnswers, correct, total, percentage: pct })
    }).catch(() => {})
  }, [quiz, id])

  const handleSubmitClick = () => {
    setUnanswered(null)
    doSubmit(false, answersRef.current)
  }

  if (loading) return <div className="flex-center" style={{ minHeight: '100vh' }}>Loading quiz questions...</div>
  if (error || !quiz) return (
    <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--error)', marginBottom: '8px' }}>Quiz not found</h2>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>This link may have expired or is invalid.</p>
      <a href="/" className="btn btn-sm" style={{ marginTop: '16px', color: 'var(--accent)' }}>Go home</a>
    </div>
  )

  const timerTotal = quiz.timerSeconds || 1
  const timerPct = Math.max(0, (timerRemaining / timerTotal) * 100)
  const timerDisplay = `${String(Math.floor(timerRemaining / 60)).padStart(2, '0')}:${String(timerRemaining % 60).padStart(2, '0')}`
  const timerClass = timerRemaining <= 30 ? 'danger' : timerRemaining <= 60 ? 'warning' : ''

  const scoreCircleClass = score
    ? score.pct === 100 ? 'perfect'
      : score.pct >= 80 ? 'good'
        : score.pct >= 60 ? 'fair' : 'poor'
    : ''

  return (
    <>
      <header>
        <div style={{ maxWidth: 'var(--max-content-width)', margin: '0 auto', padding: '0 var(--spacing-base)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
          <a href="/" style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.01em', textDecoration: 'none' }}>
            <span className="gradient-text">QuikQuiz</span>
          </a>
          <div className="flex-center" style={{ gap: '12px' }}>
            {started && timerActive && (
              <span className={`timer-display ${timerClass}`}>{timerDisplay}</span>
            )}
            <button onClick={() => setDark(!dark)} className="dark-toggle">
              {dark ? '☀' : '☾'}
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 16px' }}>
        <div className="text-center" style={{ marginBottom: '16px' }}>
          {quiz.subject && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{quiz.subject}</div>}
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{quiz.title || quiz.topic || 'Untitled Quiz'}</h1>
          {quiz.topic && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{quiz.topic}</p>}
        </div>

        {!started && !submitted && (
          <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
            <div className="flex-center" style={{ gap: '24px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Questions: <strong style={{ color: 'var(--text-primary)' }}>{quiz.questions.length}</strong></span>
              {quiz.timerSeconds > 0 && (
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Time limit: <strong style={{ color: 'var(--text-primary)' }}>{String(Math.floor(quiz.timerSeconds / 60)).padStart(2, '0')}:{String(quiz.timerSeconds % 60).padStart(2, '0')}</strong></span>
              )}
              {quiz.subject && <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Subject: <strong style={{ color: 'var(--text-primary)' }}>{quiz.subject}</strong></span>}
            </div>
            <button onClick={handleStart} className="btn btn-primary btn-lg">Start Quiz</button>
          </div>
        )}

        {started && timerActive && (
          <div className="timer-bar active">
            <span className={`timer-display ${timerClass}`}>{timerDisplay}</span>
            <div className="timer-track">
              <div className={`timer-fill ${timerClass}`} style={{ width: `${timerPct}%` }} />
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '90px', textAlign: 'right' }}>{Math.round(timerPct)}% remaining</span>
          </div>
        )}

        {started && !submitted && (
          <>
            {quiz.format === 'slide' ? (
              <StudentSlideView
                question={quiz.questions[slideIdx]}
                index={slideIdx}
                total={quiz.questions.length}
                selected={answers[slideIdx]}
                onSelect={(v) => handleAnswer(slideIdx, v)}
                goTo={setSlideIdx}
                onPrev={() => setSlideIdx(s => Math.max(0, s - 1))}
                onNext={() => setSlideIdx(s => Math.min(quiz.questions.length - 1, s + 1))}
              />
            ) : (
              <div style={{ marginBottom: '16px' }}>
                {quiz.questions.map((q, i) => (
                  <StudentQuestionCard key={i} question={q} index={i} selected={answers[i]} onSelect={(v) => handleAnswer(i, v)} />
                ))}
              </div>
            )}

            {unanswered && unanswered.length > 0 && (
              <div style={{ background: 'var(--bg-error)', border: '2px solid var(--error)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '16px', textAlign: 'center' }}>
                <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--error)', marginBottom: '8px' }}>Unanswered Questions</p>
                <div className="flex-center" style={{ gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {unanswered.map(qi => (
                    <button key={qi} onClick={() => {
                      if (quiz.format === 'slide') setSlideIdx(qi)
                      else document.querySelector(`[data-qi="${qi}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      setUnanswered(null)
                    }}
                      className="unanswered-badge">{qi + 1}</button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={handleSubmitClick} disabled={submitted}
              className="btn btn-warning btn-block">Submit Answers</button>
          </>
        )}

        {submitted && score && (
          <div className="text-center" style={{ padding: '24px 0' }}>
            {quiz.showScore !== false ? (
              <>
                <div className={`score-message tier-${score.pct >= 90 ? 'perfect' : score.pct >= 80 ? 'great' : score.pct >= 60 ? 'good' : 'keep'}`}>
                  {score.pct >= 90 ? 'Excellent!' : score.pct >= 80 ? 'Great work!' : score.pct >= 60 ? 'Good effort!' : 'Keep practicing!'}
                </div>
                <div className={`score-circle ${scoreCircleClass}`}>{score.pct}%</div>
                <div className="score-stats">
                  <div className="score-stat correct">
                    <div className="score-stat-value">{score.correct}</div>
                    <div className="score-stat-label">Correct</div>
                  </div>
                  <div className="score-stat incorrect">
                    <div className="score-stat-value">{score.total - score.correct}</div>
                    <div className="score-stat-label">Incorrect</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--success)', marginBottom: '4px' }}>Successfully submitted!</div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Your answers have been recorded.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer style={{ textAlign: 'center', padding: '24px 16px', fontSize: '13px', color: 'var(--text-muted)', borderTop: 'var(--border-width, 0.63px) solid var(--border)' }}>
        <div className="main-container" style={{ padding: '0' }}>
          QuikQuiz — AI-powered quiz generation for teachers and tutors.
        </div>
      </footer>
    </>
  )
}

/* ===== Student Question Card ===== */

function StudentQuestionCard({ question, index, selected, onSelect }: {
  question: QuizQuestion
  index: number
  selected?: string
  onSelect: (v: string) => void
}) {
  const [shuffled] = useState(() => [...question.options].sort(() => Math.random() - 0.5))

  const tagClass = question.type === 'truefalse' ? 'tag-truefalse' : question.type === 'dropdown' ? 'tag-dropdown' : 'tag-multiple'
  const typeLabel = question.type === 'truefalse' ? 'True / False' : question.type === 'dropdown' ? 'Dropdown' : 'Multiple Choice'

  return (
    <div className="question-card" data-qi={index}>
      <div className="question-card-header">
        <span className="question-number">Question {index + 1}</span>
        <span className={`question-tag ${tagClass}`}>{typeLabel}</span>
      </div>
      <p className="question-text">{question.emoji} {question.question}</p>

      {question.type === 'dropdown' ? (
        <div className="dropdown-wrapper">
          <select value={selected || ''} onChange={e => onSelect(e.target.value)} className="dropdown-select">
            <option value="" disabled>— Select an answer —</option>
            {shuffled.map((opt, oi) => <option key={oi} value={opt}>{opt}</option>)}
          </select>
        </div>
      ) : (
        <div className="options-list">
          {shuffled.map((opt, oi) => (
            <div key={oi} onClick={() => onSelect(opt)}
              className={`option-item ${selected === opt ? 'selected' : ''}`}>{opt}</div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ===== Student Slide View ===== */

function StudentSlideView({ question, index, total, selected, onSelect, goTo, onPrev, onNext }: {
  question: QuizQuestion
  index: number
  total: number
  selected?: string
  onSelect: (v: string) => void
  goTo: (i: number) => void
  onPrev: () => void
  onNext: () => void
}) {
  const [shuffled] = useState(() => [...question.options].sort(() => Math.random() - 0.5))

  const tagClass = question.type === 'truefalse' ? 'tag-truefalse' : question.type === 'dropdown' ? 'tag-dropdown' : 'tag-multiple'
  const typeLabel = question.type === 'truefalse' ? 'True / False' : question.type === 'dropdown' ? 'Dropdown' : 'Multiple Choice'

  return (
    <div className="slide-container">
      <div className="slide-dots">
        {Array.from({ length: total }).map((_, di) => (
          <button key={di} onClick={() => goTo(di)}
            className={`slide-dot ${di === index ? 'active' : ''}`} />
        ))}
      </div>

      <div className="slide-card question-card">
        <div className="question-card-header">
          <span className="question-number">Question {index + 1}</span>
          <span className={`question-tag ${tagClass}`}>{typeLabel}</span>
        </div>
        <p className="question-text">{question.emoji} {question.question}</p>

        {question.type === 'dropdown' ? (
          <div className="dropdown-wrapper">
            <select value={selected || ''} onChange={e => onSelect(e.target.value)} className="dropdown-select">
              <option value="" disabled>— Select an answer —</option>
              {shuffled.map((opt, oi) => <option key={oi} value={opt}>{opt}</option>)}
            </select>
          </div>
        ) : (
          <div className="options-list">
            {shuffled.map((opt, oi) => (
              <div key={oi} onClick={() => onSelect(opt)}
                className={`option-item ${selected === opt ? 'selected' : ''}`}>{opt}</div>
            ))}
          </div>
        )}
      </div>

      <div className="slide-nav">
        <button onClick={onPrev} disabled={index === 0} className="slide-nav-btn">◀</button>
        <span className="slide-counter">{index + 1} / {total}</span>
        <button onClick={onNext} disabled={index === total - 1} className="slide-nav-btn">▶</button>
      </div>
    </div>
  )
}
