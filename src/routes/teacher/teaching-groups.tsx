import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { getMyTeacherTeachingGroups, type TeacherTeachingGroup } from '../../services/teacher-teaching-group.service'
import { TeacherScheduleEditor } from '../../components/teacher/TeacherScheduleEditor'
import {
  getMyTeacherFeedbackReceived,
  type TeacherFeedbackReceived,
} from '../../services/teacher-feedback.service'

export const Route = createFileRoute('/teacher/teaching-groups')({ component: TeacherTeachingGroupsPage })

const PAGE_SIZE = 10

function formatPackageType(value: string) {
  return value === 'semi_private' ? 'Semi-Private' : 'Private'
}

function formatRosterStatus(status: TeacherTeachingGroup['students'][number]['roster_status']) {
  switch (status) {
    case 'waiting_renewal':
      return 'Waiting Renewal'
    case 'waiting_next_level':
      return 'Waiting Next Level'
    case 'level_completed':
      return 'Level Completed'
    case 'waiting_assignment':
      return 'Waiting Assignment'
    default:
      return 'Active'
  }
}

function rosterStatusClass(status: TeacherTeachingGroup['students'][number]['roster_status']) {
  switch (status) {
    case 'waiting_renewal':
      return 'bg-amber-50 text-amber-700'
    case 'waiting_next_level':
      return 'bg-violet-50 text-violet-700'
    case 'level_completed':
      return 'bg-slate-100 text-slate-700'
    case 'waiting_assignment':
      return 'bg-blue-50 text-blue-700'
    default:
      return 'bg-emerald-50 text-emerald-700'
  }
}

function Pagination({ page, totalItems, onPageChange }: { page: number; totalItems: number; onPageChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const showingStart = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const showingEnd = Math.min(page * PAGE_SIZE, totalItems)

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold text-slate-500">Showing {showingStart}–{showingEnd} of {totalItems}</p>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button type="button" aria-label="Previous page" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">‹</button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
          <button key={pageNumber} type="button" aria-label={`Page ${pageNumber}`} aria-current={page === pageNumber ? 'page' : undefined} onClick={() => onPageChange(pageNumber)} className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-medium ${page === pageNumber ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700'}`}>{pageNumber}</button>
        ))}
        <button type="button" aria-label="Next page" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">›</button>
      </nav>
    </div>
  )
}

