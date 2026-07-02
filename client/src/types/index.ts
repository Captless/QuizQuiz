export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
}

export interface QuizQuestion {
  question: string
  type: 'multiple' | 'truefalse' | 'dropdown'
  options: string[]
  answer: string
  emoji?: string
}

export interface SharedQuiz {
  id: string
  title: string
  topic?: string
  subject: string
  difficulty: string
  format: 'form' | 'slide'
  timerSeconds: number
  showScore: boolean
  questions: QuizQuestion[]
  createdAt: string
}

export interface QuizEntry {
  id: string
  title: string
  topic: string
  subject: string
  difficulty: string
  questions: QuizQuestion[]
  timerSeconds: number
  format: 'form'
  studentFormat: 'form' | 'slide'
  shareId: string | null
  showScore: boolean
}

export interface QuizResult {
  answers: Record<number, string>
  correct: number
  total: number
  percentage: number
  submittedAt: number
}
