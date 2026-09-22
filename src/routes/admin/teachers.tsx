import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import {
  addTeacherLevel,
  deactivateTeacher,
  getLevels,
  getTeachers,
  removeTeacherLevel,
  type ActiveLevel,
  type AdminTeacher,
} from '../../services/admin.service'
import {
  getAdminTeacherFeedback,
  type AdminTeacherFeedback,
} from '../../services/teacher-feedback.service'

export const Route = createFileRoute('/admin/teachers')({
  component: AdminTeachersPage,
})

function AdminTeachersPage() {
  const {
    isAuthenticated,
    loading,
    profileLoading,
    profileError,
    role,
    status,
  } = useAuthContext()
  const navigate = useNavigate()
  const [teachers, setTeachers] = useState<AdminTeacher[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [levelFilter, setLevelFilter] = useState('all')
  const [classTypeFilter, setClassTypeFilter] = useState<'all' | 'private' | 'semi_private'>('all')
  const [levels, setLevels] = useState<ActiveLevel[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [editingTeacher, setEditingTeacher] = useState<AdminTeacher | null>(null)
  const [selectedLevelIds, setSelectedLevelIds] = useState<string[]>([])
  const [editError, setEditError] = useState<string | null>(null)
  const [isSavingLevels, setIsSavingLevels] = useState(false)
  const [isRemovingTeacher, setIsRemovingTeacher] = useState(false)
  const [isRemoveConfirmationOpen, setIsRemoveConfirmationOpen] = useState(false)
  const [selectedFeedbackTeacher, setSelectedFeedbackTeacher] = useState<AdminTeacher | null>(null)
  const [adminTeacherFeedback, setAdminTeacherFeedback] = useState<AdminTeacherFeedback[]>([])
  const [adminTeacherFeedbackLoading, setAdminTeacherFeedbackLoading] = useState(false)
  const [adminTeacherFeedbackError, setAdminTeacherFeedbackError] = useState<string | null>(null)
  const pageSize = 10

  useEffect(() => {
    if (loading || profileLoading) {
      return
    }

    if (!isAuthenticated || profileError || status === null) {
      navigate({ to: '/login' })
      return
    }

    if (status !== 'active') {
      navigate({ to: '/waiting' })
    }
  }, [isAuthenticated, loading, navigate, profileError, profileLoading, status])

  const loadTeachers = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      setTeachers(await getTeachers())
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load teachers.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadLevels = useCallback(async () => {
    try {
      setLevels(await getLevels())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load levels.')
    }
  }, [])

  const canViewTeachers =
    isAuthenticated && role === 'admin' && status === 'active'

  useEffect(() => {
    if (canViewTeachers) {
      void loadTeachers()
      void loadLevels()
    }
  }, [canViewTeachers, loadLevels, loadTeachers])

  const filteredTeachers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return teachers.filter((teacher) => {
      const matchesSearch = !normalizedSearch
        || teacher.profiles?.full_name.toLowerCase().includes(normalizedSearch)
        || teacher.teacher_code.toLowerCase().includes(normalizedSearch)
        || teacher.profiles?.email.toLowerCase().includes(normalizedSearch)
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' ? teacher.is_active : !teacher.is_active)
      const matchesLevel = levelFilter === 'all' || teacher.eligible_levels.some((level) => level.id === levelFilter)
      const matchesClassType = classTypeFilter === 'all' || teacher.active_class_types.includes(classTypeFilter)
      return matchesSearch && matchesStatus && matchesLevel && matchesClassType
    })
  }, [classTypeFilter, levelFilter, search, statusFilter, teachers])

  useEffect(() => {
    setCurrentPage(1)
  }, [classTypeFilter, levelFilter, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredTeachers.length / pageSize))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedTeachers = useMemo(
    () => filteredTeachers.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredTeachers],
  )

  const openTeacherEditor = (teacher: AdminTeacher) => {
    setEditingTeacher(teacher)
    setSelectedLevelIds(teacher.eligible_levels.map((level) => level.id))
    setEditError(null)
  }

  const closeTeacherEditor = () => {
    if (isSavingLevels || isRemovingTeacher) return
    setEditingTeacher(null)
    setSelectedLevelIds([])
    setEditError(null)
    setIsRemoveConfirmationOpen(false)
  }

  const openTeacherFeedback = async (teacher: AdminTeacher) => {
    setSelectedFeedbackTeacher(teacher)
    setAdminTeacherFeedback([])
    setAdminTeacherFeedbackError(null)
    setAdminTeacherFeedbackLoading(true)

    try {
      setAdminTeacherFeedback(await getAdminTeacherFeedback(teacher.id))
    } catch (feedbackLoadError) {
      setAdminTeacherFeedbackError(
        feedbackLoadError instanceof Error
          ? feedbackLoadError.message
          : 'Unable to load teacher feedback.',
      )
    } finally {
      setAdminTeacherFeedbackLoading(false)
    }
  }

  const removeTeacher = async () => {
    if (!editingTeacher) return

    setIsRemovingTeacher(true)
    setEditError(null)
    try {
      await deactivateTeacher(editingTeacher.id)
      await loadTeachers()
      setEditingTeacher(null)
      setSelectedLevelIds([])
      setIsRemoveConfirmationOpen(false)
    } catch (removeError) {
      setEditError(removeError instanceof Error ? removeError.message : 'Unable to remove this teacher.')
    } finally {
      setIsRemovingTeacher(false)
    }
  }

  const toggleSelectedLevel = (levelId: string) => {
    setSelectedLevelIds((current) => current.includes(levelId)
      ? current.filter((id) => id !== levelId)
      : [...current, levelId])
  }

  const saveTeacherLevels = async () => {
    if (!editingTeacher) return

    const currentLevelIds = new Set(editingTeacher.eligible_levels.map((level) => level.id))
    const nextLevelIds = new Set(selectedLevelIds)
    const additions = selectedLevelIds.filter((levelId) => !currentLevelIds.has(levelId))
    const removals = [...currentLevelIds].filter((levelId) => !nextLevelIds.has(levelId))

    if (additions.length === 0 && removals.length === 0) {
      closeTeacherEditor()
      return
    }

    setIsSavingLevels(true)
    setEditError(null)
    try {
      await Promise.all(additions.map((levelId) => addTeacherLevel(editingTeacher.id, levelId)))
      await Promise.all(removals.map((levelId) => removeTeacherLevel(editingTeacher.id, levelId)))
      await loadTeachers()
      setEditingTeacher(null)
      setSelectedLevelIds([])
    } catch (saveError) {
      await loadTeachers()
      setEditError(saveError instanceof Error ? saveError.message : 'Unable to update teaching eligibility.')
    } finally {
      setIsSavingLevels(false)
    }
  }

  if (loading || profileLoading) {
    return <p>Loading...</p>
  }

  if (!isAuthenticated || profileError || status === null || status !== 'active') {
    return null
  }

  if (role !== 'admin') {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <h2 className="text-xl font-semibold">Access denied</h2>
        <p className="mt-2">You do not have permission to view teachers.</p>
      </section>
    )
  }

  const showingStart = filteredTeachers.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1
  const showingEnd = Math.min(currentPage * pageSize, filteredTeachers.length)

  return (
    <section>
      <h2 className="text-3xl font-bold text-slate-900">Teacher Management</h2>
      <p className="mt-2 text-slate-600">View teacher assignments and review waiting teacher registrations.</p>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-slate-900">Teacher Directory</h3>
        <div className="mt-5 flex flex-col gap-3 md:flex-row">
          <label className="flex-1">
            <span className="sr-only">Search teachers</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search teacher..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
              className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Level
            <select
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value)}
              className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">All levels</option>
              {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Class Type
            <select
              value={classTypeFilter}
              onChange={(event) => setClassTypeFilter(event.target.value as 'all' | 'private' | 'semi_private')}
              className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">All types</option>
              <option value="private">Private</option>
              <option value="semi_private">Semi-private</option>
            </select>
          </label>
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
          {isLoading && <p className="p-6 text-sm text-slate-600">Loading teachers...</p>}
          {error && <p className="m-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">Unable to load teachers: {error}</p>}
          {!isLoading && !error && filteredTeachers.length === 0 && (
            <p className="p-6 text-sm text-slate-600">No teachers match the current search or filter.</p>
          )}

          {!isLoading && !error && filteredTeachers.length > 0 && (
            <>
              <table className="w-full table-fixed divide-y divide-slate-200 text-left text-sm">
                <colgroup>
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Teacher</th>
                    <th className="px-3 py-3 font-semibold">Contact</th>
                    <th className="px-3 py-3 font-semibold">Eligibility</th>
                    <th className="px-3 py-3 font-semibold">Joined</th>
                    <th className="px-3 py-3 font-semibold">Teaching Groups</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedTeachers.map((teacher) => {
                    const sortedLevels = [...teacher.eligible_levels].sort((left, right) => left.level_number - right.level_number)
                    const classTypes = teacher.active_class_types.map((classType) => classType === 'private' ? 'Private' : 'Semi-private')
                    return (
                      <tr key={teacher.id} className="align-top text-slate-700">
                        <td className="px-3 py-3">
                          <div className="break-words font-medium text-slate-900">{teacher.profiles?.full_name ?? 'Unknown teacher'}</div>
                          <div className="mt-1 break-words text-xs text-slate-500">{teacher.teacher_code}</div>
                        </td>
                        <td className="break-words px-3 py-3">
                          <div>{teacher.profiles?.email ?? '—'}</div>
                          <div className="mt-1 text-xs text-slate-500">{teacher.profiles?.phone ?? '—'}</div>
                        </td>
                        <td className="break-words px-3 py-3">
                          <div>{sortedLevels.length > 0 ? sortedLevels.map((level) => level.name).join(', ') : 'None'}</div>
                          <div className="mt-1 text-xs text-slate-500">{classTypes.length > 0 ? classTypes.join(', ') : '—'}</div>
                        </td>
                        <td className="px-3 py-3">{teacher.profiles?.created_at ? new Intl.DateTimeFormat('en-US').format(new Date(teacher.profiles.created_at)) : '—'}</td>
                        <td className="break-words px-3 py-3">{teacher.active_teaching_group_names.length > 0 ? teacher.active_teaching_group_names.join(', ') : 'Not Assigned'}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${teacher.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                            {teacher.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col items-start gap-1.5">
                            <button type="button" onClick={() => openTeacherFeedback(teacher)} className="font-medium text-blue-700 underline">Feedback</button>
                            <button type="button" onClick={() => openTeacherEditor(teacher)} className="font-medium text-slate-900 underline">Edit</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">Showing {showingStart}–{showingEnd} of {filteredTeachers.length}</p>
                <nav aria-label="Teacher pagination" className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous page"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >‹</button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      aria-label={`Page ${page}`}
                      aria-current={currentPage === page ? 'page' : undefined}
                      onClick={() => setCurrentPage(page)}
                      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-medium ${currentPage === page ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700'}`}
                    >{page}</button>
                  ))}
                  <button
                    type="button"
                    aria-label="Next page"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >›</button>
                </nav>
              </div>
            </>
          )}
        </div>
      </section>

      {editingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="edit-teacher-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 id="edit-teacher-title" className="text-xl font-semibold text-slate-900">Edit Teacher</h3>
            <dl className="mt-5 space-y-3 text-sm">
              <div><dt className="font-medium text-slate-700">Teacher</dt><dd>{editingTeacher.profiles?.full_name ?? 'Unknown teacher'}</dd></div>
              <div><dt className="font-medium text-slate-700">Teacher Code</dt><dd>{editingTeacher.teacher_code}</dd></div>
            </dl>

            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-slate-700">Supported Levels</legend>
              <div className="mt-2 space-y-2">
                {levels.map((level) => (
                  <label key={level.id} className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={selectedLevelIds.includes(level.id)}
                      onChange={() => toggleSelectedLevel(level.id)}
                      disabled={isSavingLevels}
                    />
                    {level.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">This changes teaching eligibility only. Existing teaching groups are unchanged.</p>
            {editError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{editError}</p>}
            {editingTeacher.is_active && (
              <button type="button" onClick={() => setIsRemoveConfirmationOpen(true)} disabled={isSavingLevels || isRemovingTeacher} className="mt-6 text-sm font-medium text-red-700 underline disabled:opacity-50">Remove Teacher</button>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeTeacherEditor} disabled={isSavingLevels || isRemovingTeacher} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
              <button type="button" onClick={() => void saveTeacherLevels()} disabled={isSavingLevels || isRemovingTeacher} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isSavingLevels ? 'Saving...' : 'Save'}</button>
            </div>
          </section>
        </div>
      )}

      {selectedFeedbackTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-teacher-feedback-title"
            className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Teacher Feedback</p>
                <h3 id="admin-teacher-feedback-title" className="mt-1 text-xl font-extrabold text-slate-900">
                  {selectedFeedbackTeacher.profiles?.full_name ?? 'Unknown teacher'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{selectedFeedbackTeacher.teacher_code}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFeedbackTeacher(null)}
                aria-label="Close teacher feedback dialog"
                className="rounded-lg px-2 py-1 text-lg font-bold text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              {adminTeacherFeedbackLoading && (
                <p className="text-sm text-slate-600">Loading feedback...</p>
              )}
              {adminTeacherFeedbackError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  Unable to load teacher feedback: {adminTeacherFeedbackError}
                </div>
              )}
              {!adminTeacherFeedbackLoading && !adminTeacherFeedbackError && adminTeacherFeedback.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-semibold text-slate-700">No student feedback yet.</p>
                </div>
              )}

              {!adminTeacherFeedbackLoading && !adminTeacherFeedbackError && adminTeacherFeedback.length > 0 && (
                <div className="space-y-3">
                  {adminTeacherFeedback.map((item) => (
                    <article key={item.feedback_id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="grid gap-3 text-sm md:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Student</p>
                          <p className="mt-1 font-semibold text-slate-900">{item.student_name}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.student_code}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Level / Group</p>
                          <p className="mt-1 font-semibold text-slate-900">{item.level_name}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.teaching_group_name ?? 'Historical group unavailable'}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
                        <span className="text-sm font-bold tracking-[0.06em] text-amber-500">
                          {item.rating ? `${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}` : 'No rating'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Intl.DateTimeFormat('id-ID').format(new Date(item.submitted_at))}
                        </span>
                      </div>
                      {item.comment && (
                        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{item.comment}</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 p-4 text-right sm:p-5">
              <button
                type="button"
                onClick={() => setSelectedFeedbackTeacher(null)}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      {editingTeacher && isRemoveConfirmationOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="remove-teacher-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 id="remove-teacher-title" className="text-xl font-semibold text-slate-900">Remove this teacher?</h3>
            <p className="mt-3 text-sm text-slate-600">This will deactivate the teacher and remove them from active teacher management. Historical attendance, teacher fee, and teaching group records will be preserved.</p>
            {editError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{editError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsRemoveConfirmationOpen(false)} disabled={isRemovingTeacher} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
              <button type="button" onClick={() => void removeTeacher()} disabled={isRemovingTeacher} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isRemovingTeacher ? 'Removing...' : 'Remove Teacher'}</button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
