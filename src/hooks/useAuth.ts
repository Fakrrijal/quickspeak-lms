import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) {
        return
      }

      if (error) {
        console.error('Failed to load auth session:', error)
        setSession(null)
        setUser(null)
      } else {
        setSession(data.session)
        setUser(data.session?.user ?? null)
      }

      setLoading(false)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) {
        return
      }

      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return {
    session,
    user,
    loading,
    isAuthenticated: Boolean(session),
  }
}