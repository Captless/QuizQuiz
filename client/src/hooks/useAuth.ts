import { useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import { getUsage, incrementUsage as apiIncrementUsage } from '../services/api'
import type { User } from '../types'

function getLocalPaid(): boolean {
  return localStorage.getItem('quikquiz_paid') === 'true'
}

function getLocalUsage(): number {
  return parseInt(localStorage.getItem('quikquiz_usage') || '0')
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [paid, setPaid] = useState(getLocalPaid)
  const [usageCount, setUsageCount] = useState(getLocalUsage)

  const refreshUsage = async () => {
    try {
      const u = await getUsage()
      if (u) {
        setUsageCount(u.usageCount)
        setPaid(u.paid)
        localStorage.setItem('quikquiz_usage', String(u.usageCount))
        localStorage.setItem('quikquiz_paid', u.paid ? 'true' : 'false')
      }
    } catch {}
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const newUser = session?.user
        ? { id: session.user.id, email: session.user.email ?? '', name: session.user.user_metadata?.full_name ?? '', avatar_url: session.user.user_metadata?.avatar_url }
        : null
      setUser(newUser)
      setLoading(false)
      if (newUser) {
        localStorage.setItem('quikquiz_user', JSON.stringify({ name: newUser.name, email: newUser.email, picture: newUser.avatar_url }))
        refreshUsage()
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user
        ? { id: session.user.id, email: session.user.email ?? '', name: session.user.user_metadata?.full_name ?? '', avatar_url: session.user.user_metadata?.avatar_url }
        : null
      if (newUser) {
        const prev = JSON.parse(localStorage.getItem('quikquiz_user') || 'null')
        if (prev?.email && prev.email !== newUser.email) {
          localStorage.removeItem('quikquiz_paid')
          localStorage.removeItem('quikquiz_usage')
          setPaid(false)
          setUsageCount(0)
        }
        localStorage.setItem('quikquiz_user', JSON.stringify({ name: newUser.name, email: newUser.email, picture: newUser.avatar_url }))
        refreshUsage()
      } else {
        localStorage.removeItem('quikquiz_user')
        localStorage.removeItem('quikquiz_paid')
        localStorage.removeItem('quikquiz_usage')
        setPaid(false)
        setUsageCount(0)
      }
      setUser(newUser)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = () => supabase.auth.signInWithOAuth({ provider: 'google' })
  const signOut = () => {
    localStorage.removeItem('quikquiz_user')
    localStorage.removeItem('quikquiz_paid')
    localStorage.removeItem('quikquiz_usage')
    setPaid(false)
    setUsageCount(0)
    supabase.auth.signOut()
  }

  const incrementUsage = async () => {
    const next = usageCount + 1
    setUsageCount(next)
    localStorage.setItem('quikquiz_usage', String(next))
    try {
      await apiIncrementUsage()
    } catch {}
  }

  const setPaidStatus = (v: boolean) => {
    setPaid(v)
    localStorage.setItem('quikquiz_paid', v ? 'true' : 'false')
    if (v) refreshUsage()
  }

  return { user, loading, paid, usageCount, signIn, signOut, incrementUsage, setPaidStatus }
}
