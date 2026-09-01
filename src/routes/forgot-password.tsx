import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { authService } from '../services/auth.service'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await authService.resetPasswordForEmail({ email })
      setSent(true)
    } catch {
      setError('Unable to send a reset link right now. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Forgot Password</h2>
        <p className="mt-2 text-sm text-slate-600">
          Enter the email address associated with your QuickSpeak LMS account.
        </p>

        {sent ? (
          <p className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
            If an account exists for this email, a password reset link has been sent.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-slate-600">
          <Link to="/login" className="font-medium underline">Back to Login</Link>
        </p>
      </div>
    </div>
  )
}
