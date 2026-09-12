import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { useStudentAttendance } from '../../hooks/useStudentAttendance'
import { getMyLearningState, type StudentLearningState } from '../../services/student-learning-state.service'
import { getMyStudentLearningProgress, type StudentLearningProgressRow } from '../../services/student-learning-progress.service'

function Icon({ name }: { name: 'book' | 'calendar' | 'user' | 'arrow' | 'check' | 'help' | 'mail' | 'whatsapp' }) {
  const common = 'size-5 fill-none stroke-current stroke-2'
  if (name === 'book') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 5.5v16M8 7h8M8 11h8" /></svg>
  if (name === 'calendar') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M8 2.5v4M16 2.5v4M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" /></svg>
  if (name === 'user') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><circle cx="12" cy="7" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
  if (name === 'check') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="m5 12 4 4L19 6" /></svg>
  if (name === 'help') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><circle cx="12" cy="12" r="9" /><path d="M9.75 9a2.35 2.35 0 1 1 3.62 1.98c-.9.55-1.37 1-1.37 2.02M12 16.8h.01" /></svg>
  if (name === 'mail') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="m4.5 7 7.5 6 7.5-6" /></svg>
  if (name === 'whatsapp') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M20 11.6a8.1 8.1 0 0 1-12 7l-4 1.1 1.1-3.9a8.1 8.1 0 1 1 14.9-4.2Z" /><path d="M8.5 8.2c.2-.4.4-.4.7.4l.7 1.7c.1.2.1.4 0 .5l.6.7c.5 1 1.2 1.7 2.2 2.2l.7-.6c.2-.1.4-.1.6 0l1.6.8c.3.1.4.3.3.6-.2.8-.9 1.3-1.7 1.3-1.1 0-2.5-.6-3.8-1.8-1.1-1-2.1-2.3-2.4-3.3-.3-.8-.2-1.6.2-2.1Z" /></svg>
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M5 12h13M13 6l6 6-6 6" /></svg>
}

function formatPackage(value: StudentLearningState['package_type']) {
  return value === 'private' ? 'Private' : 'Semi-Private'
}

