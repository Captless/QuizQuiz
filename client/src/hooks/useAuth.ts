import { useEffect, useState, useRef } from 'react'
import { supabase } from '../services/supabase'
import { getUsage, incrementUsage as apiIncrementUsage } from '../services/api'
import type { User } from '../types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [paid, setPaid] = useState(false)
  const [usageCount, setUsageCount] = useState(0)
  const [usageLoaded, setUsageLoaded] = useState(false)
  const userIdRef = useRef<string | null>(null)

  const refreshUsage = async () => {
    try {
      const u = await getUsage()
      if (u) {
        setUsageCount(u.usageCount)
        setPaid(u.paid)
      }
    } catch (err) {
      console.warn('Failed to sync usage from server:', err)
    } finally {
      setUsageLoaded(true)
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
      } else {
        setUsageLoaded(true)
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
        localStorage.setItem('quikquiz_user', JSON.stringify({ name: newUser.name, email: newUser.email, picture: newUser.avatar_url }))
        refreshUsage()
      } else {
        localStorage.removeItem('quikquiz_user')
        setPaid(false)
        setUsageCount(0)
        setUsageLoaded(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '')
  const signIn = () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: siteUrl } })
  const signOut = () => {
    supabase.auth.signOut()
  }

  const incrementUsage = async (): Promise<void> => {
    try {
      const serverCount = await apiIncrementUsage()
      setUsageCount(serverCount)
    } catch {
      // server will correct next refreshUsage()
    }
  }

  const setPaidStatus = (v: boolean) => {
    setPaid(v)
    if (v) refreshUsage()
  }

  return { user, loading, paid, usageCount, usageLoaded, signIn, signOut, incrementUsage, setPaidStatus, refreshUsage, setUsageCount }
}
