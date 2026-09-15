import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  getPasswordRecoveryResult,
  takePasswordRecoveryCallback,
  type PasswordRecoveryResult,
} from '../lib/supabase'
import { authService } from '../services/auth.service'

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const [recoveryResult, setRecoveryResult] = useState<PasswordRecoveryResult | 'checking'>('checking')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [updated, setUpdated] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const resultPromiseRef = useRef<Promise<PasswordRecoveryResult> | null>(null)

  useEffect(() => {
    if (!resultPromiseRef.current) {
      resultPromiseRef.current = getPasswordRecoveryResult(takePasswordRecoveryCallback())
    }

    let active = true
    void resultPromiseRef.current.then((result) => {
      if (active) setRecoveryResult(result)
    }).catch(() => {
      if (active) setRecoveryResult('invalid_callback')
    })

    return () => {
      active = false
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!password) {
      setError('New password is required.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (!confirmation) {
      setError('Password confirmation is required.')
      return
    }
    if (password !== confirmation) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await authService.updatePassword(password)
      setUpdated(true)
    } catch {
      setError('Unable to update your password. The recovery link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  if (recoveryResult === 'checking') {
    return (
      <ResetCard>
        <div className="text-center">
          <BrandMark />
          <h1 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-[#102449]">Verifying your reset link</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Please wait while we verify your password recovery link.</p>
        </div>
      </ResetCard>
    )
  }

  if (recoveryResult !== 'success') {
    return (
      <ResetCard>
        <div className="text-center">
          <BrandMark />
          <h1 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-[#102449]">Reset link unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">This password reset link is invalid or has expired. Please request a new one.</p>
        </div>
        <Link
          to="/forgot-password"
          className="mt-7 flex h-12 w-full items-center justify-center rounded-xl bg-[#1b5dd7] px-4 font-semibold text-white shadow-sm transition hover:bg-[#154fb7] focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          Request a New Link
        </Link>
        <p className="mt-7 text-center text-sm text-slate-600">
          <Link to="/login" className="font-semibold text-[#1b5dd7] hover:text-[#154fb7] hover:underline">Back to Login</Link>
        </p>
      </ResetCard>
    )
  }

  if (updated) {
    return (
      <ResetCard>
        <div className="text-center">
          <BrandMark />
          <div className="mx-auto mt-7 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.2 4.2L19 7" />
            </svg>
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-[#102449]">Password updated successfully</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Your password has been changed. You can now sign in with your new password.</p>
        </div>
        <Link
          to="/login"
          className="mt-7 flex h-12 w-full items-center justify-center rounded-xl bg-[#1b5dd7] px-4 font-semibold text-white shadow-sm transition hover:bg-[#154fb7] focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          Go to Login
        </Link>
      </ResetCard>
    )
  }

  const fieldClass = 'h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1b5dd7] focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100'

  return (
    <ResetCard>
      <div className="text-center">
        <BrandMark />
        <h1 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-[#102449]">Create a new password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Choose a new password for your QuickSpeak account.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-7 space-y-5">
        <PasswordField
          id="reset-password"
          label="New password"
          value={password}
          placeholder="Create a new password"
          visible={showPassword}
          onToggle={() => setShowPassword((visible) => !visible)}
          onChange={setPassword}
          autoComplete="new-password"
          className={fieldClass}
        />

        <PasswordField
          id="reset-password-confirmation"
          label="Confirm new password"
          value={confirmation}
          placeholder="Repeat your new password"
          visible={showConfirmation}
          onToggle={() => setShowConfirmation((visible) => !visible)}
          onChange={setConfirmation}
          autoComplete="new-password"
          className={fieldClass}
        />

        <p className="text-xs text-slate-500">Use at least 6 characters.</p>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-xl bg-[#1b5dd7] px-4 font-semibold text-white shadow-sm transition hover:bg-[#154fb7] focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-600">
        <Link to="/login" className="font-semibold text-[#1b5dd7] hover:text-[#154fb7] hover:underline">Back to Login</Link>
      </p>
    </ResetCard>
  )
}

function ResetCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_18px_50px_rgba(15,35,75,0.08)] sm:p-9">
        {children}
      </section>
    </div>
  )
}

function BrandMark() {
  return (
    <div className="text-center">
      <img src="/favicon.svg" alt="QuickSpeak" className="mx-auto h-14 w-14" />
      <div className="mt-2 text-[17px] font-extrabold tracking-[-0.02em] text-[#102449]">QuickSpeak</div>
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.3em] text-[#1b5dd7]">English</div>
    </div>
  )
}

type PasswordFieldProps = {
  id: string
  label: string
  value: string
  placeholder: string
  visible: boolean
  onToggle: () => void
  onChange: (value: string) => void
  autoComplete: string
  className: string
}

function PasswordField({ id, label, value, placeholder, visible, onToggle, onChange, autoComplete, className }: PasswordFieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={6}
          autoComplete={autoComplete}
          className={`${className} pr-12`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          title={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-400 transition hover:text-[#102449]"
        >
          {visible ? (
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
  )
}
