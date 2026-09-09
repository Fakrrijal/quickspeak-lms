import { useEffect, useMemo } from 'react'
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
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const canLoad = !authLoading && !profileLoading && isAuthenticated && Boolean(profile) && !profileError && role === 'student' && status === 'active'
  const enrollmentQuery = useQuery({
    queryKey: ['student-dashboard', 'active-enrollments'],
    queryFn: getMyActiveEnrollments,
    enabled: canLoad,
  })
  const { attendance, loading: attendanceLoading, error: attendanceError } = useStudentAttendance(canLoad)

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || !profile || profileError || status === null) {
      navigate({ to: '/login', replace: true })
      return
    }
    if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  const currentEnrollment = enrollmentQuery.data?.[0] ?? null
  const present = attendance.filter((item) => item.teacher_status === 'present').length
  const absent = attendance.filter((item) => item.teacher_status === 'absent').length
  const total = attendance.length
  const rate = total ? (present / total) * 100 : null
  const attendanceLabel = attendanceLoading ? 'Loading' : attendanceError ? '—' : rate === null ? '—' : `${rate.toFixed(1)}%`
  const initials = useMemo(
    () => profile?.full_name?.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '?',
    [profile?.full_name],
  )

  if (authLoading || profileLoading || enrollmentQuery.isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">Loading your dashboard...</div>
  }
  if (!isAuthenticated || !profile || profileError || status !== 'active') return null
  if (role !== 'student') return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">Access denied.</div>

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-white via-blue-50 to-sky-100 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">Welcome back</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Good morning, {profile.full_name}!</h1>
            <p className="mt-3 max-w-2xl text-base text-slate-600">A focused overview of your QuickSpeak learning account.</p>
            <div className="mt-4 h-1 w-16 rounded-full bg-amber-400" />
          </div>
          <div className="hidden rounded-2xl border border-white/80 bg-white/70 px-6 py-5 text-right shadow-sm sm:block">
            <p className="text-sm font-semibold text-slate-700">Speak · Learn · Grow</p>
            <p className="mt-1 text-sm text-slate-500">Be brighter through English.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Dashboard summary">
        <Link to="/student/learning" className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Icon name="book" /></span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Open</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-600">My Class</p>
          <p className="mt-1 text-3xl font-extrabold text-slate-950">{currentEnrollment ? '1' : '0'}</p>
          <div className="mt-3 flex items-center justify-between text-sm text-slate-500"><span>{currentEnrollment ? 'Active class' : 'No active class'}</span><Icon name="arrow" /></div>
        </Link>

        <Link to="/student/attendance" className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><Icon name="calendar" /></span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">History</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-600">Attendance</p>
          <p className="mt-1 text-3xl font-extrabold text-slate-950">{attendanceLabel}</p>
          <div className="mt-3 flex items-center justify-between text-sm text-slate-500"><span>{total ? `${present} present · ${absent} absent` : 'No records yet'}</span><Icon name="arrow" /></div>
        </Link>

        <Link to="/student/profile" className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500">
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Icon name="user" /></span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{status === 'active' ? 'Active' : status}</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-600">Account Status</p>
          <p className="mt-1 text-3xl font-extrabold capitalize text-slate-950">{status}</p>
          <div className="mt-3 flex items-center justify-between text-sm text-slate-500"><span>Manage your profile</span><Icon name="arrow" /></div>
        </Link>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-3"><span className="text-blue-600"><Icon name="book" /></span><h2 className="text-xl font-bold text-slate-950">My Class</h2></div>
            <Link to="/student/learning" className="text-sm font-semibold text-blue-600 hover:text-blue-700">View My Learning →</Link>
          </div>
          <div className="p-6">
            {currentEnrollment ? (
              <div className="rounded-2xl bg-slate-50 p-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Level {currentEnrollment.level_number}</span>
                    <h3 className="mt-3 text-2xl font-extrabold text-slate-950">{currentEnrollment.level_name}</h3>
                    <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                      <div><dt className="font-semibold text-slate-800">Package</dt><dd>{formatPackage(currentEnrollment.package_type)}</dd></div>
                      <div><dt className="font-semibold text-slate-800">Teaching Group</dt><dd>{currentEnrollment.teaching_group_name}</dd></div>
                      <div><dt className="font-semibold text-slate-800">Teacher</dt><dd>{currentEnrollment.teacher_code}</dd></div>
                      <div><dt className="font-semibold text-slate-800">Enrollment</dt><dd>{currentEnrollment.enrollment_status}</dd></div>
                    </dl>
                  </div>
                  <Link to="/student/learning" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Go to My Learning</Link>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                <p className="font-semibold text-slate-900">No active class</p>
                <p className="mt-1 text-sm text-slate-600">Open My Learning to view available enrollment options.</p>
                <Link to="/student/learning" className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Open My Learning</Link>
              </div>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-3"><span className="text-emerald-600"><Icon name="calendar" /></span><h2 className="text-xl font-bold text-slate-950">Attendance</h2></div>
            <Link to="/student/attendance" className="text-sm font-semibold text-blue-600 hover:text-blue-700">View History →</Link>
          </div>
          <div className="p-6">
            {attendanceError ? (
              <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">Unable to load attendance summary.</p>
            ) : (
              <div>
                <div className="flex items-center gap-6">
                  <div className="relative flex size-32 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(rgb(34 197 94) ${rate ?? 0}%, rgb(226 232 240) 0)` }}>
                    <div className="flex size-24 items-center justify-center rounded-full bg-white text-2xl font-extrabold text-slate-950">{attendanceLabel}</div>
                  </div>
                  <dl className="min-w-0 flex-1 space-y-3 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Present</dt><dd className="font-bold text-slate-900">{present}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Absent</dt><dd className="font-bold text-slate-900">{absent}</dd></div>
                    <div className="flex justify-between gap-4 border-t border-slate-100 pt-3"><dt className="text-slate-500">Total Records</dt><dd className="font-bold text-slate-900">{total}</dd></div>
                  </dl>
                </div>
                <div className="mt-5 flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"><span className="mt-0.5"><Icon name="check" /></span><p>Attendance history is available in the dedicated Attendance page.</p></div>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3"><span className="text-blue-600"><Icon name="user" /></span><h2 className="text-xl font-bold text-slate-950">Account Status</h2></div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700"><span className="size-2 rounded-full bg-emerald-500" />{status}</span>
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><Icon name="check" /></span>
            <div><h3 className="text-lg font-bold text-slate-950">Your account is active</h3><p className="mt-1 text-sm leading-6 text-slate-600">You can access your QuickSpeak learning area and manage your profile.</p></div>
          </div>
          <div className="rounded-xl bg-slate-50 px-5 py-4 text-sm"><p className="font-semibold text-slate-800">{initials}</p><p className="mt-1 text-slate-500">{profile.email}</p></div>
        </div>
      </section>
    </div>
  )
}
