import { useAuth } from './useAuth'
import { incrementUsage as apiIncrementUsage } from '../services/api'

export function useQuota() {
  const { user, usageCount, paid } = useAuth()
  const maxFree = 3
  const remainingFree = Math.max(0, maxFree - usageCount)
  const outOfFreeQuota = !paid && usageCount >= maxFree

  const recordUsage = async (): Promise<boolean> => {
    if (!user) return false
    try {
      await apiIncrementUsage()
      return true
    } catch {
      return false
    }
  }

  return {
    isPaid: paid,
    isSignedIn: !!user,
    remainingFree,
    outOfFreeQuota,
    recordUsage,
  }
}
