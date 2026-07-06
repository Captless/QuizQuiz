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
        <div className="quiz-stack-empty-icon">—</div>
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
  const [copyFeedback, setCopyFeedback] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const finishTitle = () => {
    setEditing(false)
    if (title.trim() && title !== entry.title) onUpdate({ title: title.trim() })
  }

  const handleCopy = async () => {
    if (entry.shareId) {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/quiz/${entry.shareId}`)
        setCopyFeedback(true)
        setTimeout(() => setCopyFeedback(false), 1500)
      } catch { }
    } else {
      await onShare()
    }
  }

  const diffClass = entry.difficulty === 'Easy' ? 'tag-multiple' : entry.difficulty === 'Medium' ? 'tag-truefalse' : ''

  const displayTitle = entry.title.slice(0, 10) + (entry.title.length > 10 ? '…' : '')

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
          <button className="btn btn-sm btn-outline entry-delete-btn" type="button" title="Delete quiz" aria-label={`Delete ${entry.title}`} onClick={e => { e.stopPropagation(); if (confirm('Delete this quiz?')) onDelete() }}>Delete</button>
          <button className="btn btn-sm btn-outline action-btn" type="button" title="Export PDF" aria-label={`Export ${entry.title} as PDF`} onClick={e => { e.stopPropagation(); onExportPDF() }}>PDF</button>
          <button className={`btn btn-sm entry-score-toggle action-btn`} type="button" title={entry.showScore ? 'Hide scores' : 'Show scores'} aria-label={entry.showScore ? 'Hide scores from students' : 'Show scores to students'} data-on={entry.showScore ? 'true' : 'false'} onClick={e => { e.stopPropagation(); onUpdate({ showScore: !entry.showScore }) }}>
            <span className="score-icon">{entry.showScore ? '✓' : '✗'}</span> Score
          </button>
          <button className="btn btn-sm btn-outline action-btn" type="button" title="View results" aria-label={`View results for ${entry.title}`} onClick={e => { e.stopPropagation(); onResults() }}>Results</button>
          <span className="share-inline" title="Copy quiz link" onClick={async e => { e.stopPropagation(); await handleCopy() }}>
            <span className="share-inline-text">{displayTitle}</span>
            <span className="share-copy-btn" style={{ fontSize: '13px', lineHeight: 1 }}>
              {copyFeedback ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              )}
            </span>
          </span>
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