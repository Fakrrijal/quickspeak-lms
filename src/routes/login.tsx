import { useState, useEffect, useRef } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { authService } from '../services/auth.service'
import { useAuthContext } from '../providers/AuthProvider'
import { reportSystemError } from '../lib/systemErrorReporter'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [showResendConfirmation, setShowResendConfirmation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const loginAttemptedRef = useRef(false)

  const {
    isAuthenticated,
    profileLoading,
    role,
    status,
    profileError,
  } = useAuthContext()

  useEffect(() => {
    if (!isAuthenticated || profileLoading || !loginAttemptedRef.current) {
      return
    }

    loginAttemptedRef.current = false

    if (profileError) {
      setError('Failed to load profile. Please try again.')
      return
    }

    if (status !== 'active') {
      setError('Your account is not active. Please contact support.')
      return
    }

    if (role === 'admin') {
      navigate({ to: '/admin/dashboard', replace: true })
      return
    }

    if (role === 'teacher') {
      navigate({ to: '/teacher', replace: true })
      return
    }

    if (role === 'student') {
      navigate({ to: '/student', replace: true })
      return
    }

    setError('Your account has an unrecognized role.')
  }, [isAuthenticated, profileLoading, role, status, profileError, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResendSuccess(false)
    setShowResendConfirmation(false)
    loginAttemptedRef.current = true

    try {
      await authService.signIn({ email, password })
    } catch (err) {
      loginAttemptedRef.current = false

      const authError = err as { code?: string; message?: string }
      const isEmailNotConfirmed =
        authError.code === 'email_not_confirmed' ||
        authError.message?.toLowerCase().includes('email not confirmed')

      if (isEmailNotConfirmed) {
        setShowResendConfirmation(true)
        setError('Please confirm your email address before logging in.')
      } else {
        await reportSystemError({
          feature: 'LOGIN',
          action: 'SIGN_IN',
          error: err,
        })
        setError(err instanceof Error ? err.message : 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      setError('Enter your email address first.')
      return
    }

    setResendLoading(true)
    setResendSuccess(false)
    setError(null)

    try {
      await authService.resendConfirmationEmail(email.trim())
      setResendSuccess(true)
    } catch (err) {
      await reportSystemError({
        feature: 'LOGIN',
        action: 'RESEND_CONFIRMATION_EMAIL',
        error: err,
      })
      setError(
        err instanceof Error
          ? err.message
          : 'Could not resend the confirmation email.',
      )
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">
          Login
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Login to your QuickSpeak account.
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setResendSuccess(false)
            }}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
          />

          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-sm font-medium underline"
            >
              Forgot Password?
            </Link>
          </div>

          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}

          {showResendConfirmation && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">
                Your email has not been confirmed yet. Send a new confirmation email to continue.
              </p>

              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resendLoading}
                className="mt-3 w-full rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-medium text-amber-900 disabled:opacity-50"
              >
                {resendLoading ? 'Sending...' : 'Resend Confirmation Email'}
              </button>

              {resendSuccess && (
                <p className="mt-2 text-sm text-green-700">
                  A new confirmation email has been sent. Please check your inbox.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-medium underline"
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
