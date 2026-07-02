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
      <div className="text-center py-12">
        <div className="text-4xl mb-2">📋</div>
        <p className="font-semibold text-[#2c2e26]">No quizzes yet</p>
        <p className="text-sm text-[#6b6b60] mt-1">Generate your first quiz above and it will appear here.</p>
      </div>
    )
  }

  const toggle = (id: string) => setExpanded(prev => prev === id ? null : id)

  return (
    <div className="space-y-4">
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

  return (
    <div className="bg-white rounded-xl border border-[rgba(218,213,200,0.85)] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2 min-w-0">
          {editing ? (
            <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
              onBlur={finishTitle} onKeyDown={e => { if (e.key === 'Enter') finishTitle() }}
              className="text-sm font-semibold border border-[rgba(218,213,200,0.85)] rounded px-1.5 py-0.5 w-40 bg-white text-[#2c2e26]" autoFocus
            />
          ) : (
            <span className="text-sm font-semibold text-[#2c2e26] truncate max-w-[200px]" onClick={e => { e.stopPropagation(); setEditing(true); }}>{entry.title}</span>
          )}
          {entry.subject && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#fff3e0] text-[#e65100] uppercase">{entry.subject}</span>}
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            entry.difficulty === 'Easy' ? 'bg-[#e8f5e9] text-[#2e7d32]' :
            entry.difficulty === 'Medium' ? 'bg-[#fff3e0] text-[#e65100]' :
            'bg-[#ffebee] text-[#c62828]'
          }`}>{entry.difficulty}</span>
          <span className="text-xs text-[#6b6b60]">{entry.questions.length} question{entry.questions.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ActionBtn label="Delete" onClick={e => { e.stopPropagation(); if (confirm('Delete this quiz?')) onDelete() }} />
          <ActionBtn label="PDF" onClick={e => { e.stopPropagation(); onExportPDF() }} />
          <ActionBtn label={entry.showScore ? '✓ Score' : '✗ Score'} onClick={e => { e.stopPropagation(); onUpdate({ showScore: !entry.showScore }) }} />
          <ActionBtn label="Results" onClick={async e => { e.stopPropagation(); const r = await onResults(); if (r.length === 0) alert('No submissions yet. Share the link with students.'); else showResultsModal(entry, r) }} />
          <ActionBtn label="Share" onClick={e => { e.stopPropagation(); onShare() }} />
          <span className="text-xs text-[#6b6b60] ml-1">{expanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[rgba(218,213,200,0.85)] p-4 space-y-3">
          {entry.studentFormat === 'slide' ? (
            <SlideView questions={entry.questions} />
          ) : (
            entry.questions.map((q, i) => (
              <QuestionCard key={i} question={q} index={i} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function ActionBtn({ label, onClick }: { label: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick}
      className="text-xs px-2.5 py-1 rounded-full border border-[rgba(218,213,200,0.85)] text-[#6b6b60] hover:border-[#5b8c5a] hover:text-[#2c2e26] transition-colors"
    >{label}</button>
  )
}

/* ===== Results Modal ===== */

function showResultsModal(entry: QuizEntry, results: QuizResult[]) {
  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm'
  const total = entry.questions.length
  const count = results.length
  const avg = Math.round(results.reduce((s, r) => s + (r.percentage || Math.round((r.correct / r.total) * 100)), 0) / count)

  let html = `
    <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
      <h2 class="text-lg font-semibold text-center mb-1 text-[#2c2e26]">Results</h2>
      <p class="text-sm text-center text-[#6b6b60] mb-4">${entry.topic}</p>
      <div class="flex justify-center gap-6 mb-4">
        <div class="text-center"><div class="text-2xl font-bold text-[#5b8c5a]">${count}</div><div class="text-xs text-[#6b6b60]">Submissions</div></div>
        <div class="text-center"><div class="text-2xl font-bold text-[#5b8c5a]">${avg}%</div><div class="text-xs text-[#6b6b60]">Average</div></div>
      </div>
      <div class="space-y-2 mb-4">`

  results.forEach((r, idx) => {
    const pct = r.percentage || Math.round((r.correct / r.total) * 100)
    const time = new Date(r.submittedAt).toLocaleString()
    const color = pct >= 70 ? '#5b8c5a' : pct >= 40 ? '#e65100' : '#c62828'
    html += `
      <div class="results-entry border border-[rgba(218,213,200,0.85)] rounded-lg overflow-hidden">
        <div class="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[rgba(239,235,227,0.3)]" onclick="this.nextElementSibling.classList.toggle('hidden');this.querySelector('.results-toggle').textContent=this.nextElementSibling.classList.contains('hidden')?'▼':'▲'">
          <div><strong class="text-sm text-[#2c2e26]">Submission #${idx + 1}</strong> <span class="text-[10px] text-[#6b6b60]">${time}</span></div>
          <div class="flex items-center gap-2">
            <div class="w-16 h-2 bg-[rgba(218,213,200,0.5)] rounded-full overflow-hidden"><div class="h-full rounded-full" style="width:${pct}%;background:${color}"></div></div>
            <span class="text-xs font-bold text-[#2c2e26]">${r.correct}/${total}</span>
            <span class="results-toggle text-[10px] text-[#5b8c5a]">▼</span>
          </div>
        </div>
        <div class="hidden px-3 py-2 border-t border-[rgba(218,213,200,0.85)] space-y-2 bg-[rgba(239,235,227,0.15)]">`

    if (r.answers && entry.questions) {
      entry.questions.forEach((q, qi) => {
        const selected = r.answers[qi]
        const isCorrect = selected === q.answer
        html += `<div class="text-xs"><span class="font-medium">Q${qi + 1}:</span> ${q.question}<br>
          <span>Answered: <span class="font-semibold" style="color:${isCorrect ? '#5b8c5a' : '#c62828'}">${selected || '—'}</span>${!isCorrect ? ` &nbsp;· Correct: <span class="font-semibold text-[#5b8c5a]">${q.answer}</span>` : ''}</span></div>`
      })
    }

    html += `</div></div>`
  })

  html += `</div><button class="w-full py-2 rounded-full border border-[rgba(218,213,200,0.85)] text-sm text-[#6b6b60] hover:bg-[rgba(239,235,227,0.5)]" onclick="this.closest('.fixed').remove()">Close</button></div>`

  overlay.innerHTML = html
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })
  document.body.appendChild(overlay)
}
