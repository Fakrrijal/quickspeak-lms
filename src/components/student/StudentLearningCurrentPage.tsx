import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '../../lib/supabase'
import { useAuthContext } from '../../providers/AuthProvider'
import { getMyLearningState, type StudentLearningState } from '../../services/student-learning-state.service'
import { getMyStudentLearningProgress, type StudentLearningProgressRow } from '../../services/student-learning-progress.service'
import { getStudentLevelPackageStatus, requestCurrentLevelPackageRenewal, requestNextLevelEnrollmentFromResult, type StudentLevelPackageStatus } from '../../services/level-completion.service'
import { StudentAssessmentPage } from './StudentAssessmentPage'
import { StudentBooksPage } from './StudentBooksPage'
import { StudentHistoryPage } from './StudentHistoryPage'

function formatPackage(value: StudentLearningState['package_type']) { return value === 'private' ? 'Private' : 'Semi-Private' }
function rupiah(value: number | null | undefined) { return value == null ? '—' : `Rp${value.toLocaleString('id-ID')}` }

export function StudentLearningCurrentPage() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [state, setState] = useState<StudentLearningState | null>(null)
  const [packageStatus, setPackageStatus] = useState<StudentLevelPackageStatus | null>(null)
  const [rows, setRows] = useState<StudentLearningProgressRow[]>([])
  const [loading, setLoading] = useState(true)
  const [progressLoading, setProgressLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<'renew' | 'next' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [payment, setPayment] = useState<{ invoice_number: string; payment_amount: number } | null>(null)
  const view = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('view') : null
  const currentRows = useMemo(() => state ? rows.filter((row) => row.level_number === state.level_number && row.chapter_id) : [], [rows, state])

  const canLoad = !authLoading && !profileLoading && isAuthenticated && Boolean(profile) && !profileError && role === 'student' && status === 'active'
  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || !profile || profileError || status === null) { navigate({ to: '/login', replace: true }); return }
    if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])
  useEffect(() => {
    if (!canLoad) return
    let cancelled = false
    setLoading(true)
    Promise.all([getMyLearningState(), getStudentLevelPackageStatus()])
      .then(([learningState, packageState]) => { if (!cancelled) { setState(learningState); setPackageStatus(packageState) } })
      .catch((nextError) => { if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Unable to load your learning status.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [canLoad])
  useEffect(() => {
    if (!canLoad) return
    let cancelled = false
    setProgressLoading(true)
    getMyStudentLearningProgress().then((nextRows) => { if (!cancelled) setRows(nextRows) }).catch(() => {}).finally(() => { if (!cancelled) setProgressLoading(false) })
    return () => { cancelled = true }
  }, [canLoad])

  if (authLoading || profileLoading) return <section className="border border-slate-200 bg-white p-6 shadow-sm"><div className="h-3 w-28 animate-pulse rounded bg-slate-200" /><div className="mt-4 h-8 w-72 animate-pulse rounded bg-slate-100" /></section>
  if (!isAuthenticated || !profile || profileError || status !== 'active' || role !== 'student') return null
  if (view === 'books') return <StudentBooksPage />
  if (view === 'assessment') return <StudentAssessmentPage />
  if (view === 'history') return <StudentHistoryPage />
  if (loading) return <section className="border border-slate-200 bg-white p-6 shadow-sm"><div className="h-3 w-28 animate-pulse rounded bg-slate-200" /><div className="mt-4 h-8 w-72 animate-pulse rounded bg-slate-100" /></section>

  const completedCount = currentRows.filter((row) => row.completed_at).length
  const progressPercent = currentRows.length ? Math.round((completedCount / currentRows.length) * 100) : 0
  const assigned = Boolean(state?.teaching_group_id && state?.teacher_id)
  const levelCompleted = Boolean(packageStatus?.level_completed)
  const needsRenewal = Boolean(packageStatus?.renewal_available && !levelCompleted)
  const canNext = Boolean(packageStatus?.level_completed && packageStatus?.next_level_available)

  const startPackage = async (packageType?: 'private' | 'semi_private') => {
    if (!action) return
    setSubmitting(true); setError(null)
    try {
      const enrollment = action === 'renew' ? await requestCurrentLevelPackageRenewal() : await requestNextLevelEnrollmentFromResult(packageType ?? 'semi_private')
      const { data, error: paymentError } = await supabase.rpc('initialize_enrollment_payment', { p_enrollment_id: enrollment.enrollment_id })
      if (paymentError) throw paymentError
      const paymentRow = Array.isArray(data) ? data[0] : data
      if (!paymentRow) throw new Error('Payment initialization did not return payment details.')
      setPayment({ invoice_number: paymentRow.invoice_number, payment_amount: paymentRow.payment_amount })
      setAction(null)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to start the selected package.')
    } finally { setSubmitting(false) }
  }

  return <div className="space-y-6">
    <header className="border-b border-slate-200 pb-5"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Student Learning</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[#102449]">My Learning</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">Learning Progress hanya menampilkan level yang sedang aktif.</p></header>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    {payment && <section className="border border-emerald-200 bg-emerald-50/70 p-5"><p className="text-sm font-extrabold text-emerald-900">Invoice ready: {payment.invoice_number}</p><p className="mt-1 text-sm text-emerald-800">{rupiah(payment.payment_amount)}. Open Payment from the sidebar to continue.</p></section>}
    {state ? <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5 sm:px-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Current Learning Stage</p><h2 className="mt-1.5 text-2xl font-extrabold text-[#102449]">Level {state.level_number}</h2><p className="mt-1 text-sm font-semibold text-blue-700">{state.level_name} · {formatPackage(state.package_type)}</p></div><span className={`inline-flex w-fit rounded-md px-2.5 py-1.5 text-xs font-bold ${levelCompleted ? 'bg-emerald-50 text-emerald-700' : assigned ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'}`}>{levelCompleted ? 'Level completed' : assigned ? 'Active learning' : 'Waiting for class assignment'}</span></div></div>
      <div className="grid gap-0 px-6 py-2 sm:grid-cols-2 lg:grid-cols-4 sm:px-7">{[['Package', formatPackage(state.package_type)], ['Sessions', packageStatus ? `${packageStatus.current_package_session_count}/${packageStatus.session_limit}` : `${state.completed_sessions}/${state.session_limit}`], ['Teaching Group', state.teaching_group_name ?? 'Not assigned yet'], ['Teacher', state.teacher_code ?? 'Not assigned yet']].map(([label, value], index) => <div key={label} className={`py-4 lg:px-5 ${index > 0 ? 'border-t border-slate-200 sm:border-t-0 sm:border-l' : 'lg:pl-0'}`}><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">{label}</p><p className="mt-1.5 text-sm font-bold text-slate-900">{value}</p></div>)}</div>
      {(needsRenewal || canNext) && <div className="flex flex-col gap-4 border-t border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7"><div><p className="text-sm font-extrabold text-[#102449]">{needsRenewal ? 'Paket selesai 8/8' : `Level ${packageStatus?.current_level_number} selesai`}</p><p className="mt-1 text-sm text-slate-600">{needsRenewal ? 'Level masih berjalan. Perpanjang paket untuk melanjutkan.' : `Pilih paket untuk Level ${packageStatus?.next_level_number}.`}</p></div><button type="button" onClick={() => setAction(needsRenewal ? 'renew' : 'next')} className="rounded-lg bg-[#102449] px-4 py-2.5 text-sm font-bold text-white">{needsRenewal ? 'Perpanjang Paket' : 'Pilih Paket Berikutnya'}</button></div>}
    </section> : <section className="border border-dashed border-slate-300 bg-slate-50 p-6"><p className="font-bold text-slate-900">No active learning package.</p></section>}
    <section className="border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-6 py-5 sm:px-7"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-700">Learning Progress</p><h2 className="mt-1 text-xl font-extrabold text-[#102449]">Your chapter progress — Level {state?.level_number ?? '—'}</h2><p className="mt-1 text-sm text-slate-500">Level lain tidak tampil di sini. Level selesai tersedia di History.</p></div><div className="p-6 sm:p-7">{progressLoading ? <div className="h-20 animate-pulse rounded-xl bg-slate-50" /> : currentRows.length === 0 ? <p className="text-sm text-slate-600">Belum ada chapter untuk level aktif.</p> : <details className="group rounded-xl border border-slate-200 bg-slate-50/50"><summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden"><div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-[#102449]">{completedCount} / {currentRows.length} chapters completed</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${progressPercent}%` }} /></div></div><span className="shrink-0 text-xs font-extrabold text-blue-700">{progressPercent}%</span><span className="text-slate-400 transition-transform group-open:rotate-180">⌄</span></summary><div className="max-h-[360px] overflow-y-auto border-t border-slate-200 px-4 py-4 sm:px-5"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{currentRows.map((row) => <article key={row.chapter_id} className={`rounded-lg border px-3.5 py-3 ${row.completed_at ? 'border-emerald-100 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Chapter {row.chapter_number}</p><p className="mt-1 text-sm font-bold text-[#102449]">{row.chapter_title}</p><p className={`mt-1 text-xs font-bold ${row.completed_at ? 'text-emerald-700' : 'text-slate-500'}`}>{row.completed_at ? '✓ Completed' : 'Not completed yet'}</p></article>)}</div></div></details>}</div></section>
    {action && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-700">Continue Learning</p><h2 className="mt-1 text-xl font-extrabold text-[#102449]">{action === 'renew' ? 'Perpanjang Paket' : 'Pilih Paket Berikutnya'}</h2></div><button type="button" onClick={() => setAction(null)} className="text-slate-400">✕</button></div>{action === 'renew' ? <button type="button" disabled={submitting} onClick={() => void startPackage()} className="mt-6 w-full rounded-lg bg-[#102449] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">Lanjut dengan {formatPackage(packageStatus?.current_package_type ?? 'private')} · {rupiah(packageStatus?.current_package_price)}</button> : <div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" disabled={submitting} onClick={() => void startPackage('private')} className="rounded-lg border border-slate-200 p-4 text-left hover:border-blue-200"><p className="font-extrabold text-[#102449]">Private</p><p className="mt-1 text-sm text-slate-500">Continue with one-to-one package.</p></button><button type="button" disabled={submitting} onClick={() => void startPackage('semi_private')} className="rounded-lg border border-slate-200 p-4 text-left hover:border-blue-200"><p className="font-extrabold text-[#102449]">Semi-Private</p><p className="mt-1 text-sm text-slate-500">Continue with small-group package.</p></button></div>} {error && <p className="mt-4 text-sm font-medium text-rose-700">{error}</p>}</div></div>}
  </div>
}
