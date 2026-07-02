import { useState, useRef } from 'react'
import type { QuizEntry, QuizQuestion, QuizResult } from '../types'
import QuestionCard from './QuestionCard'
import SlideView from './SlideView'

interface Props {
  entries: QuizEntry[]
  onDelete: (id: string) => void
  onUpdate: (id: string, updates: Partial<QuizEntry>) => void
  onShare: (entry: QuizEntry) => Promise<void>
  onResults: (shareId: string, questions: QuizQuestion[]) => Promise<QuizResult[]>
  onExportPDF: (entry: QuizEntry) => void
}

export default function QuizStack({ entries, onDelete, onUpdate, onShare, onResults, onExportPDF }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [resultsModal, setResultsModal] = useState<{ entry: QuizEntry; results: QuizResult[] } | null>(null)

  if (entries.length === 0) {
    return (
      <div className="quiz-stack-empty">
        <div className="quiz-stack-empty-icon">📋</div>
        <p className="quiz-stack-empty-title">No quizzes yet</p>
        <p className="quiz-stack-empty-text">Generate your first quiz above and it will appear here.</p>
      </div>
    )
  }

  const toggle = (id: string) => setExpanded(prev => prev === id ? null : id)

  const openResults = async (entry: QuizEntry) => {
    if (!entry.shareId) return
    const r = await onResults(entry.shareId, entry.questions)
    if (r.length === 0) { alert('No submissions yet. Share the link with students.'); return }
    setResultsModal({ entry, results: r })
  }

  return (
    <div>
      {entries.map(entry => (
        <QuizEntryCard
          key={entry.id}
          entry={entry}
          expanded={expanded === entry.id}
          onToggle={() => toggle(entry.id)}
          onDelete={() => onDelete(entry.id)}
          onUpdate={(u) => onUpdate(entry.id, u)}
          onShare={() => onShare(entry)}
          onResults={() => openResults(entry)}
          onExportPDF={() => onExportPDF(entry)}
        />
      ))}
      {resultsModal && (
        <ResultsModal
          entry={resultsModal.entry}
          results={resultsModal.results}
          onClose={() => setResultsModal(null)}
        />
      )}
    </div>
  )
}

/* ===== Individual Quiz Entry Card ===== */

