import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import {
  createPaymentProofReviewUrl,
  getPendingPaymentVerifications,
  reviewPayment,
  type PaymentReviewDecision,
  type PendingPaymentVerification,
} from '../../services/admin-payment-verification.service'

export const Route = createFileRoute('/admin/payment-verification')({
  component: AdminPaymentVerificationPage,
})

function getErrorMessage(error: unknown, fallback: string) {
  if (
    error
    && typeof error === 'object'
    && 'message' in error
    && typeof error.message === 'string'
  ) {
    return error.message
  }

  return error instanceof Error ? error.message : fallback
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function AdminPaymentVerificationPage() {
  const {
    isAuthenticated,
    loading,
    profileLoading,
    profileError,
    role,
    status,
  } = useAuthContext()
  const navigate = useNavigate()
  const [payments, setPayments] = useState<PendingPaymentVerification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [actionPaymentId, setActionPaymentId] = useState<string | null>(null)
  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (loading || profileLoading) {
      return
    }

    if (!isAuthenticated || profileError || status === null) {
      navigate({ to: '/login' })
      return
    }

    if (status !== 'active') {
      navigate({ to: '/waiting' })
    }
  }, [isAuthenticated, loading, navigate, profileError, profileLoading, status])

  const canVerifyPayments =
    isAuthenticated && role === 'admin' && status === 'active'

  const loadPayments = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      setPayments(await getPendingPaymentVerifications())
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load pending payments.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canVerifyPayments) {
      void loadPayments()
    }
  }, [canVerifyPayments, loadPayments])

  const handleReview = async (payment: PendingPaymentVerification) => {
    setActionPaymentId(payment.payment_id)
    setError(null)
    setSuccessMessage(null)

    try {
      const signedUrl = await createPaymentProofReviewUrl(payment.proof_storage_path)
      const reviewWindow = window.open(signedUrl, '_blank', 'noopener,noreferrer')

      if (!reviewWindow) {
        setSuccessMessage(
          'Proof URL was generated, but your browser blocked the preview. Allow pop-ups and try again.',
        )
      } else if (
        payment.proof_mime_type
        && !['application/pdf', 'image/jpeg', 'image/png'].includes(payment.proof_mime_type)
      ) {
        setSuccessMessage('The proof was opened in a new tab. Your browser may download unsupported file types.')
      } else {
        setSuccessMessage('Proof opened in a new tab. The link expires in 60 seconds.')
      }
    } catch (reviewError) {
      setError(getErrorMessage(reviewError, 'Unable to create a proof review link.'))
    } finally {
      setActionPaymentId(null)
    }
  }

  const handleDecision = async (
    payment: PendingPaymentVerification,
    decision: PaymentReviewDecision,
  ) => {
    const trimmedReason = rejectionReason.trim()

    if (decision === 'approve' && !window.confirm(
      'Approve payment for ' + payment.student_name + '? This will mark the invoice paid.',
    )) {
      return
    }

    if (decision === 'reject' && !trimmedReason) {
      setError('A rejection reason is required.')
      return
    }

    setActionPaymentId(payment.payment_id)
    setError(null)
    setSuccessMessage(null)

    try {
      await reviewPayment(
        payment.payment_id,
        decision,
        decision === 'reject' ? trimmedReason : undefined,
      )
      setRejectingPaymentId(null)
      setRejectionReason('')
      setSuccessMessage(
        decision === 'approve'
          ? 'Payment approved successfully.'
          : 'Payment rejected successfully.',
      )
      await loadPayments()
    } catch (decisionError) {
      const message = getErrorMessage(
        decisionError,
        'Unable to process this payment.',
      )

      if (message.includes('Payment was already processed')) {
        setError('Payment was already processed. Refreshing the list.')
        await loadPayments()
      } else {
        setError(message)
      }
    } finally {
      setActionPaymentId(null)
    }
  }

  if (loading || profileLoading) {
    return <p>Loading...</p>
  }

  if (!isAuthenticated || profileError || status === null || status !== 'active') {
    return null
  }

  if (role !== 'admin') {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <h2 className="text-xl font-semibold">Access denied</h2>
        <p className="mt-2">You do not have permission to verify payments.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-3xl font-bold text-slate-900">Payment Verification</h2>
        <Link to="/admin" className="text-sm font-medium text-slate-700 underline">
          Back to Admin
        </Link>
      </div>

      {successMessage && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMessage}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-8 overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">Invoice</th>
              <th className="px-4 py-3 font-semibold">Package</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Submitted</th>
              <th className="px-4 py-3 font-semibold">Proof</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-slate-600">
                  Loading pending payments...
                </td>
              </tr>
            )}

            {!isLoading && payments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-slate-600">
                  There are no pending payment proofs.
                </td>
              </tr>
            )}

            {!isLoading && payments.map((payment) => {
              const isProcessing = actionPaymentId === payment.payment_id
              const isRejecting = rejectingPaymentId === payment.payment_id

              return (
                <tr key={payment.payment_id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-medium text-slate-900">{payment.student_name}</p>
                    <p className="text-slate-600">{payment.student_email}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-700">{payment.invoice_number}</td>
                  <td className="px-4 py-4 text-slate-700">{payment.package_type}</td>
                  <td className="px-4 py-4 text-slate-700">{formatAmount(payment.amount)}</td>
                  <td className="px-4 py-4 text-slate-700">
                    {formatSubmittedAt(payment.proof_uploaded_at)}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => void handleReview(payment)}
                      disabled={isProcessing}
                      className="rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-700 disabled:opacity-50"
                    >
                      Review
                    </button>
                    <p className="mt-1 max-w-48 truncate text-xs text-slate-500">
                      {payment.proof_original_filename ?? 'Uploaded proof'}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleDecision(payment, 'approve')}
                        disabled={isProcessing}
                        className="rounded-lg bg-emerald-700 px-3 py-2 font-medium text-white disabled:opacity-50"
                      >
                        {isProcessing ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingPaymentId(isRejecting ? null : payment.payment_id)
                          setRejectionReason('')
                          setError(null)
                        }}
                        disabled={isProcessing}
                        className="rounded-lg bg-red-700 px-3 py-2 font-medium text-white disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>

                    {isRejecting && (
                      <div className="mt-3 min-w-64 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                        <label className="block text-xs font-medium text-slate-700">
                          Rejection reason
                          <textarea
                            value={rejectionReason}
                            onChange={(event) => setRejectionReason(event.target.value)}
                            disabled={isProcessing}
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                            rows={3}
                          />
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleDecision(payment, 'reject')}
                            disabled={isProcessing || !rejectionReason.trim()}
                            className="rounded bg-red-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                          >
                            Confirm rejection
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingPaymentId(null)
                              setRejectionReason('')
                            }}
                            disabled={isProcessing}
                            className="rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
