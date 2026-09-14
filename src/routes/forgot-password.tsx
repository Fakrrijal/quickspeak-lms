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
    <div className="mx-auto max-w-md py-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_18px_50px_rgba(15,35,75,0.08)] sm:p-9">
        <div className="text-center">
          <img src="/favicon.svg" alt="QuickSpeak" className="mx-auto h-14 w-14" />
          <div className="mt-2 text-[17px] font-extrabold tracking-[-0.02em] text-[#102449]">QuickSpeak</div>
          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.3em] text-[#1b5dd7]">English</div>
          <h1 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-[#102449]">Forgot your password?</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Enter the email address associated with your QuickSpeak account.</p>
        </div>

        {sent ? (
          <div className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
            <p className="font-semibold text-emerald-900">Reset link sent</p>
            <p className="mt-1">If an account exists for this email, a password reset link has been sent. Please check your inbox.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1b5dd7] focus:ring-4 focus:ring-blue-100"
              />
            </label>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-[#1b5dd7] px-4 font-semibold text-white shadow-sm transition hover:bg-[#154fb7] focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="mt-7 text-center text-sm text-slate-600">
          <Link to="/login" className="font-semibold text-[#1b5dd7] transition hover:text-[#154fb7] hover:underline">Back to Login</Link>
        </p>
      </section>
    </div>
  )
}
