import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { getPaymentRecords, type PaymentRecord } from '../../services/admin-payment-records.service'

export const Route = createFileRoute('/admin/payment-history')({ component: AdminPaymentHistoryPage })

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load payment records.'
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
}

function label(value: string) {
  return value.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function AdminPaymentHistoryPage() {
  const { isAuthenticated, loading, profileLoading, profileError, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [records, setRecords] = useState<PaymentRecord[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading || profileLoading) return
    if (!isAuthenticated || profileError || status === null) { navigate({ to: '/login' }); return }
    if (status !== 'active') navigate({ to: '/waiting' })
  }, [isAuthenticated, loading, navigate, profileError, profileLoading, status])

  const loadRecords = useCallback(async () => {
    setIsLoading(true); setError(null)
    try { setRecords(await getPaymentRecords()) } catch (loadError) { setError(getErrorMessage(loadError)) } finally { setIsLoading(false) }
  }, [])

  useEffect(() => {
    if (isAuthenticated && role === 'admin' && status === 'active') void loadRecords()
  }, [isAuthenticated, loadRecords, role, status])

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return records.filter((record) => (
      (statusFilter === 'all' || record.payment_status === statusFilter)
      && (!normalizedQuery || [record.student_name, record.student_email, record.invoice_number].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
    ))
  }, [query, records, statusFilter])

  if (loading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || profileError || status === null || status !== 'active') return null
  if (role !== 'admin') return <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800"><h2 className="text-xl font-semibold">Access denied</h2><p className="mt-2">You do not have permission to view payment records.</p></section>

  return <section>
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-3xl font-bold text-slate-900">Payment History / Records</h2><p className="mt-2 text-slate-600">All payment records, including pending and reviewed payments.</p></div><Link to="/admin/payments" className="text-sm font-medium text-slate-700 underline">Back to Payments</Link></div>
    {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" onClick={() => void loadRecords()} className="font-medium underline">Retry</button></div>}
    <div className="mt-6 flex flex-wrap gap-3"><input aria-label="Search payment records" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student or invoice" className="rounded-lg border px-3 py-2 text-sm" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="all">All statuses</option><option value="unpaid">Unpaid</option><option value="proof_submitted">Proof submitted</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
    <div className="mt-5 overflow-x-auto rounded-xl border bg-white shadow-sm"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-slate-700"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Package</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Reviewed</th></tr></thead><tbody className="divide-y divide-slate-200">{isLoading ? <tr><td colSpan={7} className="px-4 py-6 text-slate-600">Loading payment records...</td></tr> : filteredRecords.length === 0 ? <tr><td colSpan={7} className="px-4 py-6 text-slate-600">No payment records match your filters.</td></tr> : filteredRecords.map((record) => <tr key={record.payment_id}><td className="px-4 py-4"><p className="font-medium text-slate-900">{record.student_name}</p><p className="text-slate-600">{record.student_email}</p>{record.rejection_reason && <p className="mt-1 text-xs text-red-700">Reason: {record.rejection_reason}</p>}</td><td className="px-4 py-4 text-slate-700">{record.invoice_number}</td><td className="px-4 py-4 text-slate-700">{label(record.package_type)}</td><td className="px-4 py-4 text-slate-700">{formatAmount(record.amount)}</td><td className="px-4 py-4 text-slate-700">{label(record.payment_status)}</td><td className="px-4 py-4 text-slate-700">{formatDate(record.created_at)}</td><td className="px-4 py-4 text-slate-700">{formatDate(record.verified_at)}</td></tr>)}</tbody></table></div>
  </section>
}
