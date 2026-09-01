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
}

function SummaryCard({ label, value, detail }: SummaryCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      {detail && <p className="mt-2 text-sm text-slate-500">{detail}</p>}
    </article>
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
              <SummaryCard label="Total Students" value={summary.totalStudents} />
              <SummaryCard label="Active Students" value={summary.activeStudents} />
              <SummaryCard label="Waiting Students" value={summary.waitingStudents} />
            </div>
          </section>

          <section className="mt-8">
            <h3 className="text-lg font-semibold text-slate-900">Teachers</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryCard label="Total Teachers" value={summary.totalTeachers} />
              <SummaryCard label="Active Teachers" value={summary.activeTeachers} />
              <SummaryCard label="Waiting Teachers" value={summary.waitingTeachers} />
            </div>
          </section>

          <section className="mt-8 grid gap-4 lg:grid-cols-3">
            <SummaryCard label="Active Teaching Groups" value={summary.activeTeachingGroups} />
            <SummaryCard
              label="Enrollments"
              value={summary.approvedEnrollmentsAwaitingAssignment}
              detail={`${summary.pendingPaymentVerifications} payment proof${summary.pendingPaymentVerifications === 1 ? '' : 's'} awaiting verification`}
            />
            <SummaryCard
              label="Outstanding Teacher Fees"
              value={formatAmount(dashboard.outstandingTeacherFees)}
              detail={`${dashboard.unpaidTeacherPeriods} unpaid teacher period${dashboard.unpaidTeacherPeriods === 1 ? '' : 's'} this month`}
            />
          </section>
        </>
      )}

      <section className="mt-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-slate-900">Waiting Actions</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/admin" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Waiting Students · View</Link>
          <Link to="/admin/waiting-teachers" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Waiting Teachers · View</Link>
          <Link to="/admin/teacher-fees" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Teacher Fees · View</Link>
          <Link to="/admin/teaching-groups" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Teaching Groups · View</Link>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-slate-900">Quick Actions</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/admin" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Student Management</Link>
          <Link to="/admin/waiting-teachers" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Waiting Teachers</Link>
          <Link to="/admin/teaching-groups" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Teaching Groups</Link>
          <Link to="/admin/teacher-fees" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Teacher Fees</Link>
          <Link to="/admin/attendance-reports" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Attendance Reports</Link>
        </div>
      </section>
    </section>
  )
}
