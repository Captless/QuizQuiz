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
  const shuffled = question.shuffledOptions ?? [...question.options].sort(() => Math.random() - 0.5)

  const tagClass = question.type === 'truefalse' ? 'tag-truefalse' : question.type === 'dropdown' ? 'tag-dropdown' : 'tag-multiple'

  return (
    <div className="question-card">
      <div className="question-card-header">
        <span className="question-number">Question {index + 1}</span>
        <span className={`question-tag ${tagClass}`}>{typeLabels[question.type]}</span>
      </div>
      <p className="question-text">{question.emoji} {question.question}</p>
      <div className="options-list">
        {shuffled.map((opt, oi) => (
          <div key={oi} className={`option-item option-item--readonly ${showAnswer && opt === question.answer ? 'correct' : ''}`}>
            {opt}
          </div>
        ))}
      </div>
    </div>
  )
}
