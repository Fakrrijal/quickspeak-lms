import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { getActivePaymentSettings, type PaymentSettings } from '../../services/payment-settings.service'
import {
  getCurrentStudentPaymentDetails,
  getStudentPaymentHistory,
  retryStudentPayment,
  submitStudentPaymentProof,
  type StudentPaymentDetails,
  type StudentPaymentHistoryItem,
  validatePaymentProofFile,
} from '../../services/student-payment.service'
import { reportSystemError } from '../../lib/systemErrorReporter'
import { downloadStudentPaymentReceiptPdf } from '../../utils/student-payment-receipt-pdf'

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return error instanceof Error ? error.message : fallback
}

function formatPackage(packageType: 'private' | 'semi_private') {
  return packageType === 'private' ? 'Private' : 'Semi-Private'
}

function formatPaymentStatus(status: string) {
  return status.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function formatPaymentMethod(value: string | null) {
  if (!value) return 'Not recorded'
  return value === 'bank_transfer' ? 'Bank Transfer' : formatPaymentStatus(value)
}

function formatPaymentDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatPeriod(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(value))
}

function statusBadgeClass(status: string) {
  if (status === 'approved' || status === 'paid') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
  if (status === 'proof_submitted' || status === 'partial') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
  if (status === 'rejected' || status === 'cancelled') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
  return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
}

function ActionArrow() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
}

