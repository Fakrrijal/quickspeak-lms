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

  return <section>
    <h2 className="text-3xl font-bold text-slate-900">Profile</h2>
    <p className="mt-2 text-slate-600">Manage your contact details and profile photo.</p>
    {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" onClick={() => void reload()} className="font-medium underline">Retry</button></p>}
    {success && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
    <ProfileForm avatarUrl={avatarUrl} profile={profile} saving={saving} levelTitle="Current Level" levelLabel={currentLevel} onSave={async (input, avatarFile) => saveProfile({ input, avatarFile })} />
  </section>
}
