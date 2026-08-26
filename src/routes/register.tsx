import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { authService } from '../services/auth.service'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const data = await authService.signUp({
        email,
        password,
        full_name: fullName,
      })

      // If Supabase returns a session, user is logged in immediately
      if (data.session) {
        navigate({ to: '/' })
      } else {
        // No session means email confirmation is required
        setSuccess(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            Registration Successful
          </h2>

          <p className="mt-4 text-sm text-slate-600">
            Please check your email to confirm your account.
          </p>

          <p className="mt-6 text-sm text-slate-600">
            Already confirmed?{' '}
            <Link
              to="/login"
              className="font-medium underline"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">
          Register
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Create your QuickSpeak LMS account.
        </p>

        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <input
            type="text"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
          />

          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium underline"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}