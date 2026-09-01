import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  getEmailConfirmationResult,
  takeEmailConfirmationCallback,
  type EmailConfirmationResult,
} from '../lib/supabase'

export const Route = createFileRoute('/email-confirmed')({
  component: EmailConfirmedPage,
})

function EmailConfirmedPage() {
  const [result, setResult] = useState<EmailConfirmationResult | 'checking'>('checking')
  const resultPromiseRef = useRef<Promise<EmailConfirmationResult> | null>(null)

  useEffect(() => {
    if (!resultPromiseRef.current) {
      const callback = takeEmailConfirmationCallback()
      resultPromiseRef.current = getEmailConfirmationResult(callback)
    }

    let active = true

    void resultPromiseRef.current.then((confirmationResult) => {
      if (active) {
        setResult(confirmationResult)
      }
    }).catch(() => {
      if (active) {
        setResult('invalid_callback')
      }
    })

    return () => {
      active = false
    }
  }, [])

  if (result === 'checking') {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <p className="text-center text-sm text-slate-600">Verifying your email confirmation...</p>
        </div>
      </div>
    )
  }

  if (result !== 'success') {
    const isCallbackFailure = result === 'callback_error' || result === 'invalid_callback'

    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <div className="text-center">
            <div className="mb-4 text-5xl">⚠️</div>
            <h2 className="text-2xl font-bold text-slate-900">
              {isCallbackFailure
                ? 'Email Verification Failed'
                : 'Email Verification Could Not Be Confirmed'}
            </h2>

            <p className="mt-4 text-sm text-slate-600">
              {isCallbackFailure
                ? 'The verification link is invalid or has expired. Please request a new verification email.'
                : 'Open the verification link from your email to confirm your address.'}
            </p>

            <Link
              to="/login"
              className="mt-6 inline-block rounded-lg bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-800"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mb-4 text-5xl">✓</div>
          <h2 className="text-2xl font-bold text-slate-900">
            Email Verification Successful
          </h2>

          <p className="mt-4 text-sm text-slate-600">
            Your email address has been successfully verified.
          </p>

          <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm font-semibold text-amber-900">
              Status: Waiting for Admin Approval
            </p>
            <p className="mt-2 text-sm text-amber-800">
              Your account is now waiting for Admin approval.
            </p>
          </div>

          <Link
            to="/login"
            className="mt-6 inline-block rounded-lg bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-800"
          >
            Continue to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