function TeacherTeachingGroupsPage() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<TeacherTeachingGroup[]>([])
  const [search, setSearch] = useState('')
  const [groupType, setGroupType] = useState<'all' | 'private' | 'semi_private'>('all')
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [groupPage, setGroupPage] = useState(1)
  const [studentPage, setStudentPage] = useState(1)
  const [teacherFeedback, setTeacherFeedback] = useState<TeacherFeedbackReceived[]>([])
  const [teacherFeedbackLoading, setTeacherFeedbackLoading] = useState(false)
  const [teacherFeedbackError, setTeacherFeedbackError] = useState(false)
  const [isTeacherFeedbackOpen, setIsTeacherFeedbackOpen] = useState(false)

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
    getMyTeacherTeachingGroups()
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
      students: group.students.map((student) => ({ id: student.student_id, name: student.student_display_name, status: student.roster_status })),
    }))
  }, [groups])

  const summary = useMemo(() => ({
    groups: grouped.length,
    students: grouped.reduce((total, group) => total + group.students.length, 0),
    private: grouped.filter((group) => group.packageType !== 'semi_private').length,
    semiPrivate: grouped.filter((group) => group.packageType === 'semi_private').length,
  }), [grouped])

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase()
    return grouped.filter((group) => {
      const matchesType = groupType === 'all' || group.packageType === groupType
      if (!matchesType) return false
      if (!term) return true
      const groupMatches = group.name.toLowerCase().includes(term) || group.level.toLowerCase().includes(term)
      const studentMatches = group.students.some((student) => student.name.toLowerCase().includes(term))
      return groupMatches || studentMatches
    })
  }, [groupType, grouped, search])

  const paginatedGroups = useMemo(() => filteredGroups.slice((groupPage - 1) * PAGE_SIZE, groupPage * PAGE_SIZE), [filteredGroups, groupPage])

  const selectedGroup = grouped.find((group) => group.id === selectedGroupId) ?? null
  const paginatedStudents = useMemo(() => selectedGroup?.students.slice((studentPage - 1) * PAGE_SIZE, studentPage * PAGE_SIZE) ?? [], [selectedGroup, studentPage])

  useEffect(() => {
    if (selectedGroupId && !grouped.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(null)
    }
  }, [grouped, selectedGroupId])

  useEffect(() => {
    setGroupPage(1)
  }, [groupType, search])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE))
    if (groupPage > totalPages) setGroupPage(totalPages)
  }, [filteredGroups.length, groupPage])

  useEffect(() => {
    setStudentPage(1)
  }, [selectedGroupId])

  useEffect(() => {
    if (!canLoad) return

    let cancelled = false
    setTeacherFeedbackLoading(true)
    setTeacherFeedbackError(false)

    getMyTeacherFeedbackReceived()
      .then((data) => {
        if (cancelled) return
        setTeacherFeedback(data)
      })
      .catch(() => {
        if (cancelled) return
        setTeacherFeedback([])
        setTeacherFeedbackError(true)
      })
      .finally(() => {
        if (!cancelled) setTeacherFeedbackLoading(false)
      })

    return () => { cancelled = true }
  }, [canLoad])

  const teacherFeedbackAverage = useMemo(() => {
    const rated = teacherFeedback.filter((item) => item.rating !== null)
    if (rated.length === 0) return null
    return rated.reduce((total, item) => total + (item.rating ?? 0), 0) / rated.length
  }, [teacherFeedback])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((selectedGroup?.students.length ?? 0) / PAGE_SIZE))
    if (studentPage > totalPages) setStudentPage(totalPages)
  }, [selectedGroup?.students.length, studentPage])

  if (authLoading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || !profile || profileError || status === null || status === 'waiting') return null
  if (role !== 'teacher' || status !== 'active') return <p>Access denied.</p>

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Teacher Portal</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#102449] sm:text-4xl">Teaching Groups</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Manage your assigned classes, students, and teaching groups.</p>
        </div>
      </header>

      {loading ? (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">{error}</div>
      ) : selectedGroup ? (
        <section className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
              <div>
                <button type="button" onClick={() => setSelectedGroupId(null)} className="text-sm font-bold text-blue-700 hover:underline">← Back to teaching groups</button>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Teaching Group</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.02em] text-[#102449]">{selectedGroup.name}</h2>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">{selectedGroup.level}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">{formatPackageType(selectedGroup.packageType)}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">{selectedGroup.students.length} student{selectedGroup.students.length === 1 ? '' : 's'}</span>
                </div>
              </div>
              <Link to="/teacher/attendance" className="inline-flex items-center justify-center rounded-xl bg-[#102449] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f]">View Attendance <span aria-hidden="true" className="ml-2">→</span></Link>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Students</p>
                <p className="mt-1 text-xl font-extrabold text-[#102449]">{selectedGroup.students.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Level</p>
                <p className="mt-1 text-base font-extrabold text-[#102449]">{selectedGroup.level}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Package</p>
                <p className="mt-1 text-base font-extrabold text-[#102449]">{formatPackageType(selectedGroup.packageType)}</p>
              </div>
            </div>

            <TeacherScheduleEditor teachingGroupId={selectedGroup.id} />

            <div className="border-t border-slate-200 px-5 py-5 sm:px-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Student Roster</p>
                  <h3 className="mt-1 text-lg font-bold text-[#102449]">Students in this group</h3>
                </div>
                <span className="text-sm font-semibold text-slate-500">{selectedGroup.students.length} student{selectedGroup.students.length === 1 ? '' : 's'}</span>
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                <div className="divide-y divide-slate-100">
                  {paginatedStudents.map((student) => (
                    <div key={student.id} className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-slate-50">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-extrabold text-blue-700">{student.name.slice(0, 1).toUpperCase()}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{student.name}</p>
                          <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${rosterStatusClass(student.status)}`}>
                            {formatRosterStatus(student.status)}
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-slate-500">{selectedGroup.level}</span>
                    </div>
                  ))}
                </div>
                <Pagination page={studentPage} totalItems={selectedGroup.students.length} onPageChange={setStudentPage} />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Teaching Groups', summary.groups, 'Currently assigned to you'],
              ['Students Covered', summary.students, 'Across all teaching groups'],
              ['Private', summary.private, 'Assigned group type'],
              ['Semi-Private', summary.semiPrivate, 'Assigned group type'],
            ].map(([label, value, note]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#102449]">{value}</p>
                <p className="mt-1 text-xs text-slate-500">{note}</p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">My Rating</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <p className="text-2xl font-extrabold text-[#102449]">
                    {teacherFeedbackLoading
                      ? 'Loading...'
                      : teacherFeedback.length === 0
                        ? 'No ratings yet'
                        : String(teacherFeedbackAverage?.toFixed(1) ?? '—') + '/5'}
                  </p>
                  {!teacherFeedbackLoading && teacherFeedback.length > 0 && teacherFeedbackAverage !== null && (
                    <span className="text-lg tracking-[0.08em] text-amber-400" aria-label={`Overall rating ${teacherFeedbackAverage.toFixed(1)} out of 5`}>
                      {'★'.repeat(Math.round(teacherFeedbackAverage))}{'☆'.repeat(5 - Math.round(teacherFeedbackAverage))}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {teacherFeedbackError
                    ? 'Feedback belum dapat dimuat.'
                    : teacherFeedback.length === 0
                      ? 'Belum ada student yang mengirim feedback.'
                      : String(teacherFeedback.length) + ' response' + (teacherFeedback.length === 1 ? '' : 's')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTeacherFeedbackOpen(true)}
                disabled={teacherFeedbackLoading || teacherFeedback.length === 0 || teacherFeedbackError}
                className="inline-flex items-center justify-center rounded-xl bg-[#102449] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                View Feedback
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:px-5">
              <div className="min-w-0 flex-1">
                <label className="sr-only" htmlFor="teaching-groups-search">Search group or student</label>
                <input
                  id="teaching-groups-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search group or student..."
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <select
                value={groupType}
                onChange={(event) => setGroupType(event.target.value as 'all' | 'private' | 'semi_private')}
                className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                aria-label="Filter group type"
              >
                <option value="all">All Types</option>
                <option value="private">Private</option>
                <option value="semi_private">Semi-Private</option>
              </select>
            </div>
            <div className="px-5 py-3 text-xs font-semibold text-slate-500">{filteredGroups.length} teaching group{filteredGroups.length === 1 ? '' : 's'}</div>
          </section>

          {filteredGroups.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              <h2 className="text-lg font-bold text-[#102449]">No matching teaching groups</h2>
              <p className="mt-2 text-sm text-slate-600">Try another group or student name, or reset the filter.</p>
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div>
                <div className="sticky top-0 z-10 hidden grid-cols-[minmax(0,1fr)_110px_125px_90px_40px] border-b border-slate-200 bg-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 sm:grid">
                  <span>Teaching Group</span>
                  <span>Level</span>
                  <span>Type</span>
                  <span>Students</span>
                  <span aria-hidden="true" />
                </div>
                <div className="divide-y divide-slate-100">
                  {paginatedGroups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setSelectedGroupId(group.id)}
                      className="grid w-full grid-cols-1 gap-2 px-4 py-3 text-left transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_110px_125px_90px_40px] sm:items-center"
                    >
                      <span className="min-w-0 truncate text-sm font-bold text-[#102449]">{group.name}</span>
                      <span className="text-sm font-semibold text-slate-600">{group.level}</span>
                      <span className="text-sm text-slate-600">{formatPackageType(group.packageType)}</span>
                      <span className="text-sm font-semibold text-slate-700">{group.students.length}</span>
                      <span className="flex justify-end text-lg font-bold text-blue-700" aria-hidden="true">→</span>
                    </button>
                  ))}
                </div>
                <Pagination page={groupPage} totalItems={filteredGroups.length} onPageChange={setGroupPage} />
              </div>
            </section>
          )}
        </>
      )}

      {isTeacherFeedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-feedback-dialog-title"
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Student Feedback</p>
                <h3 id="teacher-feedback-dialog-title" className="mt-1 text-xl font-extrabold text-[#102449]">Student Feedback</h3>
                <p className="mt-1 text-sm text-slate-500">Riwayat feedback dari seluruh teaching group. Identitas student tidak ditampilkan.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsTeacherFeedbackOpen(false)}
                aria-label="Close feedback dialog"
                className="rounded-lg px-2 py-1 text-lg font-bold text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto p-5 sm:p-6">
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Overall Rating</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="text-xl font-extrabold text-[#102449]">{teacherFeedbackAverage?.toFixed(1) ?? '—'}/5</span>
                  {teacherFeedbackAverage !== null && (
                    <span className="tracking-[0.08em] text-amber-400">
                      {'★'.repeat(Math.round(teacherFeedbackAverage))}{'☆'.repeat(5 - Math.round(teacherFeedbackAverage))}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-slate-500">{teacherFeedback.length} response{teacherFeedback.length === 1 ? '' : 's'}</span>
                </div>
              </div>

              <div className="space-y-3">
                {teacherFeedback.map((item) => (
                  <article key={item.level_result_id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-slate-500">{item.level_name}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{item.teaching_group_name ?? 'Historical group unavailable'} · {new Intl.DateTimeFormat('id-ID').format(new Date(item.submitted_at))}</p>
                      </div>
                      <span className="text-sm font-bold tracking-[0.06em] text-amber-500">
                        {renderTeacherFeedbackStars(item.rating)}
                      </span>
                    </div>
                    {item.comment && (
                      <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{item.comment}</p>
                    )}
                  </article>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 p-4 text-right sm:p-5">
              <button
                type="button"
                onClick={() => setIsTeacherFeedbackOpen(false)}
                className="rounded-xl bg-[#102449] px-4 py-2.5 text-sm font-bold text-white"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function renderTeacherFeedbackStars(rating: number | null) {
  if (!rating) return 'No rating'
  return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`
}
