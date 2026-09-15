import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
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

const PAGE_SIZE = 10

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return error instanceof Error ? error.message : fallback
}

function formatPackage(value: 'private' | 'semi_private') {
  return value === 'private' ? 'Private' : 'Semi-Private'
}

function formatStatus(value: string) {
  return value.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function formatMethod(value: string | null) {
  if (!value) return 'Not recorded'
  return value === 'bank_transfer' ? 'Bank Transfer' : formatStatus(value)
}

function formatPaymentDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatPeriod(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(value))
}

function statusClass(status: string) {
  if (status === 'approved' || status === 'paid') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
  if (status === 'proof_submitted' || status === 'partial') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
  if (status === 'rejected' || status === 'cancelled') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
  return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
}

function Icon({ name }: { name: 'check' | 'close' | 'download' | 'invoice' | 'calendar' | 'package' | 'amount' | 'method' | 'arrow' }) {
  const common = 'size-4 fill-none stroke-current stroke-2'
  if (name === 'check') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="m5 12 4 4L19 6" /></svg>
  if (name === 'close') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M6 6l12 12M18 6 6 18" /></svg>
  if (name === 'download') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M12 4v11M8 11l4 4 4-4M5 20h14" /></svg>
  if (name === 'invoice') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M7 3.5h8l3 3V20.5H7z" /><path d="M15 3.5v4h4M10 12h5M10 15.5h5" /></svg>
  if (name === 'calendar') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 2.5v5M16 2.5v5M3 9.5h18" /></svg>
  if (name === 'package') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" /><path d="M4 7.5V16l8 5 8-5V7.5M12 12v9" /></svg>
  if (name === 'amount') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 6h16v12H4z" /><path d="M8 12h.01M12 9v6M16 12h.01" /></svg>
  if (name === 'method') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M7 14h3" /></svg>
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M5 12h13M13 6l6 6-6 6" /></svg>
}

