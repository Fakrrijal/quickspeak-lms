import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useAuthContext } from '../providers/AuthProvider'
import { supabase } from '../lib/supabase'
import {
  getMyActiveEnrollments,
  type StudentActiveEnrollment,
} from '../services/student-active-enrollment.service'
import { useStudentEbooks } from '../hooks/useStudentEbooks'
import { getActivePaymentSettings, type PaymentSettings } from '../services/payment-settings.service'
import { StudentDashboardV2 } from '../components/student/StudentDashboardV2'

type PaymentInitialization = {
  invoice_number: string
  payment_amount: number
  payment_status: string
}

const inProgressEnrollmentMessage = 'Student already has an enrollment in progress for the current level'

function formatPackage(packageType: StudentActiveEnrollment['package_type']) {
  return packageType === 'private' ? 'Private' : 'Semi-Private'
}

function formatEnrollmentStatus(status: StudentActiveEnrollment['enrollment_status']) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export const Route = createFileRoute('/student')({
  component: StudentRouteComponent,
})

function StudentRouteComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return pathname === '/student' ? <StudentDashboardV2 /> : <Outlet />
}

export function StudentLearningPage() {
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
  const [selectedPackage, setSelectedPackage] = useState<'private' | 'semi_private' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(false)
  const [paymentInitialization, setPaymentInitialization] = useState<PaymentInitialization | null>(null)
  const [activeEnrollments, setActiveEnrollments] = useState<StudentActiveEnrollment[]>([])
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null)
  const [activeEnrollmentLoading, setActiveEnrollmentLoading] = useState(true)
  const [activeEnrollmentError, setActiveEnrollmentError] = useState(false)
  const canLoadEbooks = (
    !authLoading
    && !profileLoading
    && isAuthenticated
    && Boolean(profile)
    && !profileError
    && role === 'student'
    && status === 'active'
  )
  const {
    ebooks,
    loading: ebooksLoading,
    error: ebooksError,
    reload: reloadEbooks,
  } = useStudentEbooks(canLoadEbooks)

  useEffect(() => {
    if (authLoading || profileLoading) {
      return
    }

    if (!isAuthenticated || !profile || profileError || status === null) {
      navigate({ to: '/login', replace: true })
      return
    }

    if (status === 'waiting') {
      navigate({ to: '/waiting', replace: true })
    }
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  const loadActiveEnrollments = useCallback(async () => {
    setActiveEnrollmentLoading(true)
    setActiveEnrollmentError(false)

    try {
      setActiveEnrollments(await getMyActiveEnrollments())
    } catch {
      setActiveEnrollmentError(true)
    } finally {
      setActiveEnrollmentLoading(false)
    }
  }, [])

  useEffect(() => {
    if (
      !authLoading
      && !profileLoading
      && isAuthenticated
      && profile
      && !profileError
      && role === 'student'
      && status === 'active'
    ) {
      void loadActiveEnrollments()
    }
  }, [
    authLoading,
    isAuthenticated,
    loadActiveEnrollments,
    profile,
    profileError,
    profileLoading,
    role,
    status,
  ])

  useEffect(() => {
    if (!canLoadEbooks) return
    void getActivePaymentSettings().then(setPaymentSettings).catch(() => setPaymentSettings(null))
  }, [canLoadEbooks])

  const findExistingInProgressEnrollmentId = async () => {
    if (!profile?.id) {
      throw new Error('Unable to identify the authenticated student')
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, level_id')
      .eq('profile_id', profile.id)
      .single()

    if (studentError) {
      throw studentError
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', student.id)
      .eq('level_id', student.level_id)
      .in('status', [
        'pending',
        'payment_pending',
        'payment_submitted',
        'payment_rejected',
        'payment_approved',
        'teacher_assignment',
        'active',
      ])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (enrollmentError) {
      throw enrollmentError
    }

    if (!enrollment?.id) {
      throw new Error('No existing in-progress enrollment was found for the current level')
    }

    return enrollment.id
  }

  const handleChoosePackage = async (packageType: 'private' | 'semi_private') => {
    setSelectedPackage(packageType)
    setLoading(true)
    setError(null)
    setPaymentInitialization(null)
    let enrollmentCreated = false

    try {
      const { data: enrollment, error: enrollmentError } = await supabase.rpc('create_student_enrollment', {
        p_package_type: packageType,
      })

      if (enrollmentError) {
        if (
          enrollmentError.code === 'P0001'
          && enrollmentError.message === inProgressEnrollmentMessage
        ) {
          enrollmentCreated = true
        } else {
          throw enrollmentError
        }
      }

      const enrollmentId = enrollmentError
        ? await findExistingInProgressEnrollmentId()
        : enrollment?.id

      if (!enrollmentId) {
        throw new Error('Enrollment creation did not return an enrollment ID')
      }

      enrollmentCreated = true

      const { data: paymentData, error: paymentError } = await supabase.rpc('initialize_enrollment_payment', {
        p_enrollment_id: enrollmentId,
      })

      if (paymentError) {
        throw paymentError
      }

      const payment = Array.isArray(paymentData) ? paymentData[0] : paymentData

      if (!payment) {
        throw new Error('Payment initialization did not return payment details')
      }

      setPaymentInitialization({
        invoice_number: payment.invoice_number,
        payment_amount: payment.payment_amount,
        payment_status: payment.payment_status,
      })
      setEnrollmentSuccess(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Enrollment failed'
      setError(
        enrollmentCreated
          ? `Your enrollment was created, but payment initialization failed. ${message}`
          : message,
      )
      setSelectedPackage(null)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen p-8">
        <p>Loading...</p>
      </main>
    )
  }

  if (!isAuthenticated || !profile || profileError || status === null || status === 'waiting') {
    return null
  }

  if (role !== 'student' || status !== 'active') {
    return (
      <main className="min-h-screen p-8">
        <p>Access denied.</p>
      </main>
    )
  }

  if (enrollmentSuccess && selectedPackage) {
    const packageDetails = selectedPackage === 'private'
      ? { name: 'Private', sessions: 8, maxStudents: 1 }
      : { name: 'Semi-Private', sessions: 8, maxStudents: 4 }

    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border bg-white p-8 shadow-sm">
            <div className="text-center">
              <div className="mb-4 text-5xl">✓</div>
              <h2 className="text-2xl font-bold text-slate-900">Enrollment Successful</h2>
              <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-6">
                <h3 className="text-lg font-semibold text-emerald-900">{packageDetails.name} Package</h3>
                <div className="mt-4 space-y-2 text-left">
                  <p className="text-sm text-emerald-800"><span className="font-medium">Price:</span> Rp{paymentInitialization?.payment_amount.toLocaleString('id-ID')}</p>
                  <p className="text-sm text-emerald-800"><span className="font-medium">Sessions:</span> {packageDetails.sessions} meetings</p>
                  <p className="text-sm text-emerald-800"><span className="font-medium">Maximum Students:</span> {packageDetails.maxStudents}</p>
                  {paymentInitialization?.invoice_number && <p className="text-sm text-emerald-800"><span className="font-medium">Invoice Number:</span> {paymentInitialization.invoice_number}</p>}
                  <p className="text-sm text-emerald-800"><span className="font-medium">Payment Amount:</span> Rp{paymentInitialization?.payment_amount.toLocaleString('id-ID')}</p>
                  <p className="mt-4 text-sm font-semibold text-emerald-900">Status: {paymentInitialization?.payment_status ?? 'unpaid'}</p>
                  <p className="text-sm text-emerald-700">Next step: payment. Please complete payment to activate your enrollment.</p>
                </div>
              </div>
              <div className="mt-6 flex justify-center gap-3">
                <Link to="/student-payment" className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-800">View Payment Details</Link>
                <button onClick={() => { setEnrollmentSuccess(false); setSelectedPackage(null); setPaymentInitialization(null) }} className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50">Choose Another Package</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (activeEnrollmentLoading) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-slate-900">My Learning</h1>
          <p className="mt-4 text-sm text-slate-600">Loading active enrollment…</p>
        </div>
      </main>
    )
  }

  if (activeEnrollmentError) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-slate-900">My Learning</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p>Unable to load active enrollment details.</p>
            <button type="button" onClick={() => void loadActiveEnrollments()} className="font-medium underline">Retry</button>
          </div>
        </div>
      </main>
    )
  }

  if (activeEnrollments.length > 0) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-slate-900">My Learning</h1>
          <section className="mt-6" aria-labelledby="active-enrollments-heading">
            <h2 id="active-enrollments-heading" className="text-xl font-bold text-slate-900">{activeEnrollments.length === 1 ? 'Active Enrollment' : 'Active Enrollments'}</h2>
            <div className="mt-4 grid gap-4">
              {activeEnrollments.map((activeEnrollment) => (
                <article key={`${activeEnrollment.enrollment_id}-${activeEnrollment.teaching_group_id}`} className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-emerald-900">{activeEnrollment.level_name}</h3>
                  <p className="mt-1 text-sm font-medium text-emerald-800">{formatPackage(activeEnrollment.package_type)}</p>
                  <dl className="mt-5 space-y-3 text-sm">
                    <div><dt className="font-medium text-emerald-900">Teacher</dt><dd className="mt-1 text-emerald-800">{activeEnrollment.teacher_code}</dd></div>
                    <div><dt className="font-medium text-emerald-900">Teaching Group</dt><dd className="mt-1 text-emerald-800">{activeEnrollment.teaching_group_name}</dd></div>
                    <div><dt className="font-medium text-emerald-900">Status</dt><dd className="mt-1 text-emerald-800">{formatEnrollmentStatus(activeEnrollment.enrollment_status)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
          <section className="mt-8" aria-labelledby="ebooks-heading">
            <h2 id="ebooks-heading" className="text-xl font-bold text-slate-900">Ebook</h2>
            {ebooksLoading ? (
              <p className="mt-4 text-sm text-slate-600">Loading ebook...</p>
            ) : ebooksError ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><p>Unable to load your ebook. Please try again.</p><button type="button" onClick={() => void reloadEbooks()} className="font-medium underline">Retry</button></div>
            ) : ebooks.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">No ebook is currently available for your active level.</p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {ebooks.map((ebook) => (
                  <article key={ebook.ebook_id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900">{ebook.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{ebook.level_name}</p>
                    <Link to="/student/ebooks/$ebookId" params={{ ebookId: ebook.ebook_id }} className="mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Open Ebook</Link>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-slate-900">Choose Learning Package</h1>
        <p className="mt-2 text-slate-600">Welcome, {profile?.full_name ?? 'Student'}. Select your preferred learning package.</p>
        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4"><p className="text-sm text-red-700">{error}</p></div>}
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">Private</h2><span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-medium text-violet-700">1-on-1</span></div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-slate-600">Price</span><span className="font-semibold text-slate-900">{paymentSettings ? `Rp${paymentSettings.private_registration_fee.toLocaleString('id-ID')}` : 'Configured at checkout'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">Sessions</span><span className="font-semibold text-slate-900">8 meetings</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">Maximum Students</span><span className="font-semibold text-slate-900">1 student</span></div>
            </div>
            <button type="button" onClick={() => handleChoosePackage('private')} disabled={loading} className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50">{loading && selectedPackage === 'private' ? 'Processing...' : 'Choose Package'}</button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">Semi-Private</h2><span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">Small Group</span></div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-slate-600">Price</span><span className="font-semibold text-slate-900">{paymentSettings ? `Rp${paymentSettings.semi_private_registration_fee.toLocaleString('id-ID')}` : 'Configured at checkout'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">Sessions</span><span className="font-semibold text-slate-900">8 meetings</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">Maximum Students</span><span className="font-semibold text-slate-900">4 students</span></div>
            </div>
            <button type="button" onClick={() => handleChoosePackage('semi_private')} disabled={loading} className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50">{loading && selectedPackage === 'semi_private' ? 'Processing...' : 'Choose Package'}</button>
          </div>
        </div>
      </div>
    </main>
  )
}
