import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { useStudentEbooks } from '../../hooks/useStudentEbooks'
import { supabase } from '../../lib/supabase'
import { getMyLearningState, type StudentLearningState } from '../../services/student-learning-state.service'
import { getMyStudentLearningProgress, type StudentLearningProgressRow } from '../../services/student-learning-progress.service'
import {
  getStudentLevelPackageStatus,
  requestCurrentLevelPackageRenewal,
  requestNextLevelEnrollmentFromResult,
  type StudentLevelPackageStatus,
} from '../../services/level-completion.service'

type PaymentInitialization = {
  invoice_number: string
  payment_amount: number
  payment_status: string
}

function formatPackage(value: StudentLearningState['package_type']) {
  return value === 'private' ? 'Private' : 'Semi-Private'
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function formatRupiah(value: number | null | undefined) {
  return value == null ? '—' : `Rp${value.toLocaleString('id-ID')}`
}

export function StudentLearningPageV2() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [state, setState] = useState<StudentLearningState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progressRows, setProgressRows] = useState<StudentLearningProgressRow[]>([])
  const [progressLoading, setProgressLoading] = useState(true)
  const [progressError, setProgressError] = useState(false)
  const [packageStatus, setPackageStatus] = useState<StudentLevelPackageStatus | null>(null)
  const [packageStatusLoading, setPackageStatusLoading] = useState(true)
  const [showPackageSelection, setShowPackageSelection] = useState(false)
  const [packageAction, setPackageAction] = useState<'renew' | 'next' | null>(null)
  const [selectedPackage, setSelectedPackage] = useState<'private' | 'semi_private' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [paymentInitialization, setPaymentInitialization] = useState<PaymentInitialization | null>(null)
  const [success, setSuccess] = useState(false)
  const canLoadEbooks = Boolean(!authLoading && !profileLoading && isAuthenticated && profile && !profileError && role === 'student' && status === 'active')
  const { catalog, loading: ebooksLoading, error: ebooksError, reload: reloadEbooks } = useStudentEbooks(canLoadEbooks)

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || !profile || profileError || status === null) {
      navigate({ to: '/login', replace: true })
      return
    }
    if (status === 'waiting') {
      navigate({ to: '/waiting', replace: true })
      return
    }
    if (role !== 'student' || status !== 'active') return

    let cancelled = false
    setLoading(true)
    setPackageStatusLoading(true)
    setError(null)

    Promise.allSettled([getMyLearningState(), getStudentLevelPackageStatus()])
      .then(([learningResult, packageResult]) => {
        if (cancelled) return

        if (learningResult.status === 'fulfilled') {
          setState(learningResult.value)
        } else {
          setError(learningResult.reason instanceof Error ? learningResult.reason.message : 'Unable to load your learning status.')
        }

        if (packageResult.status === 'fulfilled') {
          setPackageStatus(packageResult.value)
        }
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
        setPackageStatusLoading(false)
      })

    return () => { cancelled = true }
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, role, status])

  useEffect(() => {
    if (!canLoadEbooks) return
    let cancelled = false
    setProgressLoading(true)
    setProgressError(false)
    getMyStudentLearningProgress()
      .then((rows) => { if (!cancelled) setProgressRows(rows) })
      .catch(() => { if (!cancelled) setProgressError(true) })
      .finally(() => { if (!cancelled) setProgressLoading(false) })
    return () => { cancelled = true }
  }, [canLoadEbooks])

  const packageCompleted = Boolean(packageStatus && packageStatus.current_package_session_count >= packageStatus.session_limit)
  const levelCompleted = Boolean(packageStatus?.level_completed)
  const legacyCompleted = Boolean(state && (state.enrollment_status === 'completed' || state.completed_at || state.completed_sessions >= state.session_limit))
  const completed = levelCompleted || (packageStatus ? packageCompleted && levelCompleted : legacyCompleted)
  const assigned = Boolean(state?.teaching_group_id && state?.teacher_id)
  const currentLevelRows = useMemo(() => state ? progressRows.filter((row) => row.level_number === state.level_number && row.chapter_id) : [], [progressRows, state])
  const historicalLevels = useMemo(() => {
    const levels = new Map<number, { levelNumber: number; levelName: string; rows: StudentLearningProgressRow[] }>()
    for (const row of progressRows) {
      if (!row.chapter_id) continue
      const level = levels.get(row.level_number) ?? { levelNumber: row.level_number, levelName: row.level_name, rows: [] }
      level.rows.push(row)
      levels.set(row.level_number, level)
    }
    return [...levels.values()].sort((a, b) => a.levelNumber - b.levelNumber)
  }, [progressRows])
  const currentCompletedCount = currentLevelRows.filter((row) => row.completed_at).length
  const currentProgressPercent = currentLevelRows.length ? Math.round((currentCompletedCount / currentLevelRows.length) * 100) : 0

  const initializeEnrollmentPayment = async (enrollmentId: string) => {
    const { data: paymentData, error: paymentError } = await supabase.rpc('initialize_enrollment_payment', { p_enrollment_id: enrollmentId })
    if (paymentError) throw paymentError
    const payment = Array.isArray(paymentData) ? paymentData[0] : paymentData
    if (!payment) throw new Error('Payment initialization did not return payment details')
    setPaymentInitialization({
      invoice_number: payment.invoice_number,
      payment_amount: payment.payment_amount,
      payment_status: payment.payment_status,
    })
  }

  const handleChoosePackage = async (packageType: 'private' | 'semi_private') => {
    setSubmitting(true)
    setError(null)
    setSelectedPackage(packageType)
    try {
      let enrollmentId: string | undefined

      if (packageAction === 'renew') {
        const enrollment = await requestCurrentLevelPackageRenewal()
        enrollmentId = enrollment.enrollment_id
      } else if (packageAction === 'next') {
        const enrollment = await requestNextLevelEnrollmentFromResult(packageType)
        enrollmentId = enrollment.enrollment_id
      } else {
        const { data: enrollment, error: enrollmentError } = await supabase.rpc('create_student_enrollment', { p_package_type: packageType })
        if (enrollmentError) throw enrollmentError
        enrollmentId = enrollment?.id
      }

      if (!enrollmentId) throw new Error('Enrollment creation did not return an enrollment ID')
      await initializeEnrollmentPayment(enrollmentId)
      setSuccess(true)
      setShowPackageSelection(false)
      setState(null)
      setPackageStatus(null)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to start the selected package.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || profileLoading || loading) {
    return (
      <section className="border border-slate-200 bg-white px-6 py-7 shadow-sm">
        <div className="h-2.5 w-28 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-8 w-72 max-w-full rounded-lg bg-slate-100" />
        <div className="mt-3 h-4 w-96 max-w-full rounded-full bg-slate-100" />
      </section>
    )
  }

  if (!isAuthenticated || !profile || profileError || status !== 'active' || role !== 'student') return null

  if (success && selectedPackage) {
    const packageName = selectedPackage === 'private' ? 'Private' : 'Semi-Private'
    return (
      <section className="space-y-6">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Enrollment Ready</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-[#102449]">{packageName} package selected</h1>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">Invoice {paymentInitialization?.invoice_number} is ready for payment.</p>
        </header>
        <section className="border border-emerald-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-slate-900">Payment amount</p>
          <p className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-[#102449]">{formatRupiah(paymentInitialization?.payment_amount)}</p>
          <Link to="/student-payment" className="mt-5 inline-flex items-center rounded-lg bg-[#102449] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f]">View Payment</Link>
        </section>
      </section>
    )
  }

  if (error && !state) {
    return <section className="border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800"><p className="font-bold">Unable to load My Learning</p><p className="mt-1">{error}</p></section>
  }

  if (!state || (completed && showPackageSelection)) {
    const isRenewal = packageAction === 'renew'
    return (
      <section className="space-y-6">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Student Learning</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[#102449]">{isRenewal ? 'Perpanjang Paket' : 'Choose Learning Package'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {isRenewal
              ? `Paket Level ${packageStatus?.current_level_number ?? state?.level_number ?? ''} sudah 8/8 sesi. Pilih jenis paket yang sama untuk melanjutkan level ini.`
              : 'Select your package for the next learning stage.'}
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {([['private', 'Private', 'One-to-one learning'], ['semi_private', 'Semi-Private', 'Small-group learning']] as const).map(([value, name, description]) => (
            <button key={value} type="button" disabled={submitting} onClick={() => void handleChoosePackage(value)} className="group border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Package</p>
              <h2 className="mt-2 text-xl font-extrabold tracking-[-0.02em] text-[#102449]">{name}</h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">{description}</p>
              {isRenewal && (
                <p className="mt-3 text-sm font-bold text-slate-900">
                  {packageStatus?.current_package_type === value ? `Continue at ${formatRupiah(packageStatus.current_package_price)}` : 'Choose package type'}
                </p>
              )}
              <span className="mt-5 inline-flex text-sm font-bold text-blue-700">{isRenewal ? 'Perpanjang paket' : 'Choose package'} <span className="ml-1 transition-transform group-hover:translate-x-0.5">→</span></span>
            </button>
          ))}
        </div>
        {error && <p className="text-sm font-medium text-rose-700">{error}</p>}
      </section>
    )
  }

  const needsRenewal = Boolean(packageStatus && packageStatus.renewal_available)
  const canChooseNextLevel = Boolean(packageStatus && packageStatus.level_completed && packageStatus.next_level_available)

  const ebookSlots = [1, 2, 3, 4].map((levelNumber) => ({
    levelNumber,
    ebook: catalog.find((candidate) => candidate.level_number === levelNumber) ?? null,
  }))

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Student Learning</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[#102449]">My Learning</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">Your current learning stage, class assignment, and learning progress.</p>
      </header>

      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Current Learning Stage</p>
              <h2 className="mt-1.5 text-2xl font-extrabold tracking-[-0.03em] text-[#102449]">Level {state.level_number}</h2>
              <p className="mt-1 text-sm font-semibold text-blue-700">{formatPackage(state.package_type)}</p>
            </div>
            <span className={`inline-flex w-fit items-center rounded-md px-2.5 py-1.5 text-xs font-bold ${assigned ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{assigned ? 'Active learning' : 'Waiting for class assignment'}</span>
          </div>
        </div>

        <div className="px-6 py-5 sm:px-7">
          <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Package', formatPackage(state.package_type)],
              ['Sessions', packageStatus ? `${packageStatus.current_package_session_count}/${packageStatus.session_limit}` : `${state.completed_sessions}/${state.session_limit}`],
              ['Teaching Group', state.teaching_group_name ?? 'Not assigned yet'],
              ['Teacher', state.teacher_code ?? 'Not assigned yet'],
            ].map(([label, value], index) => (
              <div key={label} className={`py-4 lg:px-5 ${index > 0 ? 'border-t border-slate-200 sm:border-t-0 sm:border-l' : 'lg:pl-0'} ${index === 3 ? 'lg:pr-0' : ''}`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">{label}</p>
                <p className="mt-1.5 text-sm font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          {!assigned && <div className="mt-4 border border-amber-200 bg-amber-50 px-4 py-3"><p className="text-sm leading-6 text-amber-900">Your payment has been approved. The administrator will assign your teaching group and teacher.</p></div>}

          {!packageStatusLoading && needsRenewal && !levelCompleted && (
            <div className="mt-5 flex flex-col gap-4 border border-blue-200 bg-blue-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-extrabold text-[#102449]">Paket selesai 8/8</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Level masih berjalan. Perpanjang paket dengan jenis paket yang sama.</p>
                <p className="mt-1 text-xs font-bold text-blue-700">Sesi kumulatif Level {packageStatus?.current_level_number}: {packageStatus?.cumulative_level_session_count}</p>
              </div>
              <button type="button" onClick={() => { setPackageAction('renew'); setShowPackageSelection(true) }} className="inline-flex items-center justify-center rounded-lg bg-[#102449] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f]">Perpanjang Paket <span className="ml-2">→</span></button>
            </div>
          )}

          {!packageStatusLoading && levelCompleted && canChooseNextLevel && (
            <div className="mt-5 flex flex-col gap-4 border border-emerald-200 bg-emerald-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-extrabold text-emerald-900">Level {packageStatus?.current_level_number} selesai</p>
                <p className="mt-1 text-sm leading-6 text-emerald-800">Teacher sudah menyelesaikan level. Anda dapat memilih paket untuk Level {packageStatus?.next_level_number}.</p>
              </div>
              <button type="button" onClick={() => { setPackageAction('next'); setShowPackageSelection(true) }} className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800">Pilih Paket Level Berikutnya <span className="ml-2">→</span></button>
            </div>
          )}
        </div>
      </section>

      <section className="border border-slate-200 bg-white shadow-sm" aria-labelledby="student-progress-title">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-700">Learning Progress</p>
          <h2 id="student-progress-title" className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-[#102449]">Your chapter progress</h2>
          <p className="mt-1 text-sm text-slate-500">Completed chapters are recorded by your teacher and stay available as you move through levels.</p>
        </div>
        <div className="p-6 sm:p-7">
          {progressLoading ? (
            <div className="space-y-3"><div className="h-5 w-48 animate-pulse rounded bg-slate-100" /><div className="h-2.5 w-full animate-pulse rounded bg-slate-100" /><div className="h-20 w-full animate-pulse rounded-xl bg-slate-50" /></div>
          ) : progressError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4"><p className="text-sm font-bold text-rose-800">Unable to load your learning progress.</p><p className="mt-1 text-sm text-rose-700">Please refresh this page and try again.</p></div>
          ) : currentLevelRows.length === 0 ? (
            <p className="text-sm leading-6 text-slate-600">No chapter progress has been recorded for this level yet.</p>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">{profile.full_name} — Level {state.level_number}</p>
                  <p className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-[#102449]">{currentCompletedCount} / {currentLevelRows.length} chapters completed</p>
                </div>
                <p className="text-sm font-extrabold text-blue-700">{currentProgressPercent}%</p>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${currentProgressPercent}%` }} /></div>

              <div className="mt-6 max-h-[560px] space-y-6 overflow-y-auto pr-2">
                {historicalLevels.map((level) => {
                  const completedCount = level.rows.filter((row) => row.completed_at).length
                  const percent = level.rows.length ? Math.round((completedCount / level.rows.length) * 100) : 0
                  return (
                    <section key={level.levelNumber} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Level {level.levelNumber}</p><h3 className="mt-1 text-base font-extrabold text-[#102449]">{level.levelName}</h3></div>
                        <p className="text-xs font-extrabold text-blue-700">{completedCount}/{level.rows.length} completed · {percent}%</p>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {level.rows.map((row) => (
                          <div key={row.chapter_id} className={`rounded-xl border px-3.5 py-3 ${row.completed_at ? 'border-emerald-100 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}>
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Chapter {row.chapter_number}</p>
                            <p className="mt-1 text-sm font-bold text-[#102449]">{row.chapter_title}</p>
                            <p className={`mt-1 text-xs font-bold ${row.completed_at ? 'text-emerald-700' : 'text-slate-500'}`}>{row.completed_at ? '✓ Completed' : 'Not completed yet'}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="border border-slate-200 bg-white shadow-sm" aria-labelledby="learning-materials-title">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-700">Learning Materials</p>
            <h2 id="learning-materials-title" className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-[#102449]">Ebooks</h2>
          </div>
          <p className="text-sm text-slate-500">Four level books · unlocked as you progress</p>
        </div>
        <div className="p-6 sm:p-7">
          {ebooksLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((item) => <div key={item} className="overflow-hidden border border-slate-200 bg-slate-50"><div className="aspect-[3/4] animate-pulse bg-slate-200" /><div className="space-y-2 p-4"><div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" /><div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" /></div></div>)}
            </div>
          ) : ebooksError ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-amber-800"><p>Unable to load your ebook catalog.</p><button type="button" onClick={() => void reloadEbooks()} className="font-bold underline">Retry</button></div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {ebookSlots.map(({ levelNumber, ebook }) => {
                const unlocked = Boolean(ebook?.is_unlocked)
                return (
                  <article key={levelNumber} className={`group overflow-hidden border bg-white shadow-sm transition ${unlocked ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md' : 'border-slate-200'}`}>
                    <div className="relative aspect-[3/4] overflow-hidden bg-slate-100">
                      {ebook?.thumbnail_url ? (
                        <img src={ebook.thumbnail_url} alt={`Cover ${ebook.title}`} className={`h-full w-full object-cover ${unlocked ? '' : 'blur-[1px]'}`} />
                      ) : (
                        <div className="flex h-full w-full items-end bg-gradient-to-br from-slate-100 via-white to-blue-50 p-5">
                          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">QuickSpeak</p><p className="mt-2 text-xl font-extrabold text-[#102449]">Level {levelNumber}</p><p className="mt-1 text-sm text-slate-600">English Course</p></div>
                        </div>
                      )}
                      {!unlocked && <div className="absolute inset-0 flex items-center justify-center bg-[#102449]/45"><div className="flex size-12 items-center justify-center rounded-full bg-white/95 text-[#102449] shadow-lg"><LockIcon /></div></div>}
                      <div className="absolute left-3 top-3 rounded-md bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#102449] shadow-sm">Level {levelNumber}</div>
                    </div>
                    <div className="p-4">
                      <h3 className="line-clamp-2 text-base font-extrabold text-[#102449]">{ebook?.title ?? `Level ${levelNumber} Ebook`}</h3>
                      <p className="mt-1 text-sm text-slate-500">{ebook?.level_name ?? `Level ${levelNumber}`}</p>
                      {unlocked && ebook ? (
                        <Link to="/student/ebooks/$ebookId" params={{ ebookId: ebook.ebook_id }} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:text-blue-800">Open Ebook <ArrowIcon /></Link>
                      ) : (
                        <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><LockIcon /> Locked</p>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
