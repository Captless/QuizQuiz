import { useCallback } from 'react'
import { useAuth } from './useAuth'
import { useQuota } from './useQuota'
import { generateQuiz as apiGenerate } from '../services/api'

interface GenerateFormData {
  topic: string
  difficulty: string
  typeStr: string
  num: number
  timerSeconds: number
  format: 'form' | 'slide'
}

interface GenerateResult {
  topic: string
  difficulty: string
  questions: any[]
  timerSeconds: number
  format: 'form' | 'slide'
}

export function useQuizGenerator() {
  const { signIn, incrementUsage } = useAuth()
  const { isPaid, isSignedIn, outOfFreeQuota, remainingFree } = useQuota()

  const generate = useCallback(async (
    formData: GenerateFormData,
    onProgress?: (msg: string) => void
  ): Promise<GenerateResult | null> => {
    if (!isSignedIn) {
      signIn()
      return null
    }

    if (outOfFreeQuota && !isPaid) {
      return null
    }

    if (!formData.topic) {
      return null
    }

    const finalNum = isPaid ? formData.num : Math.min(10, formData.num)
    onProgress?.('Generating your quiz...')

    const questions = await apiGenerate(
      formData.topic,
      formData.difficulty,
      formData.typeStr,
      finalNum
    )

    onProgress?.('Saving...')

    if (!isPaid) {
      const ok = await incrementUsage()
      if (!ok) {
        console.warn('Failed to record usage on server')
      }
    }

    return {
      topic: formData.topic,
      difficulty: formData.difficulty,
      questions,
      timerSeconds: formData.timerSeconds,
      format: formData.format,
    }
  }, [isSignedIn, signIn, outOfFreeQuota, isPaid, incrementUsage])

  return {
    generate,
    isPaid,
    isSignedIn,
    remainingFree,
    outOfFreeQuota,
  }
}
