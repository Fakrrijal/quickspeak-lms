import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { getMyTeacherAttendanceGroups } from '../../services/teacher-attendance.service'

export const Route = createFileRoute('/teacher/teaching-groups')({ component: TeacherTeachingGroupsPage })

function formatPackageType(value: string) {
  return value === 'semi_private' ? 'Semi-Private' : 'Private'
}

function TeacherTeachingGroupsPage() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<Awaited<ReturnType<typeof getMyTeacherAttendanceGroups>>>([])

  const canLoad = !authLoading && !profileLoading && isAuthenticated && Boolean(profile) && !profileError && role === 'teacher' && status === 'active'

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || !profile || profileError || status === null) navigate({ to: '/login', replace: true })
    else if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  useEffect(() => {
    if (!canLoad) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getMyTeacherAttendanceGroups()
      .then((data) => {
        if (cancelled) return
        setGroups(data)
        setLoading(false)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load teaching groups')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [canLoad])

  const grouped = useMemo(() => {
    return groups.map((group) => ({
      id: group.teaching_group_id,
      name: group.teaching_group_name,
      level: group.level_name,
      packageType: group.package_type,
      students: group.students.map((student) => ({ id: student.student_id, name: student.student_display_name })),
    }))
  }, [groups])

  if (authLoading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || !profile || profileError || status === null || status === 'waiting') return null
  if (role !== 'teacher' || status !== 'active') return <p>Access denied.</p>

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Teacher Portal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#102449] sm:text-4xl">Teaching Groups</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Your currently assigned teaching groups and student coverage.</p>
      </header>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">{[1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">{error}</div>
      ) : grouped.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"><h2 className="text-lg font-bold text-[#102449]">No teaching groups assigned</h2><p className="mt-2 text-sm text-slate-600">Your active teaching groups will appear here once assigned.</p></section>
      ) : (
        <section className="grid gap-5 lg:grid-cols-2">
          {grouped.map((group) => (
            <article key={group.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Teaching Group</p>
                  <h2 className="mt-1 text-xl font-bold text-[#102449]">{group.name}</h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">{group.level}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">{formatPackageType(group.packageType)}</span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{group.students.length} student{group.students.length === 1 ? '' : 's'}</span>
                  </div>
                </div>
                <Link to="/teacher/attendance" className="inline-flex w-fit rounded-lg bg-[#102449] px-3.5 py-2.5 text-sm font-bold text-white hover:bg-[#17325f]">View Attendance</Link>
              </div>
              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500">Students</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {group.students.map((student) => <div key={student.id} className="rounded-xl bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-800">{student.name}</div>)}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
