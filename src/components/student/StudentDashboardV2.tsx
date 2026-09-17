import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { useStudentAttendance } from '../../hooks/useStudentAttendance'
import { getMyLearningState, type StudentLearningState } from '../../services/student-learning-state.service'
import { getMyStudentLearningProgress, type StudentLearningProgressRow } from '../../services/student-learning-progress.service'

function Icon({ name }: { name: 'book' | 'calendar' | 'user' | 'wallet' | 'arrow' | 'check' }) {
  const common = 'size-5 fill-none stroke-current stroke-2'
  if (name === 'book') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 5.5v16M8 7h8M8 11h8" /></svg>
  if (name === 'calendar') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M8 2.5v4M16 2.5v4M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" /></svg>
  if (name === 'user') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><circle cx="12" cy="7" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
  if (name === 'wallet') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7" /><path d="M16 13h.01" /></svg>
  if (name === 'check') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="m5 12 4 4L19 6" /></svg>
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M5 12h13M13 6l6 6-6 6" /></svg>
}

function formatPackage(value: StudentLearningState['package_type']) {
  return value === 'private' ? 'Private' : 'Semi-Private'
}

type SummaryCardProps = {
  label: string
  value: string | number
  detail: string
  to: string
  icon: 'book' | 'calendar' | 'wallet' | 'check'
  color: string
  iconBg: string
}

