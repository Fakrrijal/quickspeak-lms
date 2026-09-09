import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { useStudentEbooks } from '../../hooks/useStudentEbooks'
import { supabase } from '../../lib/supabase'
import { getMyLearningState, type StudentLearningState } from '../../services/student-learning-state.service'

type PaymentInitialization = {
  invoice_number: string
  payment_amount: number
  payment_status: string
}

function formatPackage(value: StudentLearningState['package_type']) {
  return value === 'private' ? 'Private' : 'Semi-Private'
}

export function StudentLearningPageV2() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [state, setState] = useState<StudentLearningState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPackageSelection, setShowPackageSelection] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<'private' | 'semi_private' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [paymentInitialization, setPaymentInitialization] = useState<PaymentInitialization | null>(null)
  const [success, setSuccess] = useState(false)
  const canLoadEbooks = Boolean(!authLoading && !profileLoading && isAuthenticated && profile && !profileError && role === 'student' && status === 'active')
  const { ebooks, loading: ebooksLoading, error: ebooksError, reload: reloadEbooks } = useStudentEbooks(canLoadEbooks)

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
    getMyLearningState()
      .then((nextState) => {
        if (!cancelled) setState(nextState)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load your learning status.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, role, status])

  const completed = Boolean(state && (state.enrollment_status === 'completed' || state.completed_at || state.completed_sessions >= state.session_limit))
  const assigned = Boolean(state?.teaching_group_id && state?.teacher_id)

  const handleChoosePackage = async (packageType: 'private' | 'semi_private') => {
    setSubmitting(true)
    setError(null)
    setSelectedPackage(packageType)
    try {
      const { data: enrollment, error: enrollmentError } = await supabase.rpc('create_student_enrollment', { p_package_type: packageType })
      if (enrollmentError) throw enrollmentError
      const enrollmentId = enrollment?.id
      if (!enrollmentId) throw new Error('Enrollment creation did not return an enrollment ID')
      const { data: paymentData, error: paymentError } = await supabase.rpc('initialize_enrollment_payment', { p_enrollment_id: enrollmentId })
      if (paymentError) throw paymentError
      const payment = Array.isArray(paymentData) ? paymentData[0] : paymentData
      if (!payment) throw new Error('Payment initialization did not return payment details')
      setPaymentInitialization({ invoice_number: payment.invoice_number, payment_amount: payment.payment_amount, payment_status: payment.payment_status })
      setSuccess(true)
      setState(null)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to start the selected package.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || profileLoading || loading) {
    return <section className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm text-slate-600">Loading your learning status...</p></section>
  }

  if (!isAuthenticated || !profile || profileError || status !== 'active' || role !== 'student') return null

  if (success && selectedPackage) {
    const packageName = selectedPackage === 'private' ? 'Private' : 'Semi-Private'
    return (
      <section className="rounded-[26px] border border-emerald-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-700">Enrollment Ready</p>
        <h1 className="mt-2 text-2xl font-extrabold text-[#102449]">{packageName} package selected</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Invoice {paymentInitialization?.invoice_number} is ready for payment.</p>
        <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">Payment amount: <strong>Rp{paymentInitialization?.payment_amount.toLocaleString('id-ID')}</strong></div>
        <Link to="/student-payment" className="mt-5 inline-flex rounded-full bg-[#102449] px-5 py-2.5 text-sm font-bold text-white">View Payment</Link>
      </section>
    )
  }

  if (error && !state) {
    return <section className="rounded-[26px] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800"><p className="font-bold">Unable to load My Learning</p><p className="mt-1">{error}</p></section>
  }

  if (!state || (completed && showPackageSelection)) {
    return (
      <section className="space-y-5">
        <header>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-blue-700">Student Portal</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-[#102449]">Choose Learning Package</h1>
          <p className="mt-2 text-sm text-slate-600">Select your package for the next learning stage.</p>
        </header>
        <div className="grid gap-5 md:grid-cols-2">
          {([['private', 'Private', 'One-to-one learning'], ['semi_private', 'Semi-Private', 'Small-group learning']] as const).map(([value, name, description]) => (
            <button key={value} type="button" disabled={submitting} onClick={() => void handleChoosePackage(value)} className="rounded-[24px] border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-700">Package</span>
              <h2 className="mt-2 text-2xl font-extrabold text-[#102449]">{name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              <span className="mt-5 inline-flex text-sm font-bold text-blue-700">Choose package →</span>
            </button>
          ))}
        </div>
        {error && <p className="text-sm font-medium text-rose-700">{error}</p>}
      </section>
    )
  }

  if (completed) {
    return (
      <section className="rounded-[26px] border border-emerald-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-700">Stage completed</p>
        <h1 className="mt-2 text-2xl font-extrabold text-[#102449]">Level {state.level_number} completed</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">You have completed {state.session_limit} sessions. Continue to the next stage when you are ready.</p>
        <button type="button" onClick={() => setShowPackageSelection(true)} className="mt-5 inline-flex rounded-full bg-[#102449] px-5 py-2.5 text-sm font-bold text-white">Continue to Next Stage →</button>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[26px] border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-7">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-blue-700">Student Portal</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] text-[#102449] sm:text-3xl">My Learning</h1>
        <p className="mt-2 text-sm text-slate-600">Your current learning stage and class assignment.</p>
      </header>

      <section className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Current Level</p>
            <h2 className="mt-1 text-3xl font-extrabold text-[#102449]">Level {state.level_number}</h2>
            <p className="mt-1 text-sm font-semibold text-blue-700">{state.level_name} · {formatPackage(state.package_type)}</p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">{assigned ? 'Active' : 'Waiting for Class Assignment'}</span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Package', formatPackage(state.package_type)],
            ['Sessions', `${state.completed_sessions}/${state.session_limit}`],
            ['Teaching Group', state.teaching_group_name ?? 'Not assigned yet'],
            ['Teacher', state.teacher_code ?? 'Not assigned yet'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-1.5 text-sm font-bold text-slate-950">{value}</p>
            </div>
          ))}
        </div>

        {!assigned && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Your payment has been approved. The administrator will assign your teaching group and teacher.</div>}
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-700">Ebook</p><h2 className="mt-1 text-xl font-extrabold text-[#102449]">Learning Materials</h2></div>
        </div>
        {ebooksLoading ? <p className="mt-4 text-sm text-slate-600">Loading ebook...</p> : ebooksError ? <div className="mt-4 flex flex-wrap gap-3 text-sm text-amber-800"><p>Unable to load your ebook.</p><button type="button" onClick={() => void reloadEbooks()} className="font-bold underline">Retry</button></div> : ebooks.length === 0 ? <p className="mt-4 text-sm text-slate-600">No ebook is currently available for your level.</p> : <div className="mt-4 grid gap-4 sm:grid-cols-2">{ebooks.map((ebook) => <article key={ebook.ebook_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><h3 className="text-base font-bold text-slate-950">{ebook.title}</h3><p className="mt-1 text-sm text-slate-600">{ebook.level_name}</p><Link to="/student/ebooks/$ebookId" params={{ ebookId: ebook.ebook_id }} className="mt-4 inline-flex text-sm font-bold text-blue-700">Open Ebook →</Link></article>)}</div>}
      </section>
    </div>
  )
}