import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">
          Register
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Create your QuickSpeak LMS account.
        </p>

        <div className="mt-6 space-y-4">
          <input
            type="text"
            placeholder="Full name"
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
          />

          <input
            type="email"
            placeholder="Email"
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
          />

          <button
            type="button"
            className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white"
          >
            Register
          </button>
        </div>

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