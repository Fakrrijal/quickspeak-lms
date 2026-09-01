import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../providers/AuthProvider'
import {
  getActivePaymentSettings,
  type PaymentSettings,
} from '../services/payment-settings.service'
import {
  getCurrentStudentPaymentDetails,
  getMyStudentContinuationStatus,
  initializeEnrollmentPayment,
  requestNextLevelEnrollment,
  type StudentContinuationStatus,
  submitStudentPaymentProof,
  type StudentPaymentDetails,
  validatePaymentProofFile,
} from '../services/student-payment.service'

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
  const [continuationStatus, setContinuationStatus] = useState<StudentContinuationStatus | null>(null)
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedProof, setSelectedProof] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [proofMessage, setProofMessage] = useState<string | null>(null)
  const [proofError, setProofError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [continuationError, setContinuationError] = useState<string | null>(null)
  const [selectedContinuationPackage, setSelectedContinuationPackage] = useState<'private' | 'semi_private'>('private')
  const [isContinuing, setIsContinuing] = useState(false)

  useEffect(() => {
    if (authLoading || profileLoading) {
      return
    }

    if (!isAuthenticated || !profile || profileError || status === null) {
      navigate({ to: '/login', replace: true })
      return
    }

    if (status === 'waiting') {
      navigate({ to: '/waiting', replace: true })
    }
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  const canViewPayment =
    isAuthenticated && role === 'student' && status === 'active'

  const loadPaymentPage = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [details, settings, continuation] = await Promise.all([
        getCurrentStudentPaymentDetails(),
        getActivePaymentSettings(),
        getMyStudentContinuationStatus(),
      ])
      setPaymentDetails(details)
      setPaymentSettings(settings)
      setContinuationStatus(continuation)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load payment details.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleContinueLearning = async () => {
    if (!continuationStatus?.continuation_available || isContinuing) {
      return
    }

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

  useEffect(() => {
    if (canViewPayment) {
      void loadPaymentPage()
    }
  }, [canViewPayment, loadPaymentPage])

  const handleProofSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleProofUpload = async () => {
    if (!selectedProof || !paymentDetails?.payment) {
      return
    }

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
      try {
        const details = await getCurrentStudentPaymentDetails()

        if (details?.payment?.status === 'proof_submitted') {
          setPaymentDetails(details)
          setSelectedProof(null)
          setProofMessage('Payment proof submitted. Waiting for payment verification.')
          return
        }
      } catch {
        // Preserve the original upload error when the confirmation reload fails.
      }

      setProofError(getErrorMessage(uploadError, 'Unable to submit payment proof.'))
    } finally {
      setIsUploading(false)
    }
  }

  if (authLoading || profileLoading) {
    return <p>Loading...</p>
  }

  if (!isAuthenticated || !profile || profileError || status === null || status === 'waiting') {
    return null
  }

  if (role !== 'student' || status !== 'active') {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
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
  const canUploadProof = payment?.status === 'unpaid' || isRejected
  const isLevelFourComplete = continuationStatus?.is_completed
    && continuationStatus.next_level_id === null
  const existingContinuation = Boolean(
    continuationStatus
    && paymentDetails
    && paymentDetails.enrollment.id !== continuationStatus.enrollment_id,
  )
  const continuationUnavailableMessage = continuationStatus && !continuationStatus.is_completed
    ? `Available after completing ${continuationStatus.session_limit}/${continuationStatus.session_limit} sessions.`
    : null

  return (
    <section className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-3xl font-bold text-slate-900">Payment</h2>
        <Link to="/student" className="text-sm font-medium text-slate-700 underline">
          Back to Student Portal
        </Link>
      </div>

      {isLoading && (
        <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Loading payment details...</p>
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
          <h3 className="text-lg font-semibold">Unable to load payment details</h3>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      )}

      {!isLoading && !error && !paymentDetails && (
        <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">No enrollment found</h3>
          <p className="mt-2 text-sm text-slate-600">
            Choose a learning package before viewing payment details.
          </p>
        </div>
      )}

      {!isLoading && !error && paymentDetails && !invoice && (
        <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">Invoice not available</h3>
          <p className="mt-2 text-sm text-slate-600">
            Your enrollment exists, but its payment invoice is not available yet.
          </p>
        </div>
      )}

      {!isLoading && !error && paymentDetails && invoice && !payment && (
        <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">Payment record not available</h3>
          <p className="mt-2 text-sm text-slate-600">
            Your invoice exists, but its payment record is not available yet.
          </p>
        </div>
      )}

      {!isLoading && !error && paymentDetails && invoice && payment && paymentSettings && (
        <div className="mt-8 space-y-6">
          <div id="payment-details" className="rounded-xl border bg-white p-6 shadow-sm">
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="font-medium text-slate-700">Invoice</dt>
                <dd className="mt-1 text-slate-900">{invoice.invoice_number}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">Package</dt>
                <dd className="mt-1 text-slate-900">
                  {formatPackage(paymentDetails.enrollment.package_type)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">Amount</dt>
                <dd className="mt-1 text-slate-900">
                  Rp{invoice.amount.toLocaleString('id-ID')}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">Payment Status</dt>
                <dd className="mt-1 text-slate-900">{formatPaymentStatus(payment.status)}</dd>
              </div>
            </dl>
          </div>

          {isPaid ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
              <h3 className="text-lg font-semibold text-emerald-900">Payment complete</h3>
              <p className="mt-2 text-sm text-emerald-800">
                Your payment has been approved.
              </p>
            </div>
          ) : isProofSubmitted ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
              <h3 className="text-lg font-semibold text-amber-900">Payment proof submitted</h3>
              <p className="mt-2 text-sm text-amber-800">
                Waiting for payment verification.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">Payment Instructions</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="font-medium text-slate-700">Bank</dt>
                  <dd className="mt-1 text-slate-900">{paymentSettings.bank_name}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Account Number</dt>
                  <dd className="mt-1 text-slate-900">{paymentSettings.account_number}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Account Name</dt>
                  <dd className="mt-1 text-slate-900">{paymentSettings.account_name}</dd>
                </div>
              </dl>

              {isRejected && (
                <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  Your payment was rejected. Please review the instructions before submitting a new proof.
                  {payment.rejection_reason ? ` Reason: ${payment.rejection_reason}` : ''}
                </p>
              )}

              {proofMessage && (
                <p className="mt-6 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                  {proofMessage}
                </p>
              )}

              {proofError && (
                <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {proofError}
                </p>
              )}

              {canUploadProof && (
                <div className="mt-6 rounded-lg bg-slate-50 p-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Upload Payment Proof
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                      onChange={handleProofSelection}
                      disabled={isUploading}
                      className="mt-2 block w-full text-sm text-slate-700 disabled:opacity-50"
                    />
                  </label>
                  <p className="mt-2 text-xs text-slate-600">
                    PDF, JPG, JPEG, or PNG up to 5 MiB.
                  </p>
                  {selectedProof && (
                    <p className="mt-3 text-sm text-slate-700">
                      Selected: {selectedProof.name}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleProofUpload()}
                    disabled={!selectedProof || isUploading}
                    className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {isUploading ? 'Uploading...' : 'Submit Payment Proof'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!isLoading && !error && continuationStatus && (
        <section className="mt-8 rounded-xl border bg-white p-6 shadow-sm" aria-labelledby="continue-learning-heading">
          <h3 id="continue-learning-heading" className="text-xl font-semibold text-slate-900">
            Continue Learning
          </h3>

          <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-900">Current Enrollment</p>
            <p className="mt-2">Level: {continuationStatus.level_name}</p>
            <p>Package: {formatPackage(continuationStatus.package_type)}</p>
            <p className="mt-4 font-medium text-slate-900">Learning Progress</p>
            <p>{continuationStatus.valid_present_count} / {continuationStatus.session_limit} sessions</p>
            {continuationStatus.is_completed && (
              <p className="mt-2 font-medium text-emerald-700">Package Completed</p>
            )}
          </div>

          {existingContinuation && paymentDetails ? (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold">
                {paymentDetails.payment?.status === 'rejected' ? 'Payment Rejected' : 'Payment Pending'}
              </p>
              <p className="mt-1">A continuation enrollment already exists. Continue with its payment below.</p>
              <a href="#payment-details" className="mt-3 inline-block font-medium underline">
                {paymentDetails.payment?.status === 'rejected'
                  ? 'Perbaiki / Kirim Ulang Pembayaran'
                  : 'Lanjutkan Pembayaran'}
              </a>
            </div>
          ) : isLevelFourComplete ? (
            <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">Level 4 Completed</p>
              <p className="mt-1">You have completed the QuickSpeak learning levels.</p>
            </div>
          ) : (
            <>
              {continuationStatus.next_level_name && (
                <div className="mt-5">
                  <p className="text-sm font-medium text-slate-700">Next Level</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {continuationStatus.next_level_name}
                  </p>
                </div>
              )}

              <fieldset className="mt-5" disabled={!continuationStatus.continuation_available || isContinuing}>
                <legend className="text-sm font-medium text-slate-700">Choose Package</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {([
                    ['private', 'Private', 'Rp180.000'],
                    ['semi_private', 'Semi-Private', 'Rp150.000'],
                  ] as const).map(([value, label, price]) => (
                    <label key={value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4 text-sm disabled:cursor-not-allowed">
                      <input
                        type="radio"
                        name="continuation-package"
                        value={value}
                        checked={selectedContinuationPackage === value}
                        onChange={() => setSelectedContinuationPackage(value)}
                        className="mt-1"
                      />
                      <span><span className="block font-medium text-slate-900">{label}</span>{price}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {continuationUnavailableMessage && (
                <p className="mt-4 text-sm text-amber-700">{continuationUnavailableMessage}</p>
              )}
              {continuationError && (
                <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{continuationError}</p>
              )}

              <button
                type="button"
                onClick={() => void handleContinueLearning()}
                disabled={!continuationStatus.continuation_available || isContinuing}
                className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isContinuing ? 'Creating continuation...' : 'Lanjut ke Level Berikutnya'}
              </button>
            </>
          )}
        </section>
      )}
    </section>
  )
}
