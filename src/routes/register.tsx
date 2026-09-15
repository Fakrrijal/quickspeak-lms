import { useState, useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { authService, type SignUpRole } from '../services/auth.service'
import { registrationService, type Level } from '../services/registration.service'
import { reportSystemError } from '../lib/systemErrorReporter'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

const RESEND_COOLDOWN_SECONDS = 60
const RESEND_MAX_ATTEMPTS = 3
const RESEND_WINDOW_MS = 15 * 60 * 1000
const RESEND_STORAGE_PREFIX = 'quickspeak:verification-resend:'

type ResendState = {
  timestamps: number[]
  cooldownUntil: number
}

function getResendStorageKey(email: string) {
  return `${RESEND_STORAGE_PREFIX}${email.trim().toLowerCase()}`
}

function readResendState(email: string): ResendState {
  if (typeof window === 'undefined') {
    return { timestamps: [], cooldownUntil: 0 }
  }

  try {
    const raw = window.localStorage.getItem(getResendStorageKey(email))
    if (!raw) return { timestamps: [], cooldownUntil: 0 }

    const parsed = JSON.parse(raw) as Partial<ResendState>
    const now = Date.now()
    const timestamps = Array.isArray(parsed.timestamps)
      ? parsed.timestamps.filter(
          (timestamp): timestamp is number =>
            typeof timestamp === 'number' && now - timestamp < RESEND_WINDOW_MS,
        )
      : []

    return {
      timestamps,
      cooldownUntil:
        typeof parsed.cooldownUntil === 'number' ? parsed.cooldownUntil : 0,
    }
  } catch {
    return { timestamps: [], cooldownUntil: 0 }
  }
}

function writeResendState(email: string, state: ResendState) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(
    getResendStorageKey(email),
    JSON.stringify(state),
  )
}

