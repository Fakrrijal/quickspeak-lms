import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ProfileForm } from '../../components/ProfileForm'
import { useProfile } from '../../hooks/useProfile'
import { useAuthContext } from '../../providers/AuthProvider'
import { getMyTeacherAttendanceGroups } from '../../services/teacher-attendance.service'

export const Route = createFileRoute('/teacher/profile')({ component: TeacherProfilePage })

function TeacherProfilePage() {
  const { isAuthenticated, loading: authLoading, profileLoading, profileError, role, status, user } = useAuthContext()
  const navigate = useNavigate()
  const canLoad = !authLoading && !profileLoading && isAuthenticated && !profileError && role === 'teacher' && status === 'active'
  const { profile, avatarUrl, loading, saving, error, success, saveProfile, reload } = useProfile(user?.id ?? null, canLoad)
  const groupsQuery = useQuery({ queryKey: ['teacher-attendance-groups', 'profile'], queryFn: getMyTeacherAttendanceGroups, enabled: canLoad })

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || profileError || status === null) navigate({ to: '/login', replace: true })
    else if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profileError, profileLoading, status])

  const teachingLevels = useMemo(() => [...new Set((groupsQuery.data ?? []).map((group) => group.level_name))].sort(), [groupsQuery.data])

  if (authLoading || profileLoading || loading) return <p>Loading...</p>
  if (!isAuthenticated || profileError || status === null || status === 'waiting') return null
  if (role !== 'teacher' || status !== 'active') return <p>Access denied.</p>

  return <section>
    <h2 className="text-3xl font-bold text-slate-900">Profile</h2>
    <p className="mt-2 text-slate-600">Manage your contact details and profile photo.</p>
    {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" onClick={() => void reload()} className="font-medium underline">Retry</button></p>}
    {success && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
    <ProfileForm avatarUrl={avatarUrl} profile={profile} saving={saving} levelTitle="Teaching Level" levelLabel={teachingLevels.join(', ') || 'No active teaching groups'} onSave={async (input, avatarFile) => saveProfile({ input, avatarFile })} />
  </section>
}
