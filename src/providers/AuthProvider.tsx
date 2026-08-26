import {
  createContext,
  useContext,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useAuth } from '../hooks/useAuth'

type Profile = {
  id: string
  full_name: string
  email: string
  role: string
  status: string
}

type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  profile: Profile | null
  profileLoading: boolean
  profileError: Error | null
  role: string | null
  status: string | null
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth()

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error(
      'useAuthContext must be used inside AuthProvider',
    )
  }

  return context
}