function getRemainingSeconds(until: number) {
  return Math.max(0, Math.ceil((until - Date.now()) / 1000))
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function RegisterPage() {
  const [role, setRole] = useState<SignUpRole>('student')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendAttemptsRemaining, setResendAttemptsRemaining] = useState(RESEND_MAX_ATTEMPTS)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [studentStartingLevelId, setStudentStartingLevelId] = useState('')
  const [studentClassType, setStudentClassType] = useState<'private' | 'semi_private'>('private')
  const [teacherClassType, setTeacherClassType] = useState<'private' | 'semi_private'>('private')
  const [supportedLevelIds, setSupportedLevelIds] = useState<string[]>([])
  const [levels, setLevels] = useState<Level[]>([])
  const [loadingLevels, setLoadingLevels] = useState(true)

  useEffect(() => {
    registrationService.getLevels()
      .then(setLevels)
      .catch((err) => console.error('Failed to load levels:', err))
      .finally(() => setLoadingLevels(false))
  }, [])

  useEffect(() => {
    if (!success || !email.trim()) return

    const refreshResendState = () => {
      const state = readResendState(email)
      const now = Date.now()
      const cooldown = getRemainingSeconds(state.cooldownUntil)
      const timestamps = state.timestamps.filter(
        (timestamp) => now - timestamp < RESEND_WINDOW_MS,
      )

      if (timestamps.length !== state.timestamps.length || cooldown === 0) {
        writeResendState(email, {
          timestamps,
          cooldownUntil: cooldown === 0 ? 0 : state.cooldownUntil,
        })
      }

      setResendCooldown(cooldown)
      setResendAttemptsRemaining(
        Math.max(0, RESEND_MAX_ATTEMPTS - timestamps.length),
      )
    }

    refreshResendState()
    const interval = window.setInterval(refreshResendState, 1000)
    return () => window.clearInterval(interval)
  }, [success, email])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    setResendSuccess(false)

    try {
      if (role === 'student') {
        if (!studentStartingLevelId) {
          setError('Starting level is required')
          setLoading(false)
          return
        }
      } else if (role === 'teacher') {
        if (supportedLevelIds.length === 0) {
          setError('At least one supported level is required')
          setLoading(false)
          return
        }
      }

      const signUpResult = await authService.signUp({
        email,
        password,
        full_name: fullName,
        phone,
        role,
        ...(role === 'student'
          ? {
              student_starting_level_id: studentStartingLevelId,
              student_class_type: studentClassType,
            }
          : {
              teacher_class_type: teacherClassType,
              supported_level_ids: supportedLevelIds,
            }),
      })

      if (!signUpResult.user) {
        throw new Error('Registration could not be completed')
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
      await reportSystemError({
        feature: 'REGISTER',
        action: 'SIGN_UP',
        error: err,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Enter your email address first.')
      return
    }

    const state = readResendState(normalizedEmail)
    const now = Date.now()
    const recentTimestamps = state.timestamps.filter(
      (timestamp) => now - timestamp < RESEND_WINDOW_MS,
    )
    const cooldown = getRemainingSeconds(state.cooldownUntil)

    if (cooldown > 0) {
      setResendCooldown(cooldown)
      setError(`Please wait ${formatCountdown(cooldown)} before requesting another email.`)
      return
    }

    if (recentTimestamps.length >= RESEND_MAX_ATTEMPTS) {
      const oldestTimestamp = Math.min(...recentTimestamps)
      const retryAt = oldestTimestamp + RESEND_WINDOW_MS
      const waitSeconds = Math.max(1, Math.ceil((retryAt - now) / 1000))
      setResendAttemptsRemaining(0)
      setError(
        `You have reached the limit of ${RESEND_MAX_ATTEMPTS} verification emails within 15 minutes. Please try again in ${formatCountdown(waitSeconds)}.`,
      )
      return
    }

    setResendLoading(true)
    setResendSuccess(false)
    setError(null)

    try {
      await authService.resendConfirmationEmail(normalizedEmail)

      const updatedTimestamps = [...recentTimestamps, now]
      const updatedState: ResendState = {
        timestamps: updatedTimestamps,
        cooldownUntil: now + RESEND_COOLDOWN_SECONDS * 1000,
      }
      writeResendState(normalizedEmail, updatedState)
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
      setResendAttemptsRemaining(
        Math.max(0, RESEND_MAX_ATTEMPTS - updatedTimestamps.length),
      )
      setResendSuccess(true)
    } catch (err) {
      await reportSystemError({
        feature: 'REGISTER',
        action: 'RESEND_CONFIRMATION_EMAIL',
        error: err,
      })
      setError(
        err instanceof Error
          ? err.message
          : 'Could not resend the confirmation email.',
      )
    } finally {
      setResendLoading(false)
    }
  }

  if (success) {
    const resendBlocked = resendLoading || resendCooldown > 0 || resendAttemptsRemaining === 0

    return (
      <div className="mx-auto max-w-lg py-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_18px_50px_rgba(15,35,75,0.08)] sm:p-9">
          <div className="text-center">
            <img src="/favicon.svg" alt="QuickSpeak" className="mx-auto h-14 w-14" />
            <div className="mt-2 text-[17px] font-extrabold tracking-[-0.02em] text-[#102449]">QuickSpeak</div>
            <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.3em] text-[#1b5dd7]">English</div>
            <h1 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-[#102449]">Registration successful</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Your registration has been received and is waiting for Admin approval.</p>
          </div>

          <p className="mt-6 text-sm leading-6 text-slate-600">Please check your inbox to confirm your email address before signing in.</p>

          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm leading-5 text-amber-900">Haven&apos;t received the confirmation email yet? Send it again to <span className="font-semibold">{email}</span>.</p>
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resendBlocked}
              className="mt-3 h-11 w-full rounded-lg border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resendLoading
                ? 'Sending...'
                : resendCooldown > 0
                  ? `Resend available in ${formatCountdown(resendCooldown)}`
                  : resendAttemptsRemaining === 0
                    ? 'Resend limit reached'
                    : 'Resend Verification Email'}
            </button>
            <p className="mt-2 text-xs leading-5 text-amber-800">
              {resendAttemptsRemaining > 0
                ? `${resendAttemptsRemaining} resend attempt${resendAttemptsRemaining === 1 ? '' : 's'} remaining in this 15-minute window.`
                : 'The resend limit will reset after the 15-minute window expires.'}
            </p>
            {resendSuccess && <p className="mt-2 text-sm text-green-700">A new verification email has been sent. Please check your inbox.</p>}
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <p className="mt-6 text-center text-sm text-slate-600">
            Already confirmed?{' '}
            <Link to="/login" className="font-semibold text-[#1b5dd7] hover:text-[#154fb7] hover:underline">Login</Link>
          </p>
        </section>
      </div>
    )
  }

  const fieldClass = 'h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1b5dd7] focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100'
  const optionClass = (selected: boolean) => selected
    ? 'border-[#1b5dd7] bg-[#1b5dd7] text-white shadow-sm'
    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'

  return (
    <div className="mx-auto max-w-lg py-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_18px_50px_rgba(15,35,75,0.08)] sm:p-9">
        <div className="text-center">
          <img src="/favicon.svg" alt="QuickSpeak" className="mx-auto h-14 w-14" />
          <div className="mt-2 text-[17px] font-extrabold tracking-[-0.02em] text-[#102449]">QuickSpeak</div>
          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.3em] text-[#1b5dd7]">English</div>
          <h1 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-[#102449]">Create your account</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Register for your QuickSpeak learning account.</p>
        </div>

        <form onSubmit={handleRegister} className="mt-7 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Full name</span>
            <input type="text" placeholder="Enter your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={fieldClass} />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Email</span>
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={fieldClass} autoComplete="email" />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Phone / WhatsApp</span>
            <input type="tel" placeholder="08xxxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} required className={fieldClass} autoComplete="tel" />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className={`${fieldClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-400 transition hover:text-[#102449]"
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 102.8 2.8M9.9 4.2A10.7 10.7 0 0112 4c5.2 0 9.1 3.2 10.5 8a10.9 10.9 0 01-3.1 5M6.1 6.1C3.9 7.6 2.3 9.5 1.5 12 2.9 16.8 6.8 20 12 20c1.7 0 3.2-.3 4.6-.9" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                )}
              </button>
            </div>
            <span className="mt-2 block text-xs text-slate-500">Use at least 6 characters.</span>
          </label>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Register as</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setRole('student')} className={`h-12 rounded-xl border px-4 font-semibold transition ${optionClass(role === 'student')}`}>Student</button>
              <button type="button" onClick={() => setRole('teacher')} className={`h-12 rounded-xl border px-4 font-semibold transition ${optionClass(role === 'teacher')}`}>Teacher</button>
            </div>
          </div>

          {role === 'student' && (
            <>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Starting level</span>
                <select
                  value={studentStartingLevelId}
                  onChange={(e) => setStudentStartingLevelId(e.target.value)}
                  disabled={loadingLevels || loading}
                  required
                  className={fieldClass}
                >
                  <option value="">{loadingLevels ? 'Loading levels...' : 'Select a level'}</option>
                  {!loadingLevels && levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
                </select>
              </label>

              <div>
                <p className="mb-2 block text-sm font-semibold text-slate-700">Class type</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setStudentClassType('private')} className={`h-12 rounded-xl border px-4 font-semibold transition ${optionClass(studentClassType === 'private')}`}>Private</button>
                  <button type="button" onClick={() => setStudentClassType('semi_private')} className={`h-12 rounded-xl border px-4 font-semibold transition ${optionClass(studentClassType === 'semi_private')}`}>Semi-private</button>
                </div>
              </div>
            </>
          )}

          {role === 'teacher' && (
            <>
              <div>
                <p className="mb-2 block text-sm font-semibold text-slate-700">Supported levels</p>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {loadingLevels ? (
                    <p className="px-2 py-1 text-sm text-slate-500">Loading levels...</p>
                  ) : (
                    <div className="space-y-2">
                      {levels.map((level) => (
                        <label key={level.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white">
                          <input
                            type="checkbox"
                            checked={supportedLevelIds.includes(level.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSupportedLevelIds([...supportedLevelIds, level.id])
                              else setSupportedLevelIds(supportedLevelIds.filter((id) => id !== level.id))
                            }}
                            disabled={loading}
                            className="h-4 w-4 rounded border-slate-300 text-[#1b5dd7] focus:ring-[#1b5dd7]"
                          />
                          <span className="text-sm text-slate-700">{level.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 block text-sm font-semibold text-slate-700">Class type</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setTeacherClassType('private')} className={`h-12 rounded-xl border px-4 font-semibold transition ${optionClass(teacherClassType === 'private')}`}>Private</button>
                  <button type="button" onClick={() => setTeacherClassType('semi_private')} className={`h-12 rounded-xl border px-4 font-semibold transition ${optionClass(teacherClassType === 'semi_private')}`}>Semi-private</button>
                </div>
              </div>
            </>
          )}

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">{error}</div>}

          <button
            type="submit"
            disabled={loading || loadingLevels}
            className="h-12 w-full rounded-xl bg-[#1b5dd7] px-4 font-semibold text-white shadow-sm transition hover:bg-[#154fb7] focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#1b5dd7] transition hover:text-[#154fb7] hover:underline">Login</Link>
        </p>
      </section>
    </div>
  )
}
