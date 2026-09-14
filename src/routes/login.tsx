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
  const [showPassword, setShowPassword] = useState(false)
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
      navigate({ to: '/teacher/overview', replace: true })
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
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-md items-center justify-center py-4">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_18px_50px_rgba(15,35,75,0.08)] sm:p-9">
        <div className="text-center">
          <img
            src="/favicon.svg"
            alt="QuickSpeak"
            className="mx-auto h-16 w-16"
          />
          <div className="mt-3 text-[18px] font-extrabold tracking-[-0.02em] text-[#102449]">QuickSpeak</div>
          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.3em] text-[#1b5dd7]">English</div>

          <h1 className="mt-7 text-3xl font-bold tracking-[-0.03em] text-[#102449]">
            Welcome back
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in to your QuickSpeak account.
          </p>
        </div>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Email</span>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setResendSuccess(false)
              }}
              autoComplete="email"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1b5dd7] focus:ring-4 focus:ring-blue-100"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1b5dd7] focus:ring-4 focus:ring-blue-100"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-400 transition hover:text-[#102449]"
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 102.8 2.8M9.9 4.2A10.7 10.7 0 0112 4c5.2 0 9.1 3.2 10.5 8a10.9 10.9 0 01-3.1 5M6.1 6.1C3.9 7.6 2.3 9.5 1.5 12 2.9 16.8 6.8 20 12 20c1.7 0 3.2-.3 4.6-.9" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-[#1b5dd7] transition hover:text-[#154fb7] hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
              {error}
            </div>
          )}

          {showResendConfirmation && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm leading-5 text-amber-900">
                Your email has not been confirmed yet. Send a new confirmation email to continue.
              </p>

              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resendLoading}
                className="mt-3 w-full rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
              >
                {resendLoading ? 'Sending...' : 'Resend confirmation email'}
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
            className="h-12 w-full rounded-xl bg-[#1b5dd7] px-4 font-semibold text-white shadow-sm transition hover:bg-[#154fb7] focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-slate-600">
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            className="font-semibold text-[#1b5dd7] transition hover:text-[#154fb7] hover:underline"
          >
            Register
          </Link>
        </p>
      </section>
    </div>
  )
}