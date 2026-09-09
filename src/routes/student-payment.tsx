import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../providers/AuthProvider'
import {
  getActivePaymentSettings,
  type PaymentSettings,
} from '../services/payment-settings.service'
import {
  getCurrentStudentPaymentDetails,
  getMyStudentContinuationStatus,
  getStudentPaymentHistory,
  initializeEnrollmentPayment,
  requestNextLevelEnrollment,
  retryStudentPayment,
  type StudentContinuationStatus,
  submitStudentPaymentProof,
  type StudentPaymentDetails,
  type StudentPaymentHistoryItem,
  validatePaymentProofFile,
} from '../services/student-payment.service'
import { reportSystemError } from '../lib/systemErrorReporter'
import { downloadStudentPaymentReceiptPdf } from '../utils/student-payment-receipt-pdf'

export const Route = createFileRoute('/student-payment')({
  component: StudentPaymentPage,
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

function formatPackage(packageType: 'private' | 'semi_private') {
  return packageType === 'private' ? 'Private' : 'Semi-Private'
}

function formatPaymentStatus(status: string) {
  return status.split('_').map((word) => (
    word.charAt(0).toUpperCase() + word.slice(1)
  )).join(' ')
}

function formatPaymentMethod(value: string | null) {
  if (!value) return 'Not recorded'
  return value === 'bank_transfer'
    ? 'Bank Transfer'
    : formatPaymentStatus(value)
}

function formatPaymentDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatPeriod(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

function getContinuationErrorMessage(error: unknown) {
  const message = getErrorMessage(error, 'Unable to continue to the next level.')

  if (message.includes('has not completed')) {
    return 'Your current package has not been completed yet.'
  }
  if (message.includes('already has an enrollment')) {
    return 'A continuation enrollment already exists. Please continue your existing payment.'
  }
  if (message.includes('has no next level')) {
    return 'No further level is available.'
  }

  return 'Unable to continue to the next level. Please try again.'
}

function statusBadgeClass(status: string) {
  if (status === 'approved' || status === 'paid') {
    return 'bg-emerald-50 text-emerald-700'
  }
  if (status === 'proof_submitted' || status === 'partial') {
    return 'bg-amber-50 text-amber-700'
  }
  if (status === 'rejected' || status === 'cancelled') {
    return 'bg-rose-50 text-rose-700'
  }
  return 'bg-slate-100 text-slate-700'
}

function StudentPaymentPage() {
  const {
    isAuthenticated,
    loading: authLoading,
    profile,
    profileError,
    profileLoading,
    role,
    status,
  } = useAuthContext()
  const navigate = useNavigate()
  const [paymentDetails, setPaymentDetails] = useState<StudentPaymentDetails | null>(null)
  const [paymentHistory, setPaymentHistory] = useState<StudentPaymentHistoryItem[]>([])
  const [continuationStatus, setContinuationStatus] = useState<StudentContinuationStatus | null>(null)
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedProof, setSelectedProof] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [proofMessage, setProofMessage] = useState<string | null>(null)
  const [proofError, setProofError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [continuationError, setContinuationError] = useState<string | null>(null)
  const [selectedContinuationPackage, setSelectedContinuationPackage] = useState<'private' | 'semi_private'>('private')
  const [isContinuing, setIsContinuing] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState<StudentPaymentHistoryItem | null>(null)

  useEffect(() => {
    if (authLoading || profileLoading) return

    if (!isAuthenticated || !profile || profileError || status === null) {
      navigate({ to: '/login', replace: true })
      return
    }

    if (status === 'waiting') {
      navigate({ to: '/waiting', replace: true })
    }
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  const canViewPayment = isAuthenticated && role === 'student' && status === 'active'

  const loadPaymentPage = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [details, settings, continuation] = await Promise.all([
        getCurrentStudentPaymentDetails(),
        getActivePaymentSettings(),
        getMyStudentContinuationStatus(),
      ])

      const history = details
        ? await getStudentPaymentHistory(details.enrollment.id)
        : []

      setPaymentDetails(details)
      setPaymentHistory(history)
      setPaymentSettings(settings)
      setContinuationStatus(continuation)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load payment details.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canViewPayment) void loadPaymentPage()
  }, [canViewPayment, loadPaymentPage])

  const handleContinueLearning = async () => {
    if (!continuationStatus?.continuation_available || isContinuing) return

    setIsContinuing(true)
    setContinuationError(null)

    try {
      const enrollment = await requestNextLevelEnrollment(selectedContinuationPackage)
      await initializeEnrollmentPayment(enrollment.enrollment_id)
      await loadPaymentPage()
    } catch (continuationRequestError) {
      setContinuationError(getContinuationErrorMessage(continuationRequestError))
      await loadPaymentPage().catch(() => undefined)
    } finally {
      setIsContinuing(false)
    }
  }

  const handleProofSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setProofMessage(null)
    setProofError(null)

    if (!file) {
      setSelectedProof(null)
      return
    }

    try {
      validatePaymentProofFile(file)
      setSelectedProof(file)
    } catch (validationError) {
      setSelectedProof(null)
      setProofError(getErrorMessage(validationError, 'The selected file is invalid.'))
      event.target.value = ''
    }
  }

  const handleRetryPayment = async () => {
    if (!paymentDetails || paymentDetails.payment?.status !== 'rejected' || isRetrying) return

    setIsRetrying(true)
    setProofError(null)
    setProofMessage(null)
    setSelectedProof(null)

    try {
      await retryStudentPayment(paymentDetails.enrollment.id)
      await loadPaymentPage()
      setProofMessage('A new payment attempt has been created. Please make the payment and upload the new proof.')
    } catch (retryError) {
      setProofError(getErrorMessage(retryError, 'Unable to create a new payment attempt.'))
    } finally {
      setIsRetrying(false)
    }
  }

  const handleProofUpload = async () => {
    if (!selectedProof || !paymentDetails?.payment) return

    setIsUploading(true)
    setProofError(null)
    setProofMessage(null)

    try {
      await submitStudentPaymentProof(
        paymentDetails.enrollment.student_id,
        paymentDetails.payment.id,
        selectedProof,
      )
      await loadPaymentPage()
      setSelectedProof(null)
      setProofMessage('Payment proof submitted. Waiting for payment verification.')
    } catch (uploadError) {
      await reportSystemError({
        feature: 'PAYMENT_UPLOAD',
        action: 'UPLOAD_PROOF',
        error: uploadError,
      })

      try {
        const details = await getCurrentStudentPaymentDetails()
        if (details?.payment?.status === 'proof_submitted') {
          setPaymentDetails(details)
          setSelectedProof(null)
          setProofMessage('Payment proof submitted. Waiting for payment verification.')
          return
        }
      } catch {
        // Preserve the original upload error when confirmation reload fails.
      }

      setProofError(getErrorMessage(uploadError, 'Unable to submit payment proof.'))
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownload = (item: StudentPaymentHistoryItem) => {
    if (!profile || !paymentDetails) return

    downloadStudentPaymentReceiptPdf({
      ...item,
      studentName: profile.full_name || 'QuickSpeak Student',
      studentEmail: profile.email,
      packageLabel: formatPackage(paymentDetails.enrollment.package_type),
    })
  }

  if (authLoading || profileLoading) return <p className="text-slate-600">Loading...</p>

  if (!isAuthenticated || !profile || profileError || status === null || status === 'waiting') {
    return null
  }

  if (role !== 'student' || status !== 'active') {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <h2 className="text-xl font-semibold">Access denied</h2>
        <p className="mt-2">You do not have permission to view payment details.</p>
      </section>
    )
  }

  const invoice = paymentDetails?.invoice
  const payment = paymentDetails?.payment
  const isPaid = invoice?.status === 'paid' || payment?.status === 'approved'
  const isRejected = payment?.status === 'rejected'
  const isProofSubmitted = payment?.status === 'proof_submitted'
  const canUploadProof = payment?.status === 'unpaid' || payment?.status === 'rejected'
  const isLevelFourComplete = Boolean(
    continuationStatus?.is_completed && continuationStatus.next_level_id === null,
  )
  const existingContinuation = Boolean(
    continuationStatus
    && paymentDetails
    && paymentDetails.enrollment.id !== continuationStatus.enrollment_id,
  )
  const continuationUnavailableMessage = continuationStatus && !continuationStatus.is_completed
    ? `Available after completing ${continuationStatus.session_limit} sessions.`
    : null

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">Student Portal</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Payment</h1>
          <p className="mt-2 text-sm text-slate-600">Manage your current payment and review your payment history.</p>
        </div>
        <Link to="/student" className="text-sm font-semibold text-blue-600 hover:text-blue-700">Back to Dashboard →</Link>
      </header>

      {isLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Loading payment details...</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <h2 className="font-semibold">Unable to load payment details</h2>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      )}

      {!isLoading && !error && !paymentDetails && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">No enrollment found</h2>
          <p className="mt-2 text-sm text-slate-600">Choose a learning package before viewing payment details.</p>
        </div>
      )}

      {!isLoading && !error && paymentDetails && !invoice && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Invoice not available</h2>
          <p className="mt-2 text-sm text-slate-600">Your enrollment exists, but its payment invoice is not available yet.</p>
        </div>
      )}

      {!isLoading && !error && paymentDetails && invoice && !payment && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Payment record not available</h2>
          <p className="mt-2 text-sm text-slate-600">Your invoice exists, but its payment record is not available yet.</p>
        </div>
      )}

      {!isLoading && !error && paymentDetails && invoice && payment && (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 via-white to-sky-50 px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Current Payment</p>
                <h2 className="mt-2 text-2xl font-extrabold text-slate-950">{invoice.invoice_number}</h2>
                <p className="mt-1 text-sm text-slate-600">{formatPeriod(invoice.created_at)}</p>
              </div>
              <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-sm font-semibold ${statusBadgeClass(payment.status)}`}>
                {formatPaymentStatus(payment.status)}
              </span>
            </div>
          </div>

          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <dl className="grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice Number</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{invoice.invoice_number}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Date</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{formatPaymentDate(payment.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Period</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{formatPeriod(invoice.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Package</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{formatPackage(paymentDetails.enrollment.package_type)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</dt>
                  <dd className="mt-1 text-2xl font-extrabold text-slate-950">Rp{payment.amount.toLocaleString('id-ID')}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Method</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{formatPaymentMethod(payment.payment_method)}</dd>
                </div>
              </dl>

              {isRejected && payment.rejection_reason && (
                <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <p className="font-semibold">Payment rejected</p>
                  <p className="mt-1">{payment.rejection_reason}</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              {isPaid ? (
                <div>
                  <p className="text-sm font-semibold text-emerald-700">Payment complete</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Your payment has been approved and is recorded in your payment history.</p>
                  <button
                    type="button"
                    onClick={() => handleDownload({
                      id: payment.id,
                      invoice_id: invoice.id,
                      invoice_number: invoice.invoice_number,
                      invoice_amount: invoice.amount,
                      invoice_status: invoice.status,
                      amount: payment.amount,
                      status: payment.status,
                      payment_method: payment.payment_method,
                      rejection_reason: payment.rejection_reason,
                      created_at: payment.created_at,
                      period: formatPeriod(invoice.created_at),
                    })}
                    className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Download Receipt
                  </button>
                </div>
              ) : isProofSubmitted ? (
                <div>
                  <p className="text-sm font-semibold text-amber-700">Payment proof submitted</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Waiting for payment verification. Your recorded method is {formatPaymentMethod(payment.payment_method)}.</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-slate-900">Payment method</p>
                  <p className="mt-1 text-sm text-slate-600">Current supported method: Bank Transfer.</p>
                  {paymentSettings && (
                    <dl className="mt-4 space-y-3 text-sm">
                      <div><dt className="font-medium text-slate-600">Bank</dt><dd className="font-semibold text-slate-950">{paymentSettings.bank_name}</dd></div>
                      <div><dt className="font-medium text-slate-600">Account Number</dt><dd className="font-semibold text-slate-950">{paymentSettings.account_number}</dd></div>
                      <div><dt className="font-medium text-slate-600">Account Name</dt><dd className="font-semibold text-slate-950">{paymentSettings.account_name}</dd></div>
                    </dl>
                  )}

                  {isRejected && (
                    <button
                      type="button"
                      onClick={() => void handleRetryPayment()}
                      disabled={isRetrying}
                      className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {isRetrying ? 'Creating New Payment...' : 'Pay Again'}
                    </button>
                  )}

                  {canUploadProof && (
                    <div className="mt-5 border-t border-slate-200 pt-5">
                      <label className="block text-sm font-semibold text-slate-800">
                        Upload Payment Proof
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                          onChange={handleProofSelection}
                          disabled={isUploading}
                          className="mt-2 block w-full text-sm text-slate-600"
                        />
                      </label>
                      <p className="mt-2 text-xs text-slate-500">PDF, JPG, JPEG, or PNG · maximum 5 MiB.</p>
                      {selectedProof && <p className="mt-2 text-sm font-medium text-slate-700">Selected: {selectedProof.name}</p>}
                      {proofError && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{proofError}</p>}
                      {proofMessage && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{proofMessage}</p>}
                      <button
                        type="button"
                        onClick={() => void handleProofUpload()}
                        disabled={!selectedProof || isUploading}
                        className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isUploading ? 'Uploading...' : 'Submit Payment Proof'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {!isLoading && !error && paymentDetails && (
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">History</p>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-950">Payment History</h2>
              <p className="mt-1 text-sm text-slate-600">Your recorded payment transactions.</p>
            </div>
          </div>

          {paymentHistory.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No payment history yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Invoice Number</th>
                    <th className="px-5 py-4 font-semibold">Payment Date</th>
                    <th className="px-5 py-4 font-semibold">Period</th>
                    <th className="px-5 py-4 font-semibold">Amount</th>
                    <th className="px-5 py-4 font-semibold">Payment Method</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-950">{item.invoice_number}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatPaymentDate(item.created_at)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">{item.period}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-950">Rp{item.amount.toLocaleString('id-ID')}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatPaymentMethod(item.payment_method)}</td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}>{formatPaymentStatus(item.status)}</span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => setSelectedHistory(item)} className="font-semibold text-blue-600 hover:text-blue-700">View</button>
                          <button type="button" onClick={() => handleDownload(item)} className="font-semibold text-slate-700 hover:text-slate-950">Download</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {paymentDetails && continuationStatus && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Next Level</p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-950">Continue Learning</h2>
          </div>

          {isLevelFourComplete ? (
            <p className="mt-4 text-sm text-slate-600">You have completed the highest available level. No further level is available.</p>
          ) : existingContinuation ? (
            <p className="mt-4 text-sm text-slate-600">A continuation enrollment already exists. Please continue your existing payment above.</p>
          ) : continuationStatus.continuation_available ? (
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-sm text-slate-600">Next level</p>
                <p className="mt-1 text-xl font-bold text-slate-950">{continuationStatus.next_level_name} · Level {continuationStatus.next_level_number}</p>
                <label className="mt-4 block max-w-xs text-sm font-medium text-slate-700">
                  Package
                  <select
                    value={selectedContinuationPackage}
                    onChange={(event) => setSelectedContinuationPackage(event.target.value as 'private' | 'semi_private')}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                  >
                    <option value="private">Private</option>
                    <option value="semi_private">Semi-Private</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={() => void handleContinueLearning()}
                disabled={isContinuing}
                className="inline-flex justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isContinuing ? 'Creating Enrollment...' : 'Continue to Next Level'}
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">{continuationUnavailableMessage || 'Continuation is not available yet.'}</p>
          )}

          {continuationError && (
            <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{continuationError}</p>
          )}
        </section>
      )}

      {selectedHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="payment-detail-title">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Payment Detail</p>
                <h2 id="payment-detail-title" className="mt-1 text-xl font-extrabold text-slate-950">{selectedHistory.invoice_number}</h2>
              </div>
              <button type="button" onClick={() => setSelectedHistory(null)} className="rounded-xl px-3 py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Close payment detail">✕</button>
            </div>
            <div className="space-y-5 px-6 py-6">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice Number</dt><dd className="mt-1 font-semibold text-slate-950">{selectedHistory.invoice_number}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Date</dt><dd className="mt-1 font-semibold text-slate-950">{formatPaymentDate(selectedHistory.created_at)}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Period</dt><dd className="mt-1 font-semibold text-slate-950">{selectedHistory.period}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</dt><dd className="mt-1 font-semibold text-slate-950">Rp{selectedHistory.amount.toLocaleString('id-ID')}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Method</dt><dd className="mt-1 font-semibold text-slate-950">{formatPaymentMethod(selectedHistory.payment_method)}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</dt><dd className="mt-1"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(selectedHistory.status)}`}>{formatPaymentStatus(selectedHistory.status)}</span></dd></div>
              </dl>
              {selectedHistory.rejection_reason && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="font-semibold">Rejection Reason</p><p className="mt-1">{selectedHistory.rejection_reason}</p></div>}
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setSelectedHistory(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>
              <button type="button" onClick={() => handleDownload(selectedHistory)} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Download Receipt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
