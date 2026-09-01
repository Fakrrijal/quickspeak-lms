import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { queryClient } from '../lib/queryClient'
import { supabase } from '../lib/supabase'

type Profile = {
  id: string
  full_name: string
  email: string
  role: string
  status: string
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<Error | null>(null)
  const profileRequestIdRef = useRef<number>(0)
  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    const applySession = (nextSession: Session | null) => {
      const nextUser = nextSession?.user ?? null

      if (currentUserIdRef.current !== nextUser?.id) {
        queryClient.removeQueries({ queryKey: ['my-profile'] })
        queryClient.removeQueries({ queryKey: ['my-avatar-url'] })
        currentUserIdRef.current = nextUser?.id ?? null
        profileRequestIdRef.current += 1
        setProfile(null)
        setProfileError(null)
        setProfileLoading(Boolean(nextUser))
      }

      setSession(nextSession)
      setUser(nextUser)
    }

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) {
        return
      }

      if (error) {
        console.error('Failed to load auth session:', error)
        applySession(null)
      } else {
        applySession(data.session)
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

      applySession(nextSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Load profile when user changes (handles initial session and auth state changes)
  const loadProfile = useCallback(async (userId: string) => {
    const requestId = ++profileRequestIdRef.current
    setProfileLoading(true)
    setProfileError(null)

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, status')
        .eq('id', userId)
        .single()

      // Only update state if this is still the current request
      if (requestId === profileRequestIdRef.current) {
        if (error) {
          throw error
        }

        if (data) {
          setProfile(data as Profile)
        } else {
          setProfile(null)
        }
      }
    } catch (err) {
      // Only update state if this is still the current request
      if (requestId === profileRequestIdRef.current) {
        console.error('Failed to load profile:', err)
        setProfileError(err instanceof Error ? err : new Error('Profile load failed'))
        setProfile(null)
      }
    } finally {
      // Only update loading state if this is still the current request
      if (requestId === profileRequestIdRef.current) {
        setProfileLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadProfile(user.id)
    } else {
      setProfile(null)
      setProfileError(null)
      setProfileLoading(false)
    }
  }, [user, loadProfile])

  return {
    session,
    user,
    loading,
    isAuthenticated: Boolean(session),
    profile,
    profileLoading,
    profileError,
    role: profile?.role ?? null,
    status: profile?.status ?? null,
  }
}
