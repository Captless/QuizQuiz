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
          onResults={async () => { if (entry.shareId) return onResults(entry.shareId, entry.questions); return [] }}
          onExportPDF={() => onExportPDF(entry)}
        />
      ))}
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
  onResults: () => Promise<QuizResult[]>
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
      <div className="quiz-entry-header" onClick={onToggle}>
        <div className="quiz-entry-info">
          <div className="quiz-entry-title-row">
            {editing ? (
              <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
                onBlur={finishTitle} onKeyDown={e => { if (e.key === 'Enter') finishTitle() }}
                className="quiz-entry-title-input" autoFocus
              />
            ) : (
              <span className="quiz-entry-title" onClick={e => { e.stopPropagation(); setEditing(true); }}>{entry.title}</span>
            )}
            {entry.subject && <span className="quiz-entry-subject">{entry.subject}</span>}
            <span className={`quiz-entry-badge ${diffClass}`}>{entry.difficulty}</span>
            <span className="quiz-entry-meta">{entry.questions.length} question{entry.questions.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="quiz-entry-actions">
          <button className="btn btn-sm btn-outline entry-delete-btn" onClick={e => { e.stopPropagation(); if (confirm('Delete this quiz?')) onDelete() }}>Delete</button>
          <button className="btn btn-sm btn-outline" onClick={e => { e.stopPropagation(); onExportPDF() }}>PDF</button>
          <button className={`btn btn-sm entry-score-toggle`} data-on={entry.showScore ? 'true' : 'false'} onClick={e => { e.stopPropagation(); onUpdate({ showScore: !entry.showScore }) }}>
            {entry.showScore ? '✓ Score' : '✗ Score'}
          </button>
          <button className="btn btn-sm btn-outline" onClick={async e => { e.stopPropagation(); const r = await onResults(); if (r.length === 0) alert('No submissions yet. Share the link with students.'); else showResultsModal(entry, r) }}>Results</button>
          <button className="btn btn-sm btn-outline" onClick={e => { e.stopPropagation(); onShare() }}>Share</button>
          <span className="entry-toggle" onClick={onToggle}>{expanded ? '▼' : '▶'}</span>
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

function showResultsModal(entry: QuizEntry, results: QuizResult[]) {
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px)'
  const total = entry.questions.length
  const count = results.length
  const avg = Math.round(results.reduce((s, r) => s + (r.percentage || Math.round((r.correct / r.total) * 100)), 0) / count)

  let html = `
    <div class="results-modal" style="padding:24px">
      <h2 class="card-title text-center">Results</h2>
      <p class="text-center" style="font-size:14px;color:var(--text-secondary);margin-bottom:16px">${entry.topic}</p>
      <div class="score-stats">
        <div class="score-stat correct">
          <div class="score-stat-value">${count}</div>
          <div class="score-stat-label">Submissions</div>
        </div>
        <div class="score-stat correct">
          <div class="score-stat-value">${avg}%</div>
          <div class="score-stat-label">Average</div>
        </div>
      </div>`

  results.forEach((r, idx) => {
    const pct = r.percentage || Math.round((r.correct / r.total) * 100)
    const time = new Date(r.submittedAt).toLocaleString()
    const color = pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--error)'
    html += `
      <div class="results-entry">
        <div class="results-entry-header" onclick="this.nextElementSibling.classList.toggle('hidden');this.querySelector('.results-toggle').textContent=this.nextElementSibling.classList.contains('hidden')?'▶':'▼'">
          <div><strong style="font-size:14px">Submission #${idx + 1}</strong> <span style="font-size:12px;color:var(--text-muted)">${time}</span></div>
          <div class="flex-center">
            <div class="timer-track" style="width:80px"><div class="timer-fill" style="width:${pct}%;background:${color}"></div></div>
            <span style="font-size:13px;font-weight:700">${r.correct}/${total}</span>
            <span class="results-toggle" style="font-size:11px;color:var(--accent);margin-left:4px">▶</span>
          </div>
        </div>
        <div class="results-detail hidden">`

    if (r.answers && entry.questions) {
      entry.questions.forEach((q, qi) => {
        const selected = r.answers[qi]
        const isCorrect = selected === q.answer
        html += `<div class="results-q"><strong>Q${qi + 1}:</strong> ${q.question}<br>
          <span>Answered: <span style="font-weight:600;color:${isCorrect ? 'var(--success)' : 'var(--error)'}">${selected || '—'}</span>${!isCorrect ? ` &nbsp;· Correct: <span style="font-weight:600;color:var(--success)">${q.answer}</span>` : ''}</span></div>`
      })
    }

    html += `</div></div>`
  })

  html += `</div><button class="btn btn-block btn-secondary" style="margin-top:16px" onclick="this.closest('.fixed')?.remove()">Close</button></div>`

  overlay.innerHTML = html
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })
  document.body.appendChild(overlay)
}
