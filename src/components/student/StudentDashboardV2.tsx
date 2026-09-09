import { useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { getMyActiveEnrollments, type StudentActiveEnrollment } from '../../services/student-active-enrollment.service'
import { useStudentAttendance } from '../../hooks/useStudentAttendance'
import { useQuery } from '@tanstack/react-query'

function Icon({ name }: { name: 'book' | 'calendar' | 'user' | 'arrow' | 'check' }) {
  const common = 'size-5 fill-none stroke-current stroke-2'
  if (name === 'book') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 5.5v16M8 7h8M8 11h8" /></svg>
  if (name === 'calendar') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M8 2.5v4M16 2.5v4M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" /></svg>
  if (name === 'user') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><circle cx="12" cy="7" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
  if (name === 'check') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="m5 12 4 4L19 6" /></svg>
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M5 12h13M13 6l6 6-6 6" /></svg>
}

function formatPackage(packageType: StudentActiveEnrollment['package_type']) {
  return packageType === 'private' ? 'Private' : 'Semi-Private'
}

export function StudentDashboardV2() {
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

  const canLoad = !authLoading
    && !profileLoading
    && isAuthenticated
    && Boolean(profile)
    && !profileError
    && role === 'student'
    && status === 'active'

  const enrollmentQuery = useQuery({
    queryKey: ['student-dashboard', 'active-enrollments'],
    queryFn: getMyActiveEnrollments,
    enabled: canLoad,
  })

  const {
    attendance,
    loading: attendanceLoading,
    error: attendanceError,
  } = useStudentAttendance(canLoad)

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

  if (authLoading || profileLoading || enrollmentQuery.isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">Loading your dashboard...</div>
  }

  if (!isAuthenticated || !profile || profileError || status !== 'active') return null

  if (role !== 'student') {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">Access denied.</div>
  }

  const currentEnrollment = enrollmentQuery.data?.[0] ?? null
  const present = attendance.filter((item) => item.teacher_status === 'present').length
  const absent = attendance.filter((item) => item.teacher_status === 'absent').length
  const total = attendance.length
  const rate = total ? (present / total) * 100 : null
  const attendanceLabel = attendanceLoading
    ? 'Loading'
    : attendanceError
      ? '—'
      : rate === null
        ? '—'
        : `${rate.toFixed(1)}%`

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Student Portal</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">Welcome back, {profile.full_name}.</p>
      </header>

      <section className="grid gap-5 lg:grid-cols-3" aria-label="Student dashboard">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Icon name="book" />
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              My Class
            </span>
          </div>

          {currentEnrollment ? (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Level {currentEnrollment.level_number}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-950">
                {currentEnrollment.level_name}
              </h2>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Package</dt>
                  <dd className="font-semibold text-slate-900">{formatPackage(currentEnrollment.package_type)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Teaching Group</dt>
                  <dd className="text-right font-semibold text-slate-900">{currentEnrollment.teaching_group_name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Teacher</dt>
                  <dd className="font-semibold text-slate-900">{currentEnrollment.teacher_code}</dd>
                </div>
              </dl>
              <Link
                to="/student/learning"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Open My Learning <Icon name="arrow" />
              </Link>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-5">
              <p className="font-semibold text-slate-900">No active class</p>
              <p className="mt-1 text-sm text-slate-600">Your active class will appear here.</p>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Icon name="calendar" />
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Attendance
            </span>
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-500">Attendance Rate</p>
            <p className="mt-1 text-4xl font-extrabold text-slate-950">{attendanceLabel}</p>

            {attendanceError ? (
              <p className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                Unable to load attendance summary.
              </p>
            ) : (
              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Present</dt>
                  <dd className="font-bold text-slate-900">{present}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Absent</dt>
                  <dd className="font-bold text-slate-900">{absent}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-slate-100 pt-3">
                  <dt className="text-slate-500">Total Records</dt>
                  <dd className="font-bold text-slate-900">{total}</dd>
                </div>
              </dl>
            )}

            <Link
              to="/student/attendance"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              View Attendance History <Icon name="arrow" />
            </Link>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Icon name="user" />
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="size-2 rounded-full bg-emerald-500" />
              Active
            </span>
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-500">Account Status</p>
            <p className="mt-1 text-3xl font-extrabold capitalize text-slate-950">{status}</p>
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">{profile.full_name}</p>
              <p className="mt-1 break-all text-sm text-slate-500">{profile.email}</p>
            </div>
            <Link
              to="/student/profile"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Open Profile <Icon name="arrow" />
            </Link>
          </div>
        </article>
      </section>
    </div>
  )
}
