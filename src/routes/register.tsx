import { useState, useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { authService, type SignUpRole } from '../services/auth.service'
import { registrationService, type Level } from '../services/registration.service'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const [role, setRole] = useState<SignUpRole>('student')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Student-specific fields
  const [studentStartingLevelId, setStudentStartingLevelId] = useState('')
  const [studentClassType, setStudentClassType] = useState<'private' | 'semi_private'>('private')

  // Teacher-specific fields
  const [teacherClassType, setTeacherClassType] = useState<'private' | 'semi_private'>('private')
  const [supportedLevelIds, setSupportedLevelIds] = useState<string[]>([])

  // Available levels
  const [levels, setLevels] = useState<Level[]>([])
  const [loadingLevels, setLoadingLevels] = useState(true)

  // Load levels on mount
  useEffect(() => {
    registrationService.getLevels()
      .then(setLevels)
      .catch((err) => console.error('Failed to load levels:', err))
      .finally(() => setLoadingLevels(false))
  }, [])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Validate role-specific fields
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

      // The database provisions both the profile and its application in the
      // Auth-user creation transaction. This works whether email confirmation
      // returns a session now or only after the email is confirmed.
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

      // Email confirmation is enabled, so a successful signup normally has no
      // session yet. A valid user and no Auth error is the registration success
      // condition; the database trigger created the waiting application.
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            Registration Successful
          </h2>

          <p className="mt-4 text-sm text-slate-600">
            Your registration has been received and is waiting for Admin approval.
          </p>

          <p className="mt-4 text-sm text-slate-600">
            Please check your inbox to confirm your email address before signing in.
          </p>

          <p className="mt-6 text-sm text-slate-600">
            Already confirmed?{' '}
            <Link
              to="/login"
              className="font-medium underline"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">
          Register
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Create your QuickSpeak LMS account.
        </p>

        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Register as
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`rounded-lg border px-4 py-3 font-medium ${
                  role === 'student'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                Student
              </button>

              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={`rounded-lg border px-4 py-3 font-medium ${
                  role === 'teacher'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                Teacher
              </button>
            </div>
          </div>

          {/* Student-specific fields */}
          {role === 'student' && (
            <>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Starting Level
                </p>
                <select
                  value={studentStartingLevelId}
                  onChange={(e) => setStudentStartingLevelId(e.target.value)}
                  disabled={loadingLevels || loading}
                  required
                  className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">Select a level</option>
                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Class Type
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStudentClassType('private')}
                    className={`rounded-lg border px-4 py-3 font-medium ${
                      studentClassType === 'private'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    Private
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentClassType('semi_private')}
                    className={`rounded-lg border px-4 py-3 font-medium ${
                      studentClassType === 'semi_private'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    Semi-private
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Teacher-specific fields */}
          {role === 'teacher' && (
            <>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Supported Levels
                </p>
                <div className="space-y-2">
                  {levels.map((level) => (
                    <label key={level.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={supportedLevelIds.includes(level.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSupportedLevelIds([...supportedLevelIds, level.id])
                          } else {
                            setSupportedLevelIds(supportedLevelIds.filter((id) => id !== level.id))
                          }
                        }}
                        disabled={loadingLevels || loading}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">{level.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Class Type
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTeacherClassType('private')}
                    className={`rounded-lg border px-4 py-3 font-medium ${
                      teacherClassType === 'private'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    Private
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherClassType('semi_private')}
                    className={`rounded-lg border px-4 py-3 font-medium ${
                      teacherClassType === 'semi_private'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    Semi-private
                  </button>
                </div>
              </div>
            </>
          )}

          <input
            type="text"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
          />

          <input
            type="tel"
            placeholder="Phone / WhatsApp"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:ring-2"
          />

          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium underline"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}
