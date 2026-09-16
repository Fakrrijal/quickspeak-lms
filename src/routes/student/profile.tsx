import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ProfileForm } from '../../components/ProfileForm'
import { useProfile } from '../../hooks/useProfile'
import { useAuthContext } from '../../providers/AuthProvider'
import { getMyActiveEnrollments } from '../../services/student-active-enrollment.service'

export const Route = createFileRoute('/student/profile')({ component: StudentProfilePage })

function StudentProfilePage() {
  const { isAuthenticated, loading: authLoading, profileLoading, profileError, role, status, user } = useAuthContext()
  const navigate = useNavigate()
  const canLoad = !authLoading && !profileLoading && isAuthenticated && !profileError && role === 'student' && status === 'active'
  const { profile, avatarUrl, loading, saving, error, success, saveProfile, reload } = useProfile(user?.id ?? null, canLoad)
  const enrollmentQuery = useQuery({ queryKey: ['my-active-enrollments', 'profile'], queryFn: getMyActiveEnrollments, enabled: canLoad })

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || profileError || status === null) navigate({ to: '/login', replace: true })
    else if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profileError, profileLoading, status])

  if (authLoading || profileLoading || loading) return <p>Loading...</p>
  if (!isAuthenticated || profileError || status === null || status === 'waiting') return null
  if (role !== 'student' || status !== 'active') return <p>Access denied.</p>

  const currentLevel = enrollmentQuery.data?.[0]?.level_name ?? 'No active enrollment'

  return (
    <section className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Student Profile</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-[-0.04em] text-[#102449]">Profile</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Manage your contact details and profile photo.</p>
      </header>

      {error && (
        <p role="alert" aria-live="polite" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error} <button type="button" onClick={() => void reload()} className="font-semibold underline">Retry</button>
        </p>
      )}
      {success && <p role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="personal-information-title">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Personal Information</p>
          <h2 id="personal-information-title" className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-[#102449]">Personal Information</h2>
          <p className="mt-1 text-sm text-slate-600">Keep your contact details and profile photo up to date.</p>
        </div>
        <ProfileForm avatarUrl={avatarUrl} profile={profile} saving={saving} levelTitle="Current Level" levelLabel={currentLevel} onSave={async (input, avatarFile) => saveProfile({ input, avatarFile })} />
      </section>
    </section>
  )
}
