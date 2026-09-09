import { useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { getMyActiveEnrollments, type StudentActiveEnrollment } from '../../services/student-active-enrollment.service'
import { useStudentAttendance } from '../../hooks/useStudentAttendance'
import { useQuery } from '@tanstack/react-query'

function Icon({ name }: { name: 'book' | 'calendar' | 'user' | 'arrow' }) {
  const common = 'size-5 fill-none stroke-current stroke-2'
  if (name === 'book') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 5.5v16M8 7h8M8 11h8" /></svg>
  if (name === 'calendar') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M8 2.5v4M16 2.5v4M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" /></svg>
  if (name === 'user') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><circle cx="12" cy="7" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
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
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-slate-600">Loading your dashboard...</p>
      </div>
    )
  }

  if (!isAuthenticated || !profile || profileError || status !== 'active') return null

  if (role !== 'student') {
    return <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-800">Access denied.</div>
  }

  const currentEnrollment = enrollmentQuery.data?.[0] ?? null
  const present = attendance.filter((item) => item.teacher_status === 'present').length
  const absent = attendance.filter((item) => item.teacher_status === 'absent').length
  const total = attendance.length
  const rate = total ? (present / total) * 100 : null
  const attendanceLabel = attendanceLoading
    ? '…'
    : attendanceError
      ? '—'
      : rate === null
        ? '—'
        : `${rate.toFixed(1)}%`

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-gradient-to-br from-white via-[#f7faff] to-[#eef5ff] px-6 py-7 shadow-sm sm:px-8 sm:py-8">
        <div className="absolute -right-10 -top-12 size-40 rounded-full bg-blue-100/70 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-blue-700">Student Portal</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[#102449] sm:text-4xl">Welcome back, {profile.full_name}.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Your QuickSpeak learning overview, kept simple and focused.</p>
          </div>
          <div className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm">Account {status}</div>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-12" aria-label="Student dashboard">
        <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm xl:col-span-7 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
              <Icon name="book" />
            </div>
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-blue-700">My Class</span>
          </div>

          {currentEnrollment ? (
            <div className="mt-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Current Level</p>
                  <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[#102449]">Level {currentEnrollment.level_number}</h2>
                  <p className="mt-1 text-base font-semibold text-blue-700">{currentEnrollment.level_name}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-[#f8fbff] px-4 py-3 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Package</p>
                  <p className="mt-1 text-sm font-extrabold text-slate-900">{formatPackage(currentEnrollment.package_type)}</p>
                </div>
              </div>

              <dl className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Teaching Group</dt>
                  <dd className="mt-2 text-sm font-bold text-slate-900">{currentEnrollment.teaching_group_name}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Teacher</dt>
                  <dd className="mt-2 text-sm font-bold text-slate-900">{currentEnrollment.teacher_code}</dd>
                </div>
              </dl>

              <Link to="/student/learning" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#102449] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#16345f]">
                Open My Learning <Icon name="arrow" />
              </Link>
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
              <p className="font-bold text-slate-900">No active class</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Your active class will appear here once it is assigned.</p>
            </div>
          )}
        </article>

        <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm xl:col-span-5 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <Icon name="calendar" />
            </div>
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">Attendance</span>
          </div>

          <div className="mt-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Attendance Rate</p>
            <div className="mt-2 flex items-end gap-3">
              <p className="text-4xl font-extrabold tracking-[-0.04em] text-[#102449]">{attendanceLabel}</p>
              {!attendanceError && rate !== null && <span className="mb-1 text-xs font-bold text-emerald-700">Overall</span>}
            </div>

            {attendanceError ? (
              <p className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm leading-6 text-rose-700">Unable to load attendance summary.</p>
            ) : (
              <dl className="mt-6 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-[#f8fbff] p-4">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Present</dt>
                  <dd className="mt-2 text-xl font-extrabold text-slate-900">{present}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Absent</dt>
                  <dd className="mt-2 text-xl font-extrabold text-slate-900">{absent}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Records</dt>
                  <dd className="mt-2 text-xl font-extrabold text-slate-900">{total}</dd>
                </div>
              </dl>
            )}

            <Link to="/student/attendance" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800">
              View Attendance History <Icon name="arrow" />
            </Link>
          </div>
        </article>

        <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm xl:col-span-12 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                <Icon name="user" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Account Status</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-extrabold tracking-[-0.03em] text-[#102449]">Your account is active.</h2>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
                    <span className="size-2 rounded-full bg-emerald-500" /> Active
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[430px]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Student</p>
                <p className="mt-2 text-sm font-bold text-slate-900">{profile.full_name}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Email</p>
                <p className="mt-2 break-all text-sm font-bold text-slate-900">{profile.email}</p>
              </div>
            </div>

            <Link to="/student/profile" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50">
              Open Profile <Icon name="arrow" />
            </Link>
          </div>
        </article>
      </section>
    </div>
  )
}
