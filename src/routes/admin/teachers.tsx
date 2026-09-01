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
  const [editingTeacher, setEditingTeacher] = useState<AdminTeacher | null>(null)
  const [selectedLevelIds, setSelectedLevelIds] = useState<string[]>([])
  const [editError, setEditError] = useState<string | null>(null)
  const [isSavingLevels, setIsSavingLevels] = useState(false)
  const [isRemovingTeacher, setIsRemovingTeacher] = useState(false)
  const [isRemoveConfirmationOpen, setIsRemoveConfirmationOpen] = useState(false)

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
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Unable to remove this teacher.')
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

  return (
    <section>
      <h2 className="text-3xl font-bold text-slate-900">Teacher Management</h2>
      <p className="mt-2 text-slate-600">View teacher assignments and review waiting teacher registrations.</p>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-slate-900">Teacher Directory</h3>
        <div className="mt-5 flex flex-col gap-3 md:flex-row">
          <label className="flex-1"><span className="sr-only">Search teachers</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search teacher..." className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" /></label>
          <label className="text-sm font-medium text-slate-700">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <label className="text-sm font-medium text-slate-700">Level<select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"><option value="all">All levels</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Class Type<select value={classTypeFilter} onChange={(event) => setClassTypeFilter(event.target.value as 'all' | 'private' | 'semi_private')} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"><option value="all">All types</option><option value="private">Private</option><option value="semi_private">Semi-private</option></select></label>
        </div>
      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
        {isLoading && (
          <p className="p-6 text-sm text-slate-600">Loading teachers...</p>
        )}

        {error && (
          <p className="m-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Unable to load teachers: {error}
          </p>
        )}

        {!isLoading && !error && filteredTeachers.length === 0 && (
          <p className="p-6 text-sm text-slate-600">No teachers match the current search or filter.</p>
        )}

        {!isLoading && !error && filteredTeachers.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-6 py-3 font-semibold">Teacher</th>
                  <th className="px-6 py-3 font-semibold">Email</th>
                  <th className="px-6 py-3 font-semibold">Phone</th>
                  <th className="px-6 py-3 font-semibold">Teacher Code</th>
                  <th className="px-6 py-3 font-semibold">Joined Date</th>
                  <th className="px-6 py-3 font-semibold">Supported Levels</th>
                  <th className="px-6 py-3 font-semibold">Class Type</th>
                  <th className="px-6 py-3 font-semibold">Teaching Groups</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="text-slate-700">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {teacher.profiles?.full_name ?? 'Unknown teacher'}
                    </td>
                    <td className="px-6 py-4">{teacher.profiles?.email ?? '—'}</td>
                    <td className="px-6 py-4">{teacher.profiles?.phone ?? '—'}</td>
                    <td className="px-6 py-4">{teacher.teacher_code}</td>
                    <td className="px-6 py-4">{teacher.profiles?.created_at ? new Intl.DateTimeFormat('en-US').format(new Date(teacher.profiles.created_at)) : '—'}</td>
                    <td className="px-6 py-4">{teacher.eligible_levels.length > 0 ? [...teacher.eligible_levels].sort((left, right) => left.level_number - right.level_number).map((level) => level.name).join(', ') : 'None'}</td>
                    <td className="px-6 py-4"><div className="flex flex-wrap gap-1">{teacher.active_class_types.length > 0 ? teacher.active_class_types.map((classType) => <span key={classType} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{classType === 'private' ? 'Private' : 'Semi-private'}</span>) : '—'}</div></td>
                    <td className="px-6 py-4">{teacher.active_teaching_group_names.length > 0 ? teacher.active_teaching_group_names.join(', ') : 'Not Assigned'}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        teacher.is_active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {teacher.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4"><button type="button" onClick={() => openTeacherEditor(teacher)} className="font-medium text-slate-900 underline">Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </section>
      {editingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="edit-teacher-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 id="edit-teacher-title" className="text-xl font-semibold text-slate-900">Edit Teacher</h3>
            <dl className="mt-5 space-y-3 text-sm"><div><dt className="font-medium text-slate-700">Teacher</dt><dd>{editingTeacher.profiles?.full_name ?? 'Unknown teacher'}</dd></div><div><dt className="font-medium text-slate-700">Teacher Code</dt><dd>{editingTeacher.teacher_code}</dd></div></dl>
            <fieldset className="mt-5"><legend className="text-sm font-medium text-slate-700">Supported Levels</legend><div className="mt-2 space-y-2">{levels.map((level) => <label key={level.id} className="flex items-center gap-2 text-sm text-slate-800"><input type="checkbox" checked={selectedLevelIds.includes(level.id)} onChange={() => toggleSelectedLevel(level.id)} disabled={isSavingLevels} />{level.name}</label>)}</div></fieldset>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">This changes teaching eligibility only. Existing teaching groups are unchanged.</p>
            {editError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{editError}</p>}
            {editingTeacher.is_active && <button type="button" onClick={() => setIsRemoveConfirmationOpen(true)} disabled={isSavingLevels || isRemovingTeacher} className="mt-6 text-sm font-medium text-red-700 underline disabled:opacity-50">Remove Teacher</button>}
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeTeacherEditor} disabled={isSavingLevels || isRemovingTeacher} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button><button type="button" onClick={() => void saveTeacherLevels()} disabled={isSavingLevels || isRemovingTeacher} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isSavingLevels ? 'Saving...' : 'Save'}</button></div>
          </section>
        </div>
      )}
      {editingTeacher && isRemoveConfirmationOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="remove-teacher-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 id="remove-teacher-title" className="text-xl font-semibold text-slate-900">Remove this teacher?</h3>
            <p className="mt-3 text-sm text-slate-600">This will deactivate the teacher and remove them from active teacher management. Historical attendance, teacher fee, and teaching group records will be preserved.</p>
            {editError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{editError}</p>}
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setIsRemoveConfirmationOpen(false)} disabled={isRemovingTeacher} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button><button type="button" onClick={() => void removeTeacher()} disabled={isRemovingTeacher} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isRemovingTeacher ? 'Removing...' : 'Remove Teacher'}</button></div>
          </section>
        </div>
      )}
    </section>
  )
}
