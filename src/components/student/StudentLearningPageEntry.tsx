import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { supabase } from '../../lib/supabase'
import { getCurrentStudentPaymentDetails } from '../../services/student-payment.service'
import { StudentLearningPageV2 } from './StudentLearningPageV2'

type LearningLevel = {
  id: string
  level_number: number
  name: string
}

type EnrollmentPayment = {
  id: string
  package_type: 'private' | 'semi_private'
  price: number
}

function formatPackage(value: 'private' | 'semi_private') {
  return value === 'private' ? 'Private' : 'Semi-Private'
}

function formatRupiah(value: number | null | undefined) {
  return value == null ? '—' : `Rp${value.toLocaleString('id-ID')}`
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return error instanceof Error ? error.message : 'Unable to start the selected enrollment.'
}

export function StudentLearningPageEntry() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [checkingEnrollment, setCheckingEnrollment] = useState(true)
  const [hasEnrollment, setHasEnrollment] = useState(false)
  const [levels, setLevels] = useState<LearningLevel[]>([])
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null)
  const [selectedPackage, setSelectedPackage] = useState<'private' | 'semi_private' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentInitialization, setPaymentInitialization] = useState<{
    invoice_number: string
    payment_amount: number
  } | null>(null)

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
    setCheckingEnrollment(true)
    setError(null)

    Promise.all([
      getCurrentStudentPaymentDetails(),
      supabase
        .from('levels')
        .select('id, level_number, name')
        .order('level_number', { ascending: true }),
    ])
      .then(([paymentDetails, levelResult]) => {
        if (cancelled) return
        if (levelResult.error) throw levelResult.error

        const levelRows = (levelResult.data ?? []) as LearningLevel[]
        setLevels(levelRows)
        setSelectedLevelId(levelRows[0]?.id ?? null)
        setHasEnrollment(Boolean(paymentDetails))
      })
      .catch((loadError) => {
        if (!cancelled) setError(getErrorMessage(loadError))
      })
      .finally(() => {
        if (!cancelled) setCheckingEnrollment(false)
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, role, status])

  if (authLoading || profileLoading || checkingEnrollment) {
    return (
      <section className="border border-slate-200 bg-white px-6 py-7 shadow-sm">
        <div className="h-2.5 w-28 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-8 w-72 max-w-full rounded-lg bg-slate-100" />
        <div className="mt-3 h-4 w-96 max-w-full rounded-full bg-slate-100" />
      </section>
    )
  }

  if (!isAuthenticated || !profile || profileError || status !== 'active' || role !== 'student') return null
  if (hasEnrollment) return <StudentLearningPageV2 />

  const selectedLevel = levels.find((level) => level.id === selectedLevelId) ?? null

  const handleStartEnrollment = async (packageType: 'private' | 'semi_private') => {
    if (!selectedLevelId || submitting) return
    setSubmitting(true)
    setSelectedPackage(packageType)
    setError(null)
    try {
      const { data, error: enrollmentError } = await supabase.rpc('create_student_enrollment', {
        p_level_id: selectedLevelId,
        p_package_type: packageType,
      })

      if (enrollmentError) throw enrollmentError

      const enrollment = (Array.isArray(data) ? data[0] : data) as EnrollmentPayment | null
      if (!enrollment?.id) throw new Error('Enrollment creation did not return an enrollment ID.')

      const { data: paymentData, error: paymentError } = await supabase.rpc('initialize_enrollment_payment', {
        p_enrollment_id: enrollment.id,
      })

      if (paymentError) throw paymentError
      const payment = Array.isArray(paymentData) ? paymentData[0] : paymentData
      if (!payment) throw new Error('Payment initialization did not return payment details.')

      setPaymentInitialization({
        invoice_number: payment.invoice_number,
        payment_amount: payment.payment_amount,
      })
    } catch (submitError) {
      setSelectedPackage(null)
      setPaymentInitialization(null)
      setError(getErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  if (paymentInitialization && selectedPackage && selectedLevel) {
    return (
      <section className="space-y-6">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Enrollment Ready</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[#102449]">Level {selectedLevel.level_number} · {formatPackage(selectedPackage)}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Invoice {paymentInitialization.invoice_number} is ready. The selected level and package will remain the source of truth for this payment and teaching-group assignment.</p>
        </header>

        <section className="border border-emerald-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-slate-900">Payment amount</p>
          <p className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#102449]">{formatRupiah(paymentInitialization.payment_amount)}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Learning Level</p>
              <p className="mt-1 text-sm font-bold text-slate-900">Level {selectedLevel.level_number}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Package</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{formatPackage(selectedPackage)}</p>
            </div>
          </div>
          <Link to="/student-payment" className="mt-5 inline-flex items-center rounded-lg bg-[#102449] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f]">View Payment <span className="ml-2">→</span></Link>
        </section>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Student Learning</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[#102449]">Choose Learning Enrollment</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Choose the level and package you are actually going to pay for. Your original registration preference does not lock this enrollment.</p>
      </header>

      <section className="border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-700">Step 1</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#102449]">Select Learning Level</h2>
            <p className="mt-1 text-sm text-slate-500">This level will be attached to the enrollment and invoice.</p>
          </div>
          <select
            value={selectedLevelId ?? ''}
            onChange={(event) => setSelectedLevelId(event.target.value || null)}
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-400 sm:max-w-xs"
          >
            {levels.map((level) => (
              <option key={level.id} value={level.id}>Level {level.level_number} — {level.name}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-700">Step 2</p>
          <h2 className="mt-1 text-xl font-extrabold text-[#102449]">Select Package</h2>
          <p className="mt-1 text-sm text-slate-500">The package determines the payment amount and matching teaching-group type.</p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {([
            ['private', 'Private', 'One-to-one learning'],
            ['semi_private', 'Semi-Private', 'Small-group learning'],
          ] as const).map(([value, name, description]) => (
            <button
              key={value}
              type="button"
              disabled={!selectedLevelId || submitting}
              onClick={() => void handleStartEnrollment(value)}
              className="group border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Level {selectedLevel?.level_number ?? '—'}</p>
              <h3 className="mt-2 text-xl font-extrabold tracking-[-0.02em] text-[#102449]">{name}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">{description}</p>
              <span className="mt-5 inline-flex text-sm font-bold text-blue-700">Continue to Payment <span className="ml-1 transition-transform group-hover:translate-x-0.5">→</span></span>
            </button>
          ))}
        </div>

        {error && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      </section>
    </section>
  )
}
