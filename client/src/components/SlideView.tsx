import { useState } from 'react'
import type { QuizQuestion } from '../types'

interface Props {
  questions: QuizQuestion[]
}

export default function SlideView({ questions }: Props) {
  const [idx, setIdx] = useState(0)
  const q = questions[idx]
  if (!q) return null

  return (
    <div>
      <div className="flex justify-center gap-1.5 mb-4">
        {questions.map((_, di) => (
          <button key={di} onClick={() => setIdx(di)}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${di === idx ? 'bg-[#5b8c5a]' : 'bg-[rgba(218,213,200,0.85)]'}`}
          />
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[rgba(218,213,200,0.85)] p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-[#5b8c5a]">Question {idx + 1}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            q.type === 'truefalse' ? 'bg-[#e8f5e9] text-[#2e7d32]' :
            q.type === 'dropdown' ? 'bg-[#e3f2fd] text-[#1565c0]' :
            'bg-[#fff3e0] text-[#e65100]'
          }`}>{q.type === 'truefalse' ? 'True / False' : q.type === 'dropdown' ? 'Dropdown' : 'Multiple Choice'}</span>
        </div>
        <p className="text-base font-medium text-[#2c2e26] mb-4">{q.emoji} {q.question}</p>
        <div className="space-y-2">
          {[...q.options].sort(() => Math.random() - 0.5).map((opt, oi) => (
            <div key={oi} className="px-4 py-2.5 text-sm rounded-lg border border-[rgba(218,213,200,0.85)] text-[#2c2e26]">
              {opt}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <button onClick={() => setIdx(idx - 1)} disabled={idx === 0}
          className="px-3 py-1.5 text-sm rounded-full border border-[rgba(218,213,200,0.85)] disabled:opacity-30 hover:border-[#5b8c5a]"
        >◀</button>
        <span className="text-xs text-[#6b6b60]">{idx + 1} / {questions.length}</span>
        <button onClick={() => setIdx(idx + 1)} disabled={idx === questions.length - 1}
          className="px-3 py-1.5 text-sm rounded-full border border-[rgba(218,213,200,0.85)] disabled:opacity-30 hover:border-[#5b8c5a]"
        >▶</button>
      </div>
    </div>
  )
}