export function StudentDashboardV2() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [learningState, setLearningState] = useState<StudentLearningState | null>(null)
  const [learningStateLoading, setLearningStateLoading] = useState(true)
  const [learningStateError, setLearningStateError] = useState(false)
  const [progressRows, setProgressRows] = useState<StudentLearningProgressRow[]>([])
  const [progressLoading, setProgressLoading] = useState(true)
  const [progressError, setProgressError] = useState(false)
  const [chaptersExpanded, setChaptersExpanded] = useState(false)
  const canLoad = !authLoading && !profileLoading && isAuthenticated && Boolean(profile) && !profileError && role === 'student' && status === 'active'
  const { attendance, loading: attendanceLoading, error: attendanceError } = useStudentAttendance(canLoad)

  useEffect(() => {
    if (!canLoad) return
    let cancelled = false
    setLearningStateLoading(true)
    setLearningStateError(false)
    getMyLearningState().then((nextState) => { if (!cancelled) setLearningState(nextState) }).catch(() => { if (!cancelled) setLearningStateError(true) }).finally(() => { if (!cancelled) setLearningStateLoading(false) })
    return () => { cancelled = true }
  }, [canLoad])

  useEffect(() => {
    if (!canLoad) return
    let cancelled = false
    setProgressLoading(true)
    setProgressError(false)
    getMyStudentLearningProgress()
      .then((rows) => { if (!cancelled) setProgressRows(rows) })
      .catch(() => { if (!cancelled) setProgressError(true) })
      .finally(() => { if (!cancelled) setProgressLoading(false) })
    return () => { cancelled = true }
  }, [canLoad])

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || !profile || profileError || status === null) { navigate({ to: '/login', replace: true }); return }
    if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  if (authLoading || profileLoading || learningStateLoading) {
    return <div className="border border-slate-200 bg-white p-6 shadow-sm rounded-2xl"><div className="h-2.5 w-28 animate-pulse rounded-full bg-slate-200" /><div className="mt-4 h-8 w-72 max-w-full animate-pulse rounded-lg bg-slate-100" /><div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded-full bg-slate-100" /></div>
  }
  if (!isAuthenticated || !profile || profileError || status !== 'active') return null
  if (role !== 'student') return <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-base font-medium text-rose-800">Access denied.</div>

  const completed = Boolean(learningState && (learningState.enrollment_status === 'completed' || learningState.completed_at || learningState.completed_sessions >= learningState.session_limit))
  const assigned = Boolean(learningState?.teaching_group_id && learningState?.teacher_id)
  const present = attendance.filter((item) => item.teacher_status === 'present').length
  const absent = attendance.filter((item) => item.teacher_status === 'absent').length
  const total = attendance.length
  const rate = total ? (present / total) * 100 : null
  const currentLevelRows = learningState ? progressRows.filter((row) => row.level_number === learningState.level_number && row.chapter_id) : []
  const currentCompletedRows = currentLevelRows.filter((row) => row.completed_at)
  const currentProgressPercent = currentLevelRows.length ? Math.round((currentCompletedRows.length / currentLevelRows.length) * 100) : 0
  const latestAchievement = progressRows
    .filter((row) => row.completed_at && row.chapter_id)
    .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))[0] ?? null

  return (
    <div className="space-y-6 pb-2">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Student Dashboard</p><h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-[-0.03em] text-[#102449] sm:text-[30px]">Welcome back, {profile.full_name}.</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Here is your current learning overview and attendance status.</p></div>
        <Link to="/student/profile" className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]"><span className="flex size-7 items-center justify-center rounded-md bg-slate-100 text-slate-600"><Icon name="user" /></span><span>Profile</span></Link>
      </header>

      <main className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.95fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="current-learning-title">
          <div className="border-b border-slate-200 px-6 py-4 sm:px-7 sm:py-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3.5"><div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Icon name="book" /></div><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">My Class</p><h2 id="current-learning-title" className="mt-1 text-xl font-bold tracking-[-0.015em] text-[#102449] sm:text-[21px]">Current learning stage</h2></div></div><Link to="/student/learning" className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-bold text-blue-700 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]">View details <Icon name="arrow" /></Link></div></div>
          <div className="px-6 py-5 sm:px-7 sm:py-6">
            {learningStateError ? <div className="border border-rose-200 bg-rose-50 p-5 rounded-xl"><p className="text-sm font-bold text-rose-800">Unable to load your learning status.</p><p className="mt-1 text-sm leading-6 text-rose-700">Please open My Learning and try again.</p></div> : learningState ? <div>
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-slate-500">Level {learningState.level_number}</p><h3 className="mt-1 text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-[#102449]">{learningState.level_name}</h3><p className="mt-2 text-base font-bold text-blue-700">{formatPackage(learningState.package_type)}</p></div><span className={`inline-flex w-fit items-center rounded-md px-2.5 py-1.5 text-sm font-bold ${completed ? 'bg-emerald-50 text-emerald-700' : assigned ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'}`}>{completed ? 'Stage completed' : assigned ? 'Active learning' : 'Waiting for class assignment'}</span></div>
              <div className="grid border-b border-slate-200 sm:grid-cols-2"><div className="border-b border-slate-200 py-4 sm:border-b-0 sm:border-r sm:pr-6"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Teaching Group</p><p className="mt-1.5 text-base font-bold text-slate-900">{learningState.teaching_group_name ?? 'Not assigned yet'}</p></div><div className="py-4 sm:pl-6"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Teacher</p><p className="mt-1.5 text-base font-bold text-slate-900">{learningState.teacher_code ?? 'Not assigned yet'}</p></div></div>
              {!assigned && !completed && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"><p className="text-sm leading-6 text-amber-900">Payment approved. Your teaching group and teacher will appear here after administrator assignment.</p></div>}
              {completed && <Link to="/student/learning" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#102449] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]">Continue to Next Stage <Icon name="arrow" /></Link>}
            </div> : <div className="border border-dashed border-slate-300 bg-slate-50 p-5 rounded-xl"><p className="text-base font-bold text-slate-900">No learning package yet</p><p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">Choose a learning package to start your first learning stage.</p><Link to="/student/learning" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#102449] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]">Choose Learning Package <Icon name="arrow" /></Link></div>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="attendance-title">
          <div className="border-b border-slate-200 px-6 py-4 sm:px-7 sm:py-5"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3.5"><div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Icon name="calendar" /></div><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Attendance</p><h2 id="attendance-title" className="mt-1 text-xl font-bold tracking-[-0.015em] text-[#102449]">Attendance summary</h2></div></div><Link to="/student/attendance" className="whitespace-nowrap text-sm font-bold text-blue-700 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]">View all</Link></div></div>
          <div className="px-6 py-5 sm:px-7 sm:py-6"><div className="flex items-end justify-between gap-5 border-b border-slate-200 pb-5"><div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Overall rate</p><p className="mt-2 text-3xl font-extrabold leading-none tracking-[-0.04em] text-[#102449]">{attendanceLoading ? '…' : attendanceError ? '—%' : rate === null ? '—%' : `${rate.toFixed(0)}%`}</p></div><div className="relative flex size-16 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(rgb(16 185 129) ${rate ?? 0}%, rgb(226 232 240) 0)` }}><div className="flex size-12 items-center justify-center rounded-full bg-white"><span className="text-[10px] font-bold text-slate-500">{attendanceLoading ? '…' : attendanceError ? '—' : rate === null ? '—' : `${rate.toFixed(0)}%`}</span></div></div></div><dl className="grid grid-cols-3 divide-x divide-slate-200 pt-4"><div className="pr-3"><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Present</dt><dd className="mt-1.5 text-xl font-extrabold text-slate-900">{present}</dd></div><div className="px-3"><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Absent</dt><dd className="mt-1.5 text-xl font-extrabold text-slate-900">{absent}</dd></div><div className="pl-3"><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Records</dt><dd className="mt-1.5 text-xl font-extrabold text-slate-900">{total}</dd></div></dl><div className="mt-4 border-t border-slate-200 pt-3"><p className="text-sm leading-6 text-slate-600">Keep your attendance consistent to support your learning progress.</p></div></div>
        </section>
      </main>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="student-learning-progress-title">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Learning Progress</p>
            <h2 id="student-learning-progress-title" className="mt-1 text-xl font-bold tracking-[-0.015em] text-[#102449]">Your chapter progress</h2>
          </div>
          <Link to="/student/learning" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800">View details <Icon name="arrow" /></Link>
        </div>
        <div className="px-6 py-5 sm:px-7 sm:py-6">
          {progressLoading ? (
            <div className="space-y-3"><div className="h-4 w-40 animate-pulse rounded bg-slate-100" /><div className="h-3 w-full animate-pulse rounded bg-slate-100" /><div className="h-14 w-full animate-pulse rounded-xl bg-slate-50" /></div>
          ) : progressError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="text-sm font-bold text-rose-800">Unable to load your learning progress.</p><p className="mt-1 text-sm text-rose-700">Open My Learning to retry.</p></div>
          ) : !learningState ? (
            <p className="text-sm leading-6 text-slate-600">Your chapter progress will appear after you start a learning stage.</p>
          ) : (
            <div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Level {learningState.level_number} — {learningState.level_name}</p>
                  <p className="mt-1 text-lg font-extrabold text-[#102449]">{currentCompletedRows.length} / {currentLevelRows.length} chapters completed</p>
                </div>
                <p className="text-sm font-extrabold text-blue-700">{currentProgressPercent}%</p>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${currentProgressPercent}%` }} /></div>
              {latestAchievement && <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3.5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Latest achievement</p><p className="mt-1.5 text-sm font-bold text-emerald-800">✓ Chapter {latestAchievement.chapter_number} — {latestAchievement.chapter_title}</p></div>}

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/40">
                <button
                  type="button"
                  onClick={() => setChaptersExpanded((current) => !current)}
                  aria-expanded={chaptersExpanded}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-white sm:px-5"
                >
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Current Level Chapters</p>
                    <p className="mt-1 text-sm font-bold text-[#102449]">{currentLevelRows.length} chapters · {currentCompletedRows.length} completed</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2 text-sm font-bold text-blue-700">
                    {chaptersExpanded ? 'Collapse' : 'View chapters'}
                    <span className={`text-lg transition-transform ${chaptersExpanded ? 'rotate-180' : ''}`} aria-hidden="true">⌄</span>
                  </span>
                </button>

                {chaptersExpanded && (
                  <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
                    <div className="max-h-[250px] overflow-y-auto pr-1">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {currentLevelRows.map((row) => (
                          <div key={row.chapter_id} className={`rounded-xl border px-3.5 py-3 ${row.completed_at ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/60'}`}>
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Chapter {row.chapter_number}</p>
                            <p className="mt-1 text-sm font-bold text-[#102449]">{row.chapter_title}</p>
                            <p className={`mt-1 text-xs font-bold ${row.completed_at ? 'text-emerald-700' : 'text-slate-500'}`}>{row.completed_at ? '✓ Completed' : 'Not completed yet'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="account-support-title">
        <div className="grid gap-0 px-6 py-5 sm:px-7 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.85fr)_minmax(0,1fr)] xl:items-center">
          <div className="flex items-start gap-3.5 pb-5 xl:pb-0"><div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Icon name="check" /></div><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Account Status</p><h2 id="account-support-title" className="mt-1 text-lg font-bold tracking-[-0.015em] text-[#102449]">Your account is active</h2><p className="mt-1 max-w-md text-sm leading-6 text-slate-600">You can access your learning area and continue your current stage.</p></div></div>
          <div className="border-t border-slate-200 pt-4 xl:border-l xl:border-t-0 xl:px-6 xl:py-1"><div><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">Student</p><p className="mt-1.5 truncate text-sm font-bold text-slate-900">{profile.full_name}</p></div><div className="mt-3"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">Email</p><p className="mt-1.5 truncate text-sm font-bold text-slate-900">{profile.email}</p></div></div>
          <div className="border-t border-slate-200 pt-4 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-1"><div className="flex items-center gap-2"><div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Icon name="help" /></div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Need help?</p></div><p className="mt-1.5 text-base font-bold text-[#102449]">Contact QuickSpeak Admin</p><p className="mt-1 text-sm leading-5 text-slate-600">Learning, payment, or account questions.</p><div className="mt-3 grid grid-cols-2 gap-2"><a href="mailto:quicspeaklms@gmail.com" className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]"><span aria-hidden="true">✉</span> Email Admin</a><a href="https://wa.me/6282138138564?text=Halo%20QuickSpeak%20Admin%2C%20saya%20membutuhkan%20bantuan%20terkait%20student%20portal." target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#102449] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#17325f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]"><span aria-hidden="true">◉</span> WhatsApp Admin</a></div></div>
        </div>
      </section>
    </div>
  )
}
