import { useEffect, useState, useRef } from 'react'
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
  const userIdRef = useRef<string | null>(null)

  const refreshUsage = async () => {
    try {
      const u = await getUsage()
      if (!u) return

      // Read the current usage from localStorage to avoid stale closures
      // (refreshUsage may be called much later after a token refresh).
      const currentUsage = parseInt(localStorage.getItem('quikquiz_usage') || '0', 10)

      // Only overwrite if the server value is >= the current persisted count,
      // or the user is now paid (paid status is always authoritative).
      const shouldUpdate = u.paid || u.usageCount >= currentUsage

      if (shouldUpdate) {
        setUsageCount(u.usageCount)
        localStorage.setItem('quikquiz_usage', String(u.usageCount))
      }
      setPaid(u.paid)
      localStorage.setItem('quikquiz_paid', u.paid ? 'true' : 'false')
    } catch (err) {
      console.warn('Failed to sync usage from server:', err)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const newUser = session?.user
        ? { id: session.user.id, email: session.user.email ?? '', name: session.user.user_metadata?.full_name ?? '', avatar_url: session.user.user_metadata?.avatar_url }
        : null
      const newId = newUser?.id ?? null
      if (newId !== userIdRef.current) {
        userIdRef.current = newId
        setUser(newUser)
      }
      setLoading(false)
      if (newUser) {
        localStorage.setItem('quikquiz_user', JSON.stringify({ name: newUser.name, email: newUser.email, picture: newUser.avatar_url }))
        refreshUsage()
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return
      const newUser = session?.user
        ? { id: session.user.id, email: session.user.email ?? '', name: session.user.user_metadata?.full_name ?? '', avatar_url: session.user.user_metadata?.avatar_url }
        : null
      const newId = newUser?.id ?? null
      if (newId !== userIdRef.current) {
        userIdRef.current = newId
        setUser(newUser)
      }
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
    })

    return () => subscription.unsubscribe()
  }, [])

  const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin
  const signIn = () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: siteUrl } })
  const signOut = () => {
    localStorage.removeItem('quikquiz_user')
    localStorage.removeItem('quikquiz_paid')
    localStorage.removeItem('quikquiz_usage')
    setPaid(false)
    setUsageCount(0)
    supabase.auth.signOut()
  }

  const incrementUsage = async (): Promise<boolean> => {
    try {
      const serverCount = await apiIncrementUsage()
      setUsageCount(serverCount)
      localStorage.setItem('quikquiz_usage', String(serverCount))
      return true
    } catch (err) {
      console.warn('Failed to persist usage count on server:', err)
      return false
    }
  }

  const setPaidStatus = (v: boolean) => {
    setPaid(v)
    localStorage.setItem('quikquiz_paid', v ? 'true' : 'false')
    if (v) refreshUsage()
  }

  return { user, loading, paid, usageCount, signIn, signOut, incrementUsage, setPaidStatus, refreshUsage }
}
