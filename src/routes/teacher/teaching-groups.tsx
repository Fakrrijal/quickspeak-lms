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

  const summary = useMemo(() => ({
    groups: grouped.length,
    students: grouped.reduce((total, group) => total + group.students.length, 0),
    private: grouped.filter((group) => group.packageType !== 'semi_private').length,
    semiPrivate: grouped.filter((group) => group.packageType === 'semi_private').length,
  }), [grouped])

  if (authLoading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || !profile || profileError || status === null || status === 'waiting') return null
  if (role !== 'teacher' || status !== 'active') return <p>Access denied.</p>

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Teacher Portal</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#102449] sm:text-4xl">Teaching Groups</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Your currently assigned teaching groups and the students covered by each group.</p>
          </div>
          {!loading && !error && grouped.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Assigned Groups</p>
              <p className="mt-1 text-xl font-extrabold tracking-tight text-[#102449]">{summary.groups}</p>
            </div>
          )}
        </div>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />)}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">{error}</div>
      ) : grouped.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <h2 className="text-lg font-bold text-[#102449]">No teaching groups assigned</h2>
          <p className="mt-2 text-sm text-slate-600">Your active teaching groups will appear here once assigned.</p>
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Teaching Groups</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#102449]">{summary.groups}</p>
              <p className="mt-1 text-xs text-slate-500">Currently assigned to you</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Students Covered</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#102449]">{summary.students}</p>
              <p className="mt-1 text-xs text-slate-500">Across all teaching groups</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Private</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#102449]">{summary.private}</p>
              <p className="mt-1 text-xs text-slate-500">Assigned group type</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Semi-Private</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#102449]">{summary.semiPrivate}</p>
              <p className="mt-1 text-xs text-slate-500">Assigned group type</p>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {grouped.map((group) => (
              <article key={group.id} className="flex min-h-[290px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="border-b border-slate-100 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Teaching Group</p>
                      <h2 className="mt-1 truncate text-2xl font-bold tracking-[-0.02em] text-[#102449]">{group.name}</h2>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">{formatPackageType(group.packageType)}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">{group.level}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">{group.students.length} student{group.students.length === 1 ? '' : 's'}</span>
                  </div>
                </div>

                <div className="flex-1 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Student Coverage</p>
                      <p className="mt-1 text-sm text-slate-600">Students currently covered by this group.</p>
                    </div>
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-sm font-extrabold text-[#102449] ring-1 ring-slate-200">{group.students.length}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {group.students.map((student) => (
                      <div key={student.id} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-extrabold text-blue-700 shadow-sm">{student.name.slice(0, 1).toUpperCase()}</span>
                        <span className="truncate text-sm font-semibold text-slate-800">{student.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:px-6">
                  <Link to="/teacher/attendance" className="inline-flex w-full items-center justify-center rounded-xl bg-[#102449] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#17325f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">View Attendance <span aria-hidden="true" className="ml-2 text-base">→</span></Link>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
