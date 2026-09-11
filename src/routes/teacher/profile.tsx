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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Teacher Portal</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-[#102449]">Profile</h1>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">Manage your contact details, profile photo, and teaching information.</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
            Teacher
          </span>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
          <button type="button" onClick={() => void reload()} className="ml-2 font-bold underline">Retry</button>
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-5 sm:px-7">
          <h2 className="text-lg font-bold text-[#102449]">Personal Information</h2>
          <p className="mt-1 text-sm text-slate-600">Keep your teacher profile information up to date.</p>
        </div>
        <div className="px-6 py-6 sm:px-7 sm:py-7">
          <ProfileForm
            avatarUrl={avatarUrl}
            profile={profile}
            saving={saving}
            levelTitle="Teaching Level"
            levelLabel={teachingLevels.join(', ') || 'No active teaching groups'}
            onSave={async (input, avatarFile) => saveProfile({ input, avatarFile })}
          />
        </div>
      </section>
    </div>
  )
}
