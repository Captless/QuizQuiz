import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../services/supabase'
import { getQuizzes, saveQuizToServer, deleteQuizFromServer } from '../services/api'
import type { QuizEntry } from '../types'

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

export function useSavedQuizzes() {
  const { user } = useAuth()
  const [quizzes, setQuizzes] = useState<QuizEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadQuizzes = useCallback(async () => {
    if (!user) {
      setQuizzes([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getQuizzes()
      const entries: QuizEntry[] = (data || []).map((q: any) => ({
        id: q.id,
        title: q.title || 'Untitled Quiz',
        topic: q.topic || '',
        subject: q.subject || '',
        difficulty: q.difficulty || 'Easy',
        questions: q.questions || [],
        timerSeconds: q.timer_seconds ?? q.timerSeconds ?? 0,
        format: 'form',
        studentFormat: q.format || 'form',
        shareId: q.id,
        showScore: q.show_score ?? q.showScore ?? false,
      }))
      setQuizzes(entries)
    } catch (err: any) {
      setError(err.message || 'Failed to load quizzes')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadQuizzes()
  }, [loadQuizzes])

  const addQuiz = useCallback(async (entry: QuizEntry) => {
    setQuizzes(prev => [entry, ...prev])
    try {
      const serverId = await saveQuizToServer({
        title: entry.title,
        topic: entry.topic,
        subject: entry.subject,
        difficulty: entry.difficulty,
        questions: entry.questions,
        timerSeconds: entry.timerSeconds,
        format: entry.studentFormat,
      })
      setQuizzes(prev => prev.map(q => q.id === entry.id ? { ...q, id: serverId, shareId: serverId } : q))
    } catch (err: any) {
      console.error('Failed to persist quiz:', err)
    }
  }, [])

  const deleteQuiz = useCallback(async (id: string) => {
    setQuizzes(prev => prev.filter(q => q.id !== id))
    try {
      await deleteQuizFromServer(id)
    } catch (err: any) {
      console.error('Failed to delete quiz:', err)
    }
  }, [])

  const updateQuiz = useCallback(async (id: string, updates: Partial<QuizEntry>) => {
    setQuizzes(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q))
    try {
      await fetch(`/api/quiz/${id}`, { method: 'PUT', headers: await authHeaders(), body: JSON.stringify(updates) })
    } catch (err: any) {
      console.error('Failed to persist quiz update:', err)
    }
  }, [])

  return { quizzes, loading, error, addQuiz, deleteQuiz, updateQuiz }
}
