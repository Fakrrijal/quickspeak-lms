import { useEffect } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAdminDashboard } from '../../hooks/useAdminDashboard'
import { useAuthContext } from '../../providers/AuthProvider'

export const Route = createFileRoute('/admin/dashboard')({
  component: AdminDashboardPage,
})

function formatAmount(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}

type SummaryCardProps = {
  label: string
  value: string | number
  detail?: string
  to: string
}

function SummaryCard({ label, value, detail, to }: SummaryCardProps) {
  return (
    <Link
      to={to}
      className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <article>
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        {detail && <p className="mt-2 text-sm text-slate-500">{detail}</p>}
      </article>
    </Link>
  )
}

function AdminDashboardPage() {
  const { isAuthenticated, loading, profileLoading, profileError, role, status } = useAuthContext()
  const navigate = useNavigate()
  const canViewDashboard = isAuthenticated && role === 'admin' && status === 'active'
  const dashboard = useAdminDashboard(canViewDashboard)

  useEffect(() => {
    if (loading || profileLoading) return
    if (!isAuthenticated || profileError || status === null) {
      navigate({ to: '/login', replace: true })
    } else if (status !== 'active') {
      navigate({ to: '/waiting', replace: true })
    }
  }, [isAuthenticated, loading, navigate, profileError, profileLoading, status])

  if (loading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || profileError || status === null || status !== 'active') return null
  if (role !== 'admin') return <p>Access denied.</p>

  const summary = dashboard.summary

  return (
    <section>
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Admin Dashboard</h2>
        <p className="mt-2 text-slate-600">Operational overview for QuickSpeak.</p>
      </div>

      {dashboard.error && (
        <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{dashboard.error}</p>
      )}

      {dashboard.isLoading ? (
        <p className="mt-6 text-sm text-slate-600">Loading dashboard summary...</p>
      ) : summary && (
        <>
          <section className="mt-8">
            <h3 className="text-lg font-semibold text-slate-900">Students</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryCard label="Total Students" value={summary.totalStudents} to="/admin" />
              <SummaryCard label="Active Students" value={summary.activeStudents} to="/admin" />
              <SummaryCard label="Waiting Students" value={summary.waitingStudents} to="/admin" />
            </div>
          </section>

          <section className="mt-8">
            <h3 className="text-lg font-semibold text-slate-900">Teachers</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryCard label="Total Teachers" value={summary.totalTeachers} to="/admin/teachers" />
              <SummaryCard label="Active Teachers" value={summary.activeTeachers} to="/admin/teachers" />
              <SummaryCard label="Waiting Teachers" value={summary.waitingTeachers} to="/admin/waiting-teachers" />
            </div>
          </section>

          <section className="mt-8 grid gap-4 lg:grid-cols-3">
            <SummaryCard label="Active Teaching Groups" value={summary.activeTeachingGroups} to="/admin/teaching-groups" />
            <SummaryCard
              label="Enrollments"
              value={summary.approvedEnrollmentsAwaitingAssignment}
              detail={`${summary.pendingPaymentVerifications} payment proof${summary.pendingPaymentVerifications === 1 ? '' : 's'} awaiting verification`}
              to="/admin/approved-enrollments"
            />
            <SummaryCard
              label="Outstanding Teacher Fees"
              value={formatAmount(dashboard.outstandingTeacherFees)}
              detail={`${dashboard.unpaidTeacherPeriods} unpaid teacher period${dashboard.unpaidTeacherPeriods === 1 ? '' : 's'} this month`}
              to="/admin/teacher-fees"
            />
          </section>
        </>
      )}
    </section>
  )
}
