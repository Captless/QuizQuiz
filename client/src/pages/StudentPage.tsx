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

  if (loading) return <div className="min-h-screen bg-[#f4f1ea] font-mono flex items-center justify-center text-sm text-[#6b6b60]"><div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-[#5b8c5a] border-t-transparent rounded-full animate-spin" /> Loading quiz questions...</div></div>
  if (error || !quiz) return (
    <div className="min-h-screen bg-[#f4f1ea] font-mono flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-bold text-[#c62828] mb-2">Quiz not found</h2>
        <p className="text-sm text-[#6b6b60]">This link may have expired or is invalid.</p>
        <a href="/" className="mt-4 inline-block text-sm text-[#5b8c5a] hover:underline">Go home</a>
      </div>
    </div>
  )

  const timerTotal = quiz.timerSeconds || 1
  const timerPct = Math.max(0, (timerRemaining / timerTotal) * 100)
  const timerDisplay = `${String(Math.floor(timerRemaining / 60)).padStart(2, '0')}:${String(timerRemaining % 60).padStart(2, '0')}`

  return (
    <div className="min-h-screen bg-[#f4f1ea] font-mono text-[#2c2e26]">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[rgba(218,213,200,0.85)] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a href="/" className="text-2xl font-extrabold tracking-tight">
            <span className="text-[#5b8c5a]">Quik</span><span className="text-[#2c2e26]">Quiz</span>
          </a>
          <div className="flex items-center gap-3">
            {started && timerActive && (
              <span className={`text-sm font-bold tabular-nums ${timerRemaining <= 30 ? 'text-[#c62828]' : timerRemaining <= 60 ? 'text-[#e65100]' : 'text-[#5b8c5a]'}`}>
                {timerDisplay}
              </span>
            )}
            <button onClick={() => setDark(!dark)} className="text-sm px-2.5 py-1.5 rounded-full border border-[rgba(218,213,200,0.85)] bg-white/80 text-[#6b6b60] hover:border-[#5b8c5a]">
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-4 py-6">
        <div className="text-center mb-4">
          {quiz.subject && <div className="text-xs text-[#6b6b60] uppercase tracking-wider mb-1">{quiz.subject}</div>}
          <h1 className="text-xl font-bold text-[#2c2e26]">{quiz.title || quiz.topic || 'Untitled Quiz'}</h1>
          {quiz.topic && <p className="text-xs text-[#6b6b60] mt-1">{quiz.topic}</p>}
        </div>

        {!started && !submitted && (
          <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-[rgba(218,213,200,0.85)] p-8 text-center">
            <div className="flex justify-center gap-6 mb-6">
              <span className="text-sm text-[#6b6b60]">Questions: <strong className="text-[#2c2e26]">{quiz.questions.length}</strong></span>
              {quiz.timerSeconds > 0 && (
                <span className="text-sm text-[#6b6b60]">Time limit: <strong className="text-[#2c2e26]">{String(Math.floor(quiz.timerSeconds / 60)).padStart(2, '0')}:{String(quiz.timerSeconds % 60).padStart(2, '0')}</strong></span>
              )}
              {quiz.subject && <span className="text-sm text-[#6b6b60]">Subject: <strong className="text-[#2c2e26]">{quiz.subject}</strong></span>}
            </div>
            <button onClick={handleStart} className="px-8 py-3 rounded-full bg-[#5b8c5a] text-white font-semibold hover:bg-[#4a7a49]">
              Start Quiz
            </button>
          </div>
        )}

        {started && timerActive && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm font-bold tabular-nums ${timerRemaining <= 30 ? 'text-[#c62828]' : timerRemaining <= 60 ? 'text-[#e65100]' : 'text-[#5b8c5a]'}`}>
                {timerDisplay}
              </span>
              <span className="text-xs text-[#6b6b60]">{Math.round(timerPct)}% remaining</span>
            </div>
            <div className="h-2 bg-[rgba(218,213,200,0.5)] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-1000 ${
                timerRemaining <= 30 ? 'bg-[#c62828]' : timerRemaining <= 60 ? 'bg-[#e65100]' : 'bg-[#5b8c5a]'
              }`} style={{ width: `${timerPct}%` }} />
            </div>
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
              <div className="space-y-4 mb-4">
                {quiz.questions.map((q, i) => (
                  <StudentQuestionCard key={i} question={q} index={i} selected={answers[i]} onSelect={(v) => handleAnswer(i, v)} />
                ))}
              </div>
            )}

            {unanswered && unanswered.length > 0 && (
              <div className="bg-[#ffebee] border-2 border-[#c62828] rounded-xl p-4 mb-4 text-center">
                <p className="font-bold text-sm text-[#c62828] mb-2">Unanswered Questions</p>
                <div className="flex flex-wrap gap-2 justify-center mb-2">
                  {unanswered.map(qi => (
                    <button key={qi} onClick={() => {
                      if (quiz.format === 'slide') setSlideIdx(qi)
                      else document.querySelector(`[data-qi="${qi}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      setUnanswered(null)
                    }}
                      className="w-8 h-8 rounded-full bg-[#c62828] text-white text-xs font-bold hover:bg-[#b71c1c]"
                    >{qi + 1}</button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={handleSubmitClick} disabled={submitted}
              className="w-full py-3 rounded-full bg-[#e65100] text-white font-semibold hover:bg-[#c62828] disabled:opacity-50"
            >Submit Answers</button>
          </>
        )}

        {submitted && score && (
          <div className="text-center py-6">
            {quiz.showScore !== false ? (
              <>
                <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-3 ${
                  score.pct >= 60 ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#ffebee] text-[#c62828]'
                }`}>{score.pct >= 60 ? 'Passed' : 'Needs Improvement'}</div>
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold border-4 ${
                  score.pct === 100 ? 'border-[#5b8c5a] text-[#5b8c5a]' :
                  score.pct >= 80 ? 'border-[#5b8c5a] text-[#5b8c5a]' :
                  score.pct >= 60 ? 'border-[#e65100] text-[#e65100]' :
                  'border-[#c62828] text-[#c62828]'
                }`}>{score.pct}%</div>
                <div className="flex justify-center gap-6 mb-4">
                  <div className="text-center"><div className="text-xl font-bold text-[#5b8c5a]">{score.correct}</div><div className="text-xs text-[#6b6b60]">Correct</div></div>
                  <div className="text-center"><div className="text-xl font-bold text-[#c62828]">{score.total - score.correct}</div><div className="text-xs text-[#6b6b60]">Incorrect</div></div>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="text-xl font-bold text-[#5b8c5a] mb-1">Successfully submitted!</div>
                <p className="text-sm text-[#6b6b60]">Your answers have been recorded.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="text-center py-8 text-xs text-[#6b6b60] border-t border-[rgba(218,213,200,0.85)]">
        <div className="max-w-4xl mx-auto px-4">QuikQuiz — AI-powered quiz generation for teachers and tutors.</div>
      </footer>
    </div>
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

  return (
    <div className="bg-white rounded-xl border border-[rgba(218,213,200,0.85)] p-4" data-qi={index}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-[#5b8c5a]">Question {index + 1}</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          question.type === 'truefalse' ? 'bg-[#e8f5e9] text-[#2e7d32]' :
          question.type === 'dropdown' ? 'bg-[#e3f2fd] text-[#1565c0]' :
          'bg-[#fff3e0] text-[#e65100]'
        }`}>{question.type === 'truefalse' ? 'True / False' : question.type === 'dropdown' ? 'Dropdown' : 'Multiple Choice'}</span>
      </div>
      <p className="text-sm font-medium text-[#2c2e26] mb-3">{question.emoji} {question.question}</p>

      {question.type === 'dropdown' ? (
        <select value={selected || ''} onChange={e => onSelect(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-[rgba(218,213,200,0.85)] rounded-lg bg-white text-[#2c2e26]">
          <option value="" disabled>— Select an answer —</option>
          {shuffled.map((opt, oi) => <option key={oi} value={opt}>{opt}</option>)}
        </select>
      ) : (
        <div className="space-y-1.5">
          {shuffled.map((opt, oi) => (
            <div key={oi} onClick={() => onSelect(opt)}
              className={`px-3 py-2.5 text-sm rounded-lg border cursor-pointer transition-colors ${
                selected === opt
                  ? 'border-[#5b8c5a] bg-[rgba(91,140,90,0.08)] text-[#5b8c5a] font-medium'
                  : 'border-[rgba(218,213,200,0.85)] text-[#2c2e26] hover:border-[#5b8c5a]'
              }`}
            >{opt}</div>
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

  return (
    <div>
      <div className="flex justify-center gap-1.5 mb-4">
        {Array.from({ length: total }).map((_, di) => (
          <button key={di} onClick={() => goTo(di)}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${di === index ? 'bg-[#5b8c5a]' : 'bg-[rgba(218,213,200,0.85)] hover:bg-[#5b8c5a]'}`}
          />
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[rgba(218,213,200,0.85)] p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-[#5b8c5a]">Question {index + 1}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            question.type === 'truefalse' ? 'bg-[#e8f5e9] text-[#2e7d32]' :
            question.type === 'dropdown' ? 'bg-[#e3f2fd] text-[#1565c0]' :
            'bg-[#fff3e0] text-[#e65100]'
          }`}>{question.type === 'truefalse' ? 'True / False' : question.type === 'dropdown' ? 'Dropdown' : 'Multiple Choice'}</span>
        </div>
        <p className="text-base font-medium text-[#2c2e26] mb-4">{question.emoji} {question.question}</p>

        {question.type === 'dropdown' ? (
          <select value={selected || ''} onChange={e => onSelect(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[rgba(218,213,200,0.85)] rounded-lg bg-white text-[#2c2e26]">
            <option value="" disabled>— Select an answer —</option>
            {shuffled.map((opt, oi) => <option key={oi} value={opt}>{opt}</option>)}
          </select>
        ) : (
          <div className="space-y-2">
            {shuffled.map((opt, oi) => (
              <div key={oi} onClick={() => onSelect(opt)}
                className={`px-4 py-2.5 text-sm rounded-lg border cursor-pointer transition-colors ${
                  selected === opt
                    ? 'border-[#5b8c5a] bg-[rgba(91,140,90,0.08)] text-[#5b8c5a] font-medium'
                    : 'border-[rgba(218,213,200,0.85)] text-[#2c2e26] hover:border-[#5b8c5a]'
                }`}
              >{opt}</div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        <button onClick={onPrev} disabled={index === 0}
          className="px-4 py-2 text-sm rounded-full border border-[rgba(218,213,200,0.85)] disabled:opacity-30 hover:border-[#5b8c5a]"
        >◀</button>
        <span className="text-xs text-[#6b6b60]">{index + 1} / {total}</span>
        <button onClick={onNext} disabled={index === total - 1}
          className="px-4 py-2 text-sm rounded-full border border-[rgba(218,213,200,0.85)] disabled:opacity-30 hover:border-[#5b8c5a]"
        >▶</button>
      </div>
    </div>
  )
}