function DetailIcon({ kind }: { kind: 'invoice' | 'calendar' | 'package' | 'amount' | 'method' }) {
  const paths = {
    invoice: <><path d="M7 3.5h8l3 3V20.5H7z" /><path d="M15 3.5v4h4M10 12h5M10 15.5h5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 2.5v5M16 2.5v5M3 9.5h18" /></>,
    package: <><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" /><path d="M4 7.5V16l8 5 8-5V7.5M12 12v9" /></>,
    amount: <><path d="M4 6h16v12H4z" /><path d="M8 12h.01M12 9v6M16 12h.01" /></>,
    method: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M7 14h3" /></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">{paths[kind]}</svg>
}

export function StudentPaymentPageV2() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [paymentDetails, setPaymentDetails] = useState<StudentPaymentDetails | null>(null)
  const [paymentHistory, setPaymentHistory] = useState<StudentPaymentHistoryItem[]>([])
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProof, setSelectedProof] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [proofMessage, setProofMessage] = useState<string | null>(null)
  const [proofError, setProofError] = useState<string | null>(null)
  const [selectedHistory, setSelectedHistory] = useState<StudentPaymentHistoryItem | null>(null)

  const canViewPayment = isAuthenticated && role === 'student' && status === 'active'

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || !profile || profileError || status === null) {
      navigate({ to: '/login', replace: true })
      return
    }
    if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  const loadPaymentPage = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [details, settings] = await Promise.all([
        getCurrentStudentPaymentDetails(),
        getActivePaymentSettings(),
      ])
      const history = details ? await getStudentPaymentHistory(details.enrollment.id) : []
      setPaymentDetails(details)
      setPaymentSettings(settings)
      setPaymentHistory(history)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load payment details.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canViewPayment) void loadPaymentPage()
  }, [canViewPayment, loadPaymentPage])

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

  const handleProofUpload = async () => {
    if (!selectedProof || !paymentDetails?.payment) return
    setIsUploading(true)
    setProofError(null)
    setProofMessage(null)
    try {
      await submitStudentPaymentProof(paymentDetails.enrollment.student_id, paymentDetails.payment.id, selectedProof)
      await loadPaymentPage()
      setSelectedProof(null)
      setProofMessage('Payment proof submitted successfully. Your payment is now waiting for verification.')
    } catch (uploadError) {
      await reportSystemError({ feature: 'PAYMENT_UPLOAD', action: 'UPLOAD_PROOF', error: uploadError })
      try {
        const details = await getCurrentStudentPaymentDetails()
        if (details?.payment?.status === 'proof_submitted') {
          setPaymentDetails(details)
          setSelectedProof(null)
          setProofMessage('Payment proof submitted successfully. Your payment is now waiting for verification.')
          return
        }
      } catch {
        // Preserve original error when confirmation reload fails.
      }
      setProofError(getErrorMessage(uploadError, 'Unable to submit payment proof.'))
    } finally {
      setIsUploading(false)
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
      setProofMessage('A new payment attempt has been created. Please complete the payment and upload your new proof.')
    } catch (retryError) {
      setProofError(getErrorMessage(retryError, 'Unable to create a new payment attempt.'))
    } finally {
      setIsRetrying(false)
    }
  }

  const makeReceiptData = (item: StudentPaymentHistoryItem) => ({
    ...item,
    studentName: profile?.full_name || 'QuickSpeak Student',
    studentEmail: profile?.email || 'No email on file',
    packageLabel: paymentDetails ? formatPackage(paymentDetails.enrollment.package_type) : '—',
  })

  const handleDownload = (item: StudentPaymentHistoryItem) => {
    if (!profile) return
    downloadStudentPaymentReceiptPdf(makeReceiptData(item))
  }

  if (authLoading || profileLoading) {
    return <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">Loading payment...</div>
  }

  if (!isAuthenticated || !profile || profileError || status !== 'active') return null
  if (role !== 'student') return <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-800">Access denied.</div>

  const invoice = paymentDetails?.invoice
  const payment = paymentDetails?.payment
  const isPaid = invoice?.status === 'paid' || payment?.status === 'approved'
  const isRejected = payment?.status === 'rejected'
  const isProofSubmitted = payment?.status === 'proof_submitted'
  const canUploadProof = payment?.status === 'unpaid' || isRejected
  const currentReceipt = payment && invoice ? {
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
  } : null

  const detailItems = invoice && payment ? [
    { label: 'Invoice Number', value: invoice.invoice_number, icon: 'invoice' as const },
    { label: 'Payment Date', value: formatPaymentDate(payment.created_at), icon: 'calendar' as const },
    { label: 'Period', value: formatPeriod(invoice.created_at), icon: 'calendar' as const },
    { label: 'Package', value: formatPackage(paymentDetails!.enrollment.package_type), icon: 'package' as const },
    { label: 'Amount', value: `Rp${payment.amount.toLocaleString('id-ID')}`, icon: 'amount' as const },
    { label: 'Payment Method', value: formatPaymentMethod(payment.payment_method), icon: 'method' as const },
  ] : []

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-blue-700">Student Portal</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] text-[#102449] sm:text-3xl">Payment</h1>
          <p className="mt-2 text-sm text-slate-600">Review your current payment and transaction history.</p>
        </div>
        <Link to="/student" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800">Back to Dashboard <ActionArrow /></Link>
      </header>

      {isLoading && <div className="rounded-[24px] border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">Loading current payment...</div>}
      {error && <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700"><p className="font-bold">Unable to load payment details</p><p className="mt-1">{error}</p><button type="button" onClick={() => void loadPaymentPage()} className="mt-3 font-bold underline">Retry</button></div>}

      {!isLoading && !error && !paymentDetails && (
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-700">Payment</p>
          <h2 className="mt-2 text-xl font-extrabold text-[#102449]">No enrollment found</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Choose a learning package before viewing payment details.</p>
          <Link to="/student/learning" className="mt-5 inline-flex rounded-full bg-[#102449] px-5 py-2.5 text-sm font-bold text-white">Open My Learning</Link>
        </section>
      )}

      {!isLoading && !error && paymentDetails && !invoice && (
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-extrabold text-[#102449]">Invoice not available</h2><p className="mt-2 text-sm text-slate-600">Your enrollment exists, but its payment invoice is not available yet.</p></section>
      )}

      {!isLoading && !error && paymentDetails && invoice && !payment && (
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-extrabold text-[#102449]">Payment record not available</h2><p className="mt-2 text-sm text-slate-600">Your invoice exists, but its payment record is not available yet.</p></section>
      )}

      {!isLoading && !error && paymentDetails && invoice && payment && (
        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-br from-[#eef5ff] via-white to-[#f8fbff] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-700">Current Payment</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-0.025em] text-[#102449]">{invoice.invoice_number}</h2>
              <p className="mt-1 text-sm text-slate-600">{formatPeriod(invoice.created_at)}</p>
            </div>
            <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-extrabold ${statusBadgeClass(payment.status)}`}>{formatPaymentStatus(payment.status)}</span>
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[1.15fr_.85fr] lg:p-6">
            <div>
              <dl className="grid gap-3 sm:grid-cols-2">
                {detailItems.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="rounded-2xl border border-slate-100 bg-[#fbfcfe] p-3.5">
                    <dt className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500"><span className="text-slate-400"><DetailIcon kind={item.icon} /></span>{item.label}</dt>
                    <dd className={`mt-1.5 break-words font-bold text-slate-950 ${item.label === 'Amount' ? 'text-lg' : 'text-sm'}`}>{item.value}</dd>
                  </div>
                ))}
              </dl>
              {isRejected && payment.rejection_reason && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800"><p className="font-bold">Payment rejected</p><p className="mt-1 leading-6">{payment.rejection_reason}</p></div>}
              {proofMessage && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-700">{proofMessage}</div>}
              {proofError && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">{proofError}</div>}
            </div>

            <aside className="rounded-[22px] border border-slate-200 bg-[#f8fafc] p-5">
              {isPaid && currentReceipt ? (
                <div>
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><span className="text-lg">✓</span></div>
                  <p className="mt-4 text-lg font-extrabold text-[#102449]">Payment complete</p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">Your payment has been approved and recorded in your payment history.</p>
                  <button type="button" onClick={() => handleDownload(currentReceipt)} className="mt-5 inline-flex items-center justify-center rounded-full bg-[#102449] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#16345f]">Download Receipt</button>
                </div>
              ) : isProofSubmitted ? (
                <div>
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><span className="text-lg">…</span></div>
                  <p className="mt-4 text-lg font-extrabold text-[#102449]">Proof submitted</p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">Your {formatPaymentMethod(payment.payment_method)} payment proof is waiting for verification.</p>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-700">Next step</p>
                  <h3 className="mt-1 text-lg font-extrabold text-[#102449]">Bank Transfer</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">Complete the payment, then upload your proof below.</p>
                  {paymentSettings && <div className="mt-4 space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 text-sm"><div><span className="text-xs text-slate-500">Bank</span><p className="mt-0.5 font-bold text-slate-950">{paymentSettings.bank_name}</p></div><div><span className="text-xs text-slate-500">Account Number</span><p className="mt-0.5 font-bold text-slate-950">{paymentSettings.account_number}</p></div><div><span className="text-xs text-slate-500">Account Name</span><p className="mt-0.5 font-bold text-slate-950">{paymentSettings.account_name}</p></div></div>}
                  {isRejected && <button type="button" onClick={() => void handleRetryPayment()} disabled={isRetrying} className="mt-4 inline-flex rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">{isRetrying ? 'Creating New Payment...' : 'Pay Again'}</button>}
                  {canUploadProof && <div className="mt-5 border-t border-slate-200 pt-5"><label className="block text-sm font-bold text-slate-800">Upload Payment Proof<input type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" onChange={handleProofSelection} disabled={isUploading} className="mt-2.5 block w-full text-xs text-slate-600" /></label><p className="mt-1.5 text-[11px] text-slate-500">PDF, JPG, JPEG, or PNG · maximum 5 MiB.</p>{selectedProof && <p className="mt-1.5 break-all text-[11px] font-bold text-slate-700">Selected: {selectedProof.name}</p>}<button type="button" onClick={() => void handleProofUpload()} disabled={!selectedProof || isUploading} className="mt-3 inline-flex w-full justify-center rounded-full bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{isUploading ? 'Uploading...' : 'Submit Payment Proof'}</button></div>}
                </div>
              )}
            </aside>
          </div>
        </section>
      )}

      {!isLoading && !error && paymentDetails && (
        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-700">History</p>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-extrabold tracking-[-0.025em] text-[#102449]">Payment History</h2>
                <p className="mt-1 text-sm text-slate-600">Your recorded payment transactions.</p>
              </div>
            </div>
          </div>

          {paymentHistory.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">No payment history yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-xs">
                <colgroup><col className="w-[22%]" /><col className="w-[15%]" /><col className="w-[14%]" /><col className="w-[13%]" /><col className="w-[15%]" /><col className="w-[10%]" /><col className="w-[11%]" /></colgroup>
                <thead className="bg-[#f8fafc] text-[9px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-3 py-3 text-left font-extrabold">Invoice Number</th><th className="px-3 py-3 text-left font-extrabold">Payment Date</th><th className="px-3 py-3 text-left font-extrabold">Period</th><th className="px-3 py-3 text-left font-extrabold">Amount</th><th className="px-3 py-3 text-left font-extrabold">Payment Method</th><th className="px-3 py-3 text-left font-extrabold">Status</th><th className="px-3 py-3 text-left font-extrabold">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="break-all px-3 py-3 font-bold text-slate-950">{item.invoice_number}</td>
                      <td className="px-3 py-3 text-slate-600">{formatPaymentDate(item.created_at)}</td>
                      <td className="px-3 py-3 text-slate-600">{item.period}</td>
                      <td className="px-3 py-3 font-bold text-slate-950">Rp{item.amount.toLocaleString('id-ID')}</td>
                      <td className="px-3 py-3 text-slate-600">{formatPaymentMethod(item.payment_method)}</td>
                      <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${statusBadgeClass(item.status)}`}>{formatPaymentStatus(item.status)}</span></td>
                      <td className="px-3 py-3"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><button type="button" onClick={() => setSelectedHistory(item)} className="font-bold text-blue-700 hover:text-blue-800">View</button><button type="button" onClick={() => handleDownload(item)} className="font-bold text-slate-700 hover:text-slate-950">Download</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {selectedHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="payment-detail-title">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[26px] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-700">Payment Detail</p><h2 id="payment-detail-title" className="mt-1 break-all text-lg font-extrabold text-[#102449]">{selectedHistory.invoice_number}</h2></div>
              <button type="button" onClick={() => setSelectedHistory(null)} aria-label="Close payment detail" className="rounded-xl px-3 py-2 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900">×</button>
            </div>
            <div className="space-y-3 px-5 py-5 sm:px-6">
              <dl className="grid gap-3 sm:grid-cols-2">
                {[['Invoice Number', selectedHistory.invoice_number], ['Payment Date', formatPaymentDate(selectedHistory.created_at)], ['Period', selectedHistory.period], ['Amount', `Rp${selectedHistory.amount.toLocaleString('id-ID')}`], ['Payment Method', formatPaymentMethod(selectedHistory.payment_method)], ['Status', formatPaymentStatus(selectedHistory.status)]].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-3.5"><dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</dt><dd className="mt-1.5 break-words text-sm font-bold text-slate-950">{value}</dd></div>)}
              </dl>
              {selectedHistory.rejection_reason && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800"><p className="font-bold">Rejection Reason</p><p className="mt-1 leading-6">{selectedHistory.rejection_reason}</p></div>}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6"><button type="button" onClick={() => setSelectedHistory(null)} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Close</button><button type="button" onClick={() => handleDownload(selectedHistory)} className="rounded-full bg-[#102449] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#16345f]">Download Receipt</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
