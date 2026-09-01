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
    return <ResetCard><p className="text-sm text-slate-600">Verifying your password reset link...</p></ResetCard>
  }

  if (recoveryResult !== 'success') {
    return (
      <ResetCard>
        <h2 className="text-2xl font-bold text-slate-900">Password Reset Link Invalid</h2>
        <p className="mt-4 text-sm text-slate-600">
          This password reset link is invalid or has expired. Please request a new one.
        </p>
        <Link to="/forgot-password" className="mt-6 inline-block font-medium underline">Request a New Link</Link>
      </ResetCard>
    )
  }

  if (updated) {
    return (
      <ResetCard>
        <h2 className="text-2xl font-bold text-slate-900">Password Updated Successfully</h2>
        <p className="mt-4 text-sm text-slate-600">Password updated successfully. You can now sign in with your new password.</p>
        <Link to="/login" className="mt-6 inline-block rounded-lg bg-slate-900 px-6 py-3 font-medium text-white">Go to Login</Link>
      </ResetCard>
    )
  }

  return (
    <ResetCard>
      <h2 className="text-2xl font-bold text-slate-900">Reset Password</h2>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input type="password" placeholder="New Password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2" />
        <input type="password" placeholder="Confirm New Password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={6} className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50">
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </ResetCard>
  )
}

function ResetCard({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md"><div className="rounded-xl border bg-white p-8 shadow-sm">{children}</div></div>
}