export function StudentPaymentPageV3() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const proofInputRef = useRef<HTMLInputElement>(null)
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
  const [historyPage, setHistoryPage] = useState(1)

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
      const [details, settings] = await Promise.all([getCurrentStudentPaymentDetails(), getActivePaymentSettings()])
      const history = details ? await getStudentPaymentHistory(details.enrollment.id) : []
      setPaymentDetails(details)
      setPaymentSettings(settings)
      setPaymentHistory(history)
      setHistoryPage(1)
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
    const file = event.currentTarget.files?.[0] ?? null
    setProofMessage(null)
    setProofError(null)
    setSelectedProof(file)
  }

  const handleProofUpload = async () => {
    const currentFile = proofInputRef.current?.files?.[0] ?? selectedProof
    if (!currentFile || !paymentDetails?.payment) return
    setIsUploading(true)
    setProofError(null)
    setProofMessage(null)
    try {
      validatePaymentProofFile(currentFile)
      await submitStudentPaymentProof(paymentDetails.enrollment.student_id, paymentDetails.payment.id, currentFile)
      await loadPaymentPage()
      setSelectedProof(null)
      if (proofInputRef.current) proofInputRef.current.value = ''
      setProofMessage('Payment proof submitted successfully. Your payment is now waiting for verification.')
    } catch (uploadError) {
      await reportSystemError({ feature: 'PAYMENT_UPLOAD', action: 'UPLOAD_PROOF', error: uploadError })
      try {
        const details = await getCurrentStudentPaymentDetails()
        if (details?.payment?.status === 'proof_submitted') {
          setPaymentDetails(details)
          setSelectedProof(null)
          if (proofInputRef.current) proofInputRef.current.value = ''
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
    if (proofInputRef.current) proofInputRef.current.value = ''
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

  const downloadReceipt = (item: StudentPaymentHistoryItem) => {
    if (!profile) return
    downloadStudentPaymentReceiptPdf({
      ...item,
      studentName: profile.full_name || 'QuickSpeak Student',
      studentEmail: profile.email || 'No email on file',
      packageLabel: paymentDetails ? formatPackage(paymentDetails.enrollment.package_type) : '—',
    })
  }

  const totalPages = Math.max(1, Math.ceil(paymentHistory.length / PAGE_SIZE))
  const safePage = Math.min(historyPage, totalPages)
  const pageStart = paymentHistory.length ? (safePage - 1) * PAGE_SIZE : 0
  const pageRecords = paymentHistory.slice(pageStart, pageStart + PAGE_SIZE)
  const showingStart = paymentHistory.length ? pageStart + 1 : 0
  const showingEnd = paymentHistory.length ? Math.min(pageStart + PAGE_SIZE, paymentHistory.length) : 0
  const paginationPages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1) as Array<number | string>
    if (safePage <= 4) return [1, 2, 3, 4, 5, 'ellipsis-right', totalPages] as Array<number | string>
    if (safePage >= totalPages - 3) return [1, 'ellipsis-left', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as Array<number | string>
    return [1, 'ellipsis-left', safePage - 1, safePage, safePage + 1, 'ellipsis-right', totalPages] as Array<number | string>
  }, [safePage, totalPages])

  if (authLoading || profileLoading) return <section className="border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm text-slate-600">Loading payment...</p></section>
  if (!isAuthenticated || !profile || profileError || status !== 'active') return null
  if (role !== 'student') return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-800">Access denied.</div>

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

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Student Payment</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-[-0.04em] text-[#102449]">Payment</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Review your current payment and transaction history.</p>
      </header>

      {isLoading && <section className="border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">Loading current payment...</section>}
      {error && <section className="border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700"><p className="font-bold">Unable to load payment details</p><p className="mt-1">{error}</p><button type="button" onClick={() => void loadPaymentPage()} className="mt-3 font-bold underline">Retry</button></section>}

      {!isLoading && !error && !paymentDetails && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Payment</p><h2 className="mt-2 text-xl font-extrabold text-[#102449]">No enrollment found</h2><p className="mt-2 text-sm leading-6 text-slate-600">Choose a learning package before viewing payment details.</p><Link to="/student/learning" className="mt-5 inline-flex rounded-xl bg-[#102449] px-5 py-2.5 text-sm font-bold text-white">Open My Learning</Link></section>
      )}

      {!isLoading && !error && paymentDetails && !invoice && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-extrabold text-[#102449]">Invoice not available</h2><p className="mt-2 text-sm text-slate-600">Your enrollment exists, but its payment invoice is not available yet.</p></section>
      )}

      {!isLoading && !error && paymentDetails && invoice && !payment && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-extrabold text-[#102449]">Payment record not available</h2><p className="mt-2 text-sm text-slate-600">Your invoice exists, but its payment record is not available yet.</p></section>
      )}

      {!isLoading && !error && paymentDetails && invoice && payment && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Current Payment</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-[#102449]">{formatPeriod(invoice.created_at)} Payment</h2>
              <p className="mt-1 text-sm text-slate-500">Invoice {invoice.invoice_number}</p>
            </div>
            <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-extrabold ${statusClass(payment.status)}`}>{formatStatus(payment.status)}</span>
          </div>

          <div className="grid gap-6 p-5 lg:grid-cols-[1.15fr_.85fr] lg:p-7">
            <div>
              <div className="border-b border-slate-200 pb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Amount paid</p>
                <p className="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-[#102449]">Rp{payment.amount.toLocaleString('id-ID')}</p>
              </div>

              <dl className="grid gap-x-8 sm:grid-cols-2">
                {[
                  ['Invoice', invoice.invoice_number, 'invoice'],
                  ['Payment Date', formatDateTime(payment.created_at), 'calendar'],
                  ['Period', formatPeriod(invoice.created_at), 'calendar'],
                  ['Package', formatPackage(paymentDetails.enrollment.package_type), 'package'],
                  ['Payment Method', formatMethod(payment.payment_method), 'method'],
                ].map(([label, value, icon]) => (
                  <div key={label} className="border-b border-slate-100 py-4 last:border-b-0">
                    <dt className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500"><span className="text-slate-400"><Icon name={icon as 'invoice'} /></span>{label}</dt>
                    <dd className={`mt-1.5 break-words ${label === 'Invoice' ? 'text-xs font-semibold text-slate-700' : 'text-sm font-bold text-slate-950'}`}>{value}</dd>
                  </div>
                ))}
              </dl>

              {isRejected && payment.rejection_reason && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="font-bold">Payment rejected</p><p className="mt-1 leading-6">{payment.rejection_reason}</p></div>}
              {proofMessage && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{proofMessage}</div>}
              {proofError && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{proofError}</div>}
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              {isPaid && currentReceipt ? (
                <div>
                  <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon name="check" /></div>
                  <h3 className="mt-4 text-lg font-extrabold text-[#102449]">Payment complete</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">Your payment has been approved and recorded in your payment history.</p>
                  <button type="button" onClick={() => downloadReceipt(currentReceipt)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#102449] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#16345f]"><Icon name="download" />Download Receipt</button>
                </div>
              ) : isProofSubmitted ? (
                <div>
                  <div className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><span className="text-base font-bold">…</span></div>
                  <h3 className="mt-4 text-lg font-extrabold text-[#102449]">Proof submitted</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">Your {formatMethod(payment.payment_method)} payment proof is waiting for verification.</p>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Next step</p>
                  <h3 className="mt-1 text-lg font-extrabold text-[#102449]">Bank Transfer</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">Complete the payment, then upload your proof below.</p>
                  {paymentSettings && <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm"><div><span className="text-xs text-slate-500">Bank</span><p className="mt-0.5 font-bold text-slate-950">{paymentSettings.bank_name}</p></div><div><span className="text-xs text-slate-500">Account Number</span><p className="mt-0.5 font-bold text-slate-950">{paymentSettings.account_number}</p></div><div><span className="text-xs text-slate-500">Account Name</span><p className="mt-0.5 font-bold text-slate-950">{paymentSettings.account_name}</p></div></div>}
                  {isRejected && <button type="button" onClick={() => void handleRetryPayment()} disabled={isRetrying} className="mt-4 inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50">{isRetrying ? 'Creating New Payment...' : 'Pay Again'}</button>}
                  {canUploadProof && <div className="mt-5 border-t border-slate-200 pt-5">
                    <label htmlFor="student-payment-proof-input" className="block text-sm font-bold text-slate-800">Upload Payment Proof</label>
                    <input
                      id="student-payment-proof-input"
                      ref={proofInputRef}
                      type="file"
                      onChange={handleProofSelection}
                      disabled={isUploading}
                      className="sr-only"
                      aria-label="Payment proof file picker"
                    />
                    <button
                      type="button"
                      onClick={() => proofInputRef.current?.click()}
                      disabled={isUploading}
                      className="mt-2.5 inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Choose from Gallery / File
                    </button>
                    {selectedProof && <p className="mt-1.5 break-all text-[11px] font-bold text-slate-700">Selected: {selectedProof.name}</p>}
                    <p className="mt-1.5 text-[11px] text-slate-500">Images or PDF · maximum 5 MiB.</p>
                    <button type="button" onClick={() => void handleProofUpload()} disabled={!selectedProof || !!proofError || isUploading} className="mt-3 inline-flex w-full justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{isUploading ? 'Uploading...' : 'Submit Payment Proof'}</button>
                  </div>}
                </div>
              )}
            </aside>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">History</p>
          <h2 className="mt-1 text-xl font-extrabold text-[#102449]">Payment History</h2>
          <p className="mt-1 text-sm text-slate-600">Your recorded payment transactions.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-5 py-3.5 sm:px-7">Invoice</th>
                <th className="px-5 py-3.5">Payment Date</th>
                <th className="px-5 py-3.5">Period</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Payment Method</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRecords.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-5 py-4 sm:px-7"><p className="font-semibold text-slate-900">{item.invoice_number}</p></td>
                  <td className="px-5 py-4 whitespace-nowrap text-slate-700">{formatPaymentDate(item.created_at)}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-slate-700">{item.period}</td>
                  <td className="px-5 py-4 whitespace-nowrap font-bold text-slate-900">Rp{item.amount.toLocaleString('id-ID')}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-slate-700">{formatMethod(item.payment_method)}</td>
                  <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(item.status)}`}>{formatStatus(item.status)}</span></td>
                  <td className="px-5 py-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSelectedHistory(item)} className="font-bold text-blue-700 underline-offset-2 hover:underline">View</button><button type="button" onClick={() => downloadReceipt(item)} className="font-bold text-slate-700 underline-offset-2 hover:underline">Download</button></div></td>
                </tr>
              ))}
              {!pageRecords.length && <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500 sm:px-7">No payment transactions recorded.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p>Showing {showingStart}–{showingEnd} of {paymentHistory.length} transactions</p>
          <div className="flex items-center gap-1.5">
            {paginationPages.map((page) => page === 'ellipsis-left' || page === 'ellipsis-right' ? <span key={page} className="px-2">…</span> : <button key={page} type="button" onClick={() => setHistoryPage(Number(page))} className={`size-8 rounded-lg text-xs font-bold ${safePage === page ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{page}</button>)}
          </div>
        </div>
      </section>

      {selectedHistory && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Payment Details</p><h2 className="mt-1 text-xl font-extrabold text-[#102449]">{selectedHistory.invoice_number}</h2></div><button type="button" onClick={() => setSelectedHistory(null)} aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><Icon name="close" /></button></div><dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Amount</dt><dd className="font-bold text-slate-900">Rp{selectedHistory.amount.toLocaleString('id-ID')}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Status</dt><dd className="font-bold text-slate-900">{formatStatus(selectedHistory.status)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Method</dt><dd className="font-bold text-slate-900">{formatMethod(selectedHistory.payment_method)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Date</dt><dd className="font-bold text-slate-900">{formatDateTime(selectedHistory.created_at)}</dd></div></dl><button type="button" onClick={() => setSelectedHistory(null)} className="mt-6 w-full rounded-xl bg-[#102449] px-4 py-3 text-sm font-bold text-white">Close</button></div></div>}
    </div>
  )
}