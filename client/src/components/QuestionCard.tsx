import type { QuizQuestion } from '../types'

interface Props {
  question: QuizQuestion
  index: number
  showAnswer?: boolean
}

const typeLabels: Record<string, string> = {
  multiple: 'Multiple Choice',
  truefalse: 'True / False',
  dropdown: 'Dropdown',
}

export default function QuestionCard({ question, index, showAnswer }: Props) {
  const shuffled = [...question.options].sort(() => Math.random() - 0.5)

  return (
    <div className="bg-white rounded-xl border border-[rgba(218,213,200,0.85)] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-[#5b8c5a]">Question {index + 1}</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          question.type === 'truefalse' ? 'bg-[#e8f5e9] text-[#2e7d32]' :
          question.type === 'dropdown' ? 'bg-[#e3f2fd] text-[#1565c0]' :
          'bg-[#fff3e0] text-[#e65100]'
        }`}>{typeLabels[question.type]}</span>
      </div>
      <p className="text-sm font-medium text-[#2c2e26] mb-3">{question.emoji} {question.question}</p>
      <div className="space-y-1.5">
        {shuffled.map((opt, oi) => (
          <div key={oi} className={`px-3 py-2 text-sm rounded-lg border ${
            showAnswer && opt === question.answer
              ? 'border-[#5b8c5a] bg-[rgba(91,140,90,0.08)] text-[#5b8c5a] font-medium'
              : 'border-[rgba(218,213,200,0.85)] text-[#2c2e26]'
          }`}>
            {opt}
          </div>
        ))}
      </div>
    </div>
  )
}
