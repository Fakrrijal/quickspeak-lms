import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/payments')({ component: AdminPaymentsPage })

function AdminPaymentsPage() {
  return <section><h2 className="text-3xl font-bold text-slate-900">Payments</h2><p className="mt-2 text-slate-600">Manage payment settings, verification, and records.</p><div className="mt-8 grid gap-4 md:grid-cols-3"><Link to="/admin/payment-settings" className="rounded-xl border bg-white p-5 shadow-sm hover:border-slate-400"><h3 className="font-semibold">Payment Settings</h3><p className="mt-2 text-sm text-slate-600">Bank details and registration fees.</p></Link><Link to="/admin/payment-verification" className="rounded-xl border bg-white p-5 shadow-sm hover:border-slate-400"><h3 className="font-semibold">Payment Verification</h3><p className="mt-2 text-sm text-slate-600">Review pending payment proofs.</p></Link><Link to="/admin/payment-history" className="rounded-xl border bg-white p-5 shadow-sm hover:border-slate-400"><h3 className="font-semibold">Payment History / Records</h3><p className="mt-2 text-sm text-slate-600">Searchable records for every payment status.</p></Link></div></section>
}
