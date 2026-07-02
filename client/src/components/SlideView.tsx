import { useState } from 'react'
import type { QuizQuestion } from '../types'

interface Props {
  questions: QuizQuestion[]
}

export default function SlideView({ questions }: Props) {
  const [idx, setIdx] = useState(0)
  const q = questions[idx]
  if (!q) return null

  const tagClass = q.type === 'truefalse' ? 'tag-truefalse' : q.type === 'dropdown' ? 'tag-dropdown' : 'tag-multiple'
  const typeLabel = q.type === 'truefalse' ? 'True / False' : q.type === 'dropdown' ? 'Dropdown' : 'Multiple Choice'

  return (
    <div className="slide-container">
      <div className="slide-dots">
        {questions.map((_, di) => (
          <button key={di} onClick={() => setIdx(di)}
            className={`slide-dot ${di === idx ? 'active' : ''}`} />
        ))}
      </div>

      <div className="slide-card question-card">
        <div className="question-card-header">
          <span className="question-number">Question {idx + 1}</span>
          <span className={`question-tag ${tagClass}`}>{typeLabel}</span>
        </div>
        <p className="question-text">{q.emoji} {q.question}</p>
        <div className="options-list">
          {[...q.options].sort(() => Math.random() - 0.5).map((opt, oi) => (
            <div key={oi} className="option-item option-item--readonly">{opt}</div>
          ))}
        </div>
      </div>

      <div className="slide-nav">
        <button onClick={() => setIdx(idx - 1)} disabled={idx === 0} className="slide-nav-btn">◀</button>
        <span className="slide-counter">{idx + 1} / {questions.length}</span>
        <button onClick={() => setIdx(idx + 1)} disabled={idx === questions.length - 1} className="slide-nav-btn">▶</button>
      </div>
    </div>
  )
}
