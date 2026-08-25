import {
  createContext,
  useContext,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useAuth } from '../hooks/useAuth'

type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  isAuthenticated: boolean
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