function SummaryCard({ label, value, detail, to, icon, color, iconBg }: SummaryCardProps) {
  return (
    <Link
      to={to}
      className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <article>
        <div className={`flex size-10 items-center justify-center rounded-xl border border-white shadow-sm ${iconBg}`}>
          <span className={color}><Icon name={icon} /></span>
        </div>
        <p className="mt-4 text-[14px] font-bold text-slate-600">{label}</p>
        <p className="mt-1 text-[26px] font-extrabold leading-tight tracking-[-0.025em] text-[#102449]">{value}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
      </article>
    </Link>
  )
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
    getMyLearningState()
      .then((nextState) => { if (!cancelled) setLearningState(nextState) })
      .catch(() => { if (!cancelled) setLearningStateError(true) })
      .finally(() => { if (!cancelled) setLearningStateLoading(false) })
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
  const nextChapter = currentLevelRows.find((row) => !row.completed_at) ?? null
  const currentLearningValue = learningStateError ? 'Unavailable' : learningState?.level_name ?? '—'
  const currentLearningDetail = learningStateError
    ? 'Unable to load learning status'
    : learningState
      ? `${formatPackage(learningState.package_type)} · ${assigned ? (learningState.teaching_group_name ?? 'Class not assigned') : 'Class not assigned'}`
      : 'No learning package yet'
  const attendanceValue = attendanceLoading ? '…' : attendanceError ? '—%' : rate === null ? '—%' : `${rate.toFixed(0)}%`
  const attendanceDetail = attendanceLoading ? 'Loading records' : attendanceError ? 'Unable to load records' : `${total} attendance record${total === 1 ? '' : 's'} · ${absent} absent`
  const progressValue = `${currentCompletedRows.length}/${currentLevelRows.length}`
  const progressDetail = progressLoading ? 'Loading progress' : `${currentProgressPercent}% completed`

  return (
    <div className="space-y-6 pb-2">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Student Dashboard</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-[-0.03em] text-[#102449] sm:text-[30px]">Welcome back, {profile.full_name}.</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Here is your current learning overview and attendance status.</p>
        </div>
        <Link to="/student/profile" className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]"><span className="flex size-7 items-center justify-center rounded-md bg-slate-100 text-slate-600"><Icon name="user" /></span><span>Profile</span></Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Student dashboard summary">
        <SummaryCard label="Current Learning" value={currentLearningValue} detail={currentLearningDetail} to="/student/learning" icon="book" color="text-blue-700" iconBg="bg-blue-50" />
        <SummaryCard label="Attendance" value={attendanceValue} detail={attendanceDetail} to="/student/attendance" icon="calendar" color="text-emerald-700" iconBg="bg-emerald-50" />
        <SummaryCard label="Learning Progress" value={progressValue} detail={progressDetail} to="/student/learning" icon="book" color="text-violet-700" iconBg="bg-violet-50" />
        <SummaryCard label="Payment" value="Open" detail="View payment details" to="/student-payment" icon="wallet" color="text-amber-800" iconBg="bg-amber-50" />
      </section>

      <section className="student-progress-surface rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="student-learning-progress-title">
        <div className="student-progress-header flex flex-col gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Learning Progress</p><h2 id="student-learning-progress-title" className="mt-1 text-xl font-bold tracking-[-0.015em] text-[#102449]">Your chapter progress</h2></div>
          <Link to="/student/learning" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800">View details <Icon name="arrow" /></Link>
        </div>
        <div className="student-progress-summary px-6 py-5 sm:px-7 sm:py-6">
          {progressLoading ? (
            <div className="space-y-3"><div className="h-4 w-40 animate-pulse rounded bg-slate-100" /><div className="h-3 w-full animate-pulse rounded bg-slate-100" /><div className="h-14 w-full animate-pulse rounded-xl bg-slate-50" /></div>
          ) : progressError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="text-sm font-bold text-rose-800">Unable to load your learning progress.</p><p className="mt-1 text-sm text-rose-700">Open My Learning to retry.</p></div>
          ) : !learningState ? (
            <p className="text-sm leading-6 text-slate-600">Your chapter progress will appear after you start a learning stage.</p>
          ) : (
            <div>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">
                <div><p className="text-sm font-semibold text-slate-500">Level {learningState.level_number}</p><p className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#102449]">{currentCompletedRows.length} of {currentLevelRows.length} chapters completed</p></div>
                <div className="lg:text-right"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Progress</p><p className="mt-1 text-xl font-extrabold text-blue-700">{currentProgressPercent}%</p></div>
              </div>
              <div className="student-progress-bar mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="student-progress-fill h-full rounded-full transition-all" style={{ width: `${currentProgressPercent}%` }} /></div>

              {latestAchievement && <div className="mt-5 flex items-start justify-between gap-4 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3.5"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Latest achievement</p><p className="mt-1.5 text-sm font-bold text-emerald-800">✓ Chapter {latestAchievement.chapter_number} — {latestAchievement.chapter_title}</p></div></div>}

              <div className="student-next-step mt-5 flex flex-col gap-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">Next step</p><p className="mt-1 text-base font-extrabold text-[#102449]">{completed ? 'Ready for the next learning stage' : nextChapter ? `Continue Chapter ${nextChapter.chapter_number} — ${nextChapter.chapter_title}` : 'Continue your learning'}</p><p className="mt-1 text-sm leading-6 text-slate-600">{completed ? 'Your current stage is complete.' : 'Open My Learning to continue from your current stage.'}</p></div>
                <Link to="/student/learning" className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg bg-[#102449] px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#17325f] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]">{completed ? 'Continue to Next Stage' : 'Continue Learning'} <Icon name="arrow" /></Link>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
                <button type="button" onClick={() => setChaptersExpanded((current) => !current)} aria-expanded={chaptersExpanded} className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-white sm:px-5">
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Current level chapters</p><p className="mt-1 text-sm font-bold text-[#102449]">{currentLevelRows.length} chapters · {currentCompletedRows.length} completed</p></div>
                  <span className="flex shrink-0 items-center gap-2 text-sm font-bold text-blue-700">{chaptersExpanded ? 'Collapse' : 'View chapters'}<span className={`text-lg transition-transform ${chaptersExpanded ? 'rotate-180' : ''}`} aria-hidden="true">⌄</span></span>
                </button>
                {chaptersExpanded && <div className="border-t border-slate-200 bg-white p-3 sm:p-4"><div className="max-h-[250px] overflow-y-auto pr-1"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{currentLevelRows.map((row) => { const isNextChapter = nextChapter?.chapter_id === row.chapter_id; const stateClass = row.completed_at ? 'border-emerald-100 bg-emerald-50/60' : isNextChapter ? 'border-blue-200 bg-blue-50/70 shadow-sm' : 'border-slate-200 bg-slate-50/60'; const stateTextClass = row.completed_at ? 'text-emerald-700' : isNextChapter ? 'text-blue-700' : 'text-slate-500'; const stateLabel = row.completed_at ? '✓ Completed' : isNextChapter ? '→ Next up' : '○ Upcoming'; return <div key={row.chapter_id} className={`rounded-xl border px-3.5 py-3 ${stateClass}`}><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Chapter {row.chapter_number}</p><p className="mt-1 text-sm font-bold text-[#102449]">{row.chapter_title}</p><p className={`mt-1 text-xs font-bold ${stateTextClass}`}>{stateLabel}</p></div> })}</div></div></div>}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="student-account-strip" aria-labelledby="account-status-title">
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5"><span className="flex size-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><Icon name="check" /></span><span><strong>Account active.</strong> You can access your learning area.</span></div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-slate-500"><span><strong className="font-bold">{profile.full_name}</strong></span><span className="truncate">{profile.email}</span></div>
        </div>
      </section>
    </div>
  )
}