function QuizEntryCard({ entry, expanded, onToggle, onDelete, onUpdate, onShare, onResults, onExportPDF }: {
  entry: QuizEntry
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  onUpdate: (u: Partial<QuizEntry>) => void
  onShare: () => Promise<void>
  onResults: () => Promise<void>
  onExportPDF: () => void
}) {
  const [title, setTitle] = useState(entry.title)
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const finishTitle = () => {
    setEditing(false)
    if (title.trim() && title !== entry.title) onUpdate({ title: title.trim() })
  }

  const diffClass = entry.difficulty === 'Easy' ? 'tag-multiple' : entry.difficulty === 'Medium' ? 'tag-truefalse' : ''

  return (
    <div className="quiz-entry card">
      <div className="quiz-entry-header">
        <div className="quiz-entry-info" onClick={e => e.stopPropagation()}>
          <div className="quiz-entry-title-row">
            {editing ? (
              <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value.slice(0, 50))}
                onBlur={finishTitle} onKeyDown={e => { if (e.key === 'Enter') finishTitle() }}
                className="quiz-entry-title-input" autoFocus maxLength={50}
              />
            ) : (
              <span className="quiz-entry-title" title={entry.title} onClick={e => { e.stopPropagation(); setEditing(true); }}>{entry.title.slice(0, 20)}{entry.title.length > 20 ? '…' : ''}</span>
            )}
            {entry.subject && <span className="quiz-entry-subject">{entry.subject}</span>}
            <span className={`quiz-entry-badge ${diffClass}`}>{entry.difficulty}</span>
            <span className="quiz-entry-meta">{entry.questions.length} question{entry.questions.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="quiz-entry-actions">
          <button className="btn btn-sm btn-outline entry-delete-btn" type="button" title="Delete quiz" onClick={e => { e.stopPropagation(); if (confirm('Delete this quiz?')) onDelete() }}>Delete</button>
          <button className="btn btn-sm btn-outline action-btn" type="button" title="Export PDF" onClick={e => { e.stopPropagation(); onExportPDF() }}>PDF</button>
          <button className={`btn btn-sm entry-score-toggle action-btn`} type="button" title={entry.showScore ? 'Hide scores' : 'Show scores'} data-on={entry.showScore ? 'true' : 'false'} onClick={e => { e.stopPropagation(); onUpdate({ showScore: !entry.showScore }) }}>
            <span className="score-icon">{entry.showScore ? '✓' : '✗'}</span> Score
          </button>
          <button className="btn btn-sm btn-outline action-btn" type="button" title="View results" onClick={e => { e.stopPropagation(); onResults() }}>Results</button>
          <button className="btn btn-sm btn-outline action-btn" type="button" title="Share quiz" onClick={e => { e.stopPropagation(); onShare() }}>Share</button>
          <span className="entry-toggle" onClick={e => { e.stopPropagation(); onToggle() }} title={expanded ? 'Collapse' : 'Expand'}>{expanded ? '▼' : '▶'}</span>
        </div>
      </div>

      <div className={`quiz-entry-body ${expanded ? '' : 'hidden'}`}>
        <div className="quiz-entry-content">
          {entry.studentFormat === 'slide' ? (
            <SlideView questions={entry.questions} />
          ) : (
            entry.questions.map((q, i) => (
              <QuestionCard key={i} question={q} index={i} showAnswer />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/* ===== Results Modal ===== */

function ResultsModal({ entry, results, onClose }: {
  entry: QuizEntry
  results: QuizResult[]
  onClose: () => void
}) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const total = entry.questions.length
  const count = results.length
  const avg = Math.round(results.reduce((s, r) => s + (r.percentage || Math.round((r.correct / r.total) * 100)), 0) / count)

  const toggle = (idx: number) => setExpanded(prev => prev === idx ? null : idx)

  return (
    <div className="results-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="results-modal">
        <div className="results-modal-header">
          <h2 className="card-title">Results</h2>
          <button className="results-close-btn" onClick={onClose} type="button">×</button>
        </div>

        <p className="results-topic">{entry.topic}</p>

        <div className="score-stats">
          <div className="score-stat">
            <div className="score-stat-value">{count}</div>
            <div className="score-stat-label">Submissions</div>
          </div>
          <div className="score-stat">
            <div className="score-stat-value">{avg}%</div>
            <div className="score-stat-label">Average</div>
          </div>
        </div>

        {results.map((r, idx) => {
          const pct = r.percentage || Math.round((r.correct / r.total) * 100)
          const time = new Date(r.submittedAt).toLocaleString()
          const tier = pct >= 70 ? 'good' : pct >= 40 ? 'fair' : 'poor'
          const open = expanded === idx

          return (
            <div key={idx} className={`results-entry ${open ? 'open' : ''}`}>
              <div className="results-entry-header" onClick={() => toggle(idx)}>
                <div className="results-entry-left">
                  <span className="results-entry-title">Submission #{idx + 1}</span>
                  <span className="results-entry-time">{time}</span>
                </div>
                <div className="results-entry-right">
                  <div className={`results-track ${tier}`}>
                    <div className="results-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="results-score">{r.correct}/{total}</span>
                  <span className="results-toggle">{open ? '▼' : '▶'}</span>
                </div>
              </div>

              <div className={`results-detail ${open ? '' : 'hidden'}`}>
                {r.answers && entry.questions.map((q, qi) => {
                  const selected = r.answers[qi]
                  const isCorrect = selected === q.answer
                  return (
                    <div key={qi} className="results-q">
                      <div className="results-q-header">
                        <strong>Q{qi + 1}</strong>
                        <span className={`results-q-status ${isCorrect ? 'correct' : 'incorrect'}`}>
                          {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                        </span>
                      </div>
                      <div className="results-q-body">
                        <p>{q.emoji} {q.question}</p>
                        <p className="results-q-answer">
                          Answered: <span className={isCorrect ? 'text-success' : 'text-error'}>{selected || '—'}</span>
                          {!isCorrect && <span> · Correct: <span className="text-success">{q.answer}</span></span>}
                        </p>
                      </div>
                    </div>
                  )
                })}
                {!r.answers && <p className="text-muted">No answer details available.</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}