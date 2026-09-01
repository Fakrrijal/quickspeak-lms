import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAdminStudents } from '../../hooks/useAdminStudents'
import { useAuthContext } from '../../providers/AuthProvider'
import {
  correctStudentLevel,
  deactivateStudent,
  getLevels,
  getStudentProtectedEnrollments,
  updateStudentLevel,
  type AdminStudentDirectoryItem,
  type ActiveLevel,
  type StudentProtectedEnrollment,
} from '../../services/admin.service'

export const Route = createFileRoute('/admin/')({
  component: AdminStudentManagementPage,
})

function formatStatus(status: string | null) {
  if (!status) return 'Unavailable'
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`
}

function AdminStudentManagementPage() {
  const { isAuthenticated, loading, profileLoading, profileError, role, status } = useAuthContext()
  const navigate = useNavigate()
  const canManageStudents = isAuthenticated && role === 'admin' && status === 'active'
  const directory = useAdminStudents(canManageStudents)
  const [levels, setLevels] = useState<ActiveLevel[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [levelFilter, setLevelFilter] = useState('all')
  const [classTypeFilter, setClassTypeFilter] = useState<'all' | 'private' | 'semi_private'>('all')
  const [editingStudent, setEditingStudent] = useState<AdminStudentDirectoryItem | null>(null)
  const [editLevelId, setEditLevelId] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [isSavingLevel, setIsSavingLevel] = useState(false)
  const [isRemovingStudent, setIsRemovingStudent] = useState(false)
  const [isRemoveConfirmationOpen, setIsRemoveConfirmationOpen] = useState(false)
  const [protectedEnrollments, setProtectedEnrollments] = useState<StudentProtectedEnrollment[]>([])
  const [isLoadingProtectedEnrollments, setIsLoadingProtectedEnrollments] = useState(false)

  useEffect(() => {
    if (loading || profileLoading) return
    if (!isAuthenticated || profileError || status === null) {
      navigate({ to: '/login' })
    } else if (status !== 'active') {
      navigate({ to: '/waiting' })
    }
  }, [isAuthenticated, loading, navigate, profileError, profileLoading, status])

  const loadLevels = useCallback(async () => {
    try {
      setLevels(await getLevels())
    } catch { /* error is surfaced when editing requires levels */ }
  }, [])

  useEffect(() => {
    if (!canManageStudents) return
    void loadLevels()
  }, [canManageStudents, loadLevels])

  const availableStatuses = useMemo(() => (
    [...new Set(directory.students.flatMap((student) => student.profile?.status ? [student.profile.status] : []))]
      .sort()
  ), [directory.students])
  const availableLevels = useMemo(() => (
    directory.students
      .flatMap((student) => student.level ? [student.level] : [])
      .filter((level, index, all) => all.findIndex((candidate) => candidate.id === level.id) === index)
      .sort((left, right) => left.level_number - right.level_number)
  ), [directory.students])
  const filteredStudents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return directory.students.filter((student) => {
      const matchesSearch = !normalizedSearch
        || student.profile?.full_name.toLowerCase().includes(normalizedSearch)
        || student.student_code.toLowerCase().includes(normalizedSearch)
        || student.profile?.email.toLowerCase().includes(normalizedSearch)
      const matchesStatus = statusFilter === 'all' || student.profile?.status === statusFilter
      const matchesLevel = levelFilter === 'all' || student.level?.id === levelFilter
      const matchesClassType = classTypeFilter === 'all' || student.class_types.includes(classTypeFilter)
      return matchesSearch && matchesStatus && matchesLevel && matchesClassType
    })
  }, [classTypeFilter, directory.students, levelFilter, search, statusFilter])

  const openStudentEditor = async (student: AdminStudentDirectoryItem) => {
    setEditingStudent(student)
    setEditLevelId(student.level?.id ?? '')
    setEditError(null)
    setProtectedEnrollments([])
    setIsLoadingProtectedEnrollments(true)
    try {
      const enrollments = await getStudentProtectedEnrollments(student.id)
      const operationalLevels = new Map(
        enrollments.flatMap((enrollment) => enrollment.level ? [[enrollment.level.id, enrollment.level] as const] : []),
      )
      setProtectedEnrollments(enrollments)
      if (operationalLevels.size === 1) {
        setEditLevelId([...operationalLevels.keys()][0])
      } else if (operationalLevels.size > 1) {
        setEditError('Student level cannot be corrected automatically because multiple enrollments have different operational levels.')
      }
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Unable to load the student enrollment state.')
    } finally {
      setIsLoadingProtectedEnrollments(false)
    }
  }

  const closeStudentEditor = () => {
    if (isSavingLevel || isRemovingStudent) return
    setEditingStudent(null)
    setEditLevelId('')
    setEditError(null)
    setProtectedEnrollments([])
    setIsRemoveConfirmationOpen(false)
  }

  const removeStudent = async () => {
    if (!editingStudent) return

    setIsRemovingStudent(true)
    setEditError(null)
    try {
      await deactivateStudent(editingStudent.id)
      await directory.reload()
      setEditingStudent(null)
      setProtectedEnrollments([])
      setIsRemoveConfirmationOpen(false)
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Unable to remove this student.')
    } finally {
      setIsRemovingStudent(false)
    }
  }

  const saveStudentLevel = async () => {
    if (!editingStudent || !editLevelId) return
    if (editLevelId === editingStudent.level?.id) {
      closeStudentEditor()
      return
    }

    const operationalLevels = new Set(protectedEnrollments.map((enrollment) => enrollment.level_id))
    if (operationalLevels.size > 1) return

    setIsSavingLevel(true)
    setEditError(null)
    try {
      if (protectedEnrollments.length > 0) {
        await correctStudentLevel(editingStudent.id, editLevelId)
      } else {
        await updateStudentLevel(editingStudent.id, editLevelId)
      }
      await directory.reload()
      setEditingStudent(null)
      setEditLevelId('')
      setEditError(null)
      setProtectedEnrollments([])
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Unable to update this student level.')
    } finally {
      setIsSavingLevel(false)
    }
  }

  const operationalLevels = [...new Map(
    protectedEnrollments.flatMap((enrollment) => enrollment.level ? [[enrollment.level.id, enrollment.level] as const] : []),
  ).values()]
  const operationalLevel = operationalLevels.length === 1 ? operationalLevels[0] : null
  const hasConflictingOperationalLevels = operationalLevels.length > 1
  const isCorrectionMode = protectedEnrollments.length > 0 && operationalLevel !== null

  if (loading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || profileError || status === null || status !== 'active') return null
  if (role !== 'admin') return <p>Access denied.</p>

  return (
    <section>
      <h2 className="text-3xl font-bold text-slate-900">Student Management</h2>
      <p className="mt-2 text-slate-600">View registered students and review waiting student registrations.</p>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-slate-900">Student Directory</h3>
        <div className="mt-5 flex flex-col gap-3 md:flex-row">
          <label className="flex-1">
            <span className="sr-only">Search students</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student..." className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" />
          </label>
          <label className="text-sm font-medium text-slate-700">Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
              <option value="all">All statuses</option>
              {availableStatuses.map((studentStatus) => <option key={studentStatus} value={studentStatus}>{formatStatus(studentStatus)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Level
            <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
              <option value="all">All levels</option>
              {availableLevels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Class Type
            <select value={classTypeFilter} onChange={(event) => setClassTypeFilter(event.target.value as 'all' | 'private' | 'semi_private')} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
              <option value="all">All types</option>
              <option value="private">Private</option>
              <option value="semi_private">Semi-private</option>
            </select>
          </label>
        </div>

        {directory.isLoading && <p className="mt-6 text-sm text-slate-600">Loading students...</p>}
        {directory.error && <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{directory.error}</p>}
        {!directory.isLoading && !directory.error && filteredStudents.length === 0 && <p className="mt-6 text-sm text-slate-600">No students match the current search or filters.</p>}
        {!directory.isLoading && !directory.error && filteredStudents.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 font-semibold">Student</th><th className="px-4 py-3 font-semibold">Email</th><th className="px-4 py-3 font-semibold">Phone</th><th className="px-4 py-3 font-semibold">Student Code</th><th className="px-4 py-3 font-semibold">Joined Date</th><th className="px-4 py-3 font-semibold">Level</th><th className="px-4 py-3 font-semibold">Class Type</th><th className="px-4 py-3 font-semibold">Teaching Group</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {filteredStudents.map((student) => <tr key={student.id} className="text-slate-700"><td className="px-4 py-3 font-medium text-slate-900">{student.profile?.full_name ?? 'Name unavailable'}</td><td className="px-4 py-3">{student.profile?.email ?? '—'}</td><td className="px-4 py-3">{student.profile?.phone ?? '—'}</td><td className="px-4 py-3">{student.student_code}</td><td className="px-4 py-3">{student.profile?.created_at ? new Intl.DateTimeFormat('en-US').format(new Date(student.profile.created_at)) : '—'}</td><td className="px-4 py-3">{student.level?.name ?? 'Level unavailable'}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-1">{student.class_types.length > 0 ? student.class_types.map((classType) => <span key={classType} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{classType === 'private' ? 'Private' : 'Semi-private'}</span>) : '—'}</div></td><td className="px-4 py-3">{student.teaching_group_names.length > 0 ? student.teaching_group_names.join(', ') : 'Not Assigned'}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{formatStatus(student.profile?.status ?? null)}</span></td><td className="px-4 py-3"><button type="button" onClick={() => void openStudentEditor(student)} className="font-medium text-slate-900 underline">Edit</button></td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="edit-student-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 id="edit-student-title" className="text-xl font-semibold text-slate-900">Edit Student</h3>
            <dl className="mt-5 space-y-3 text-sm"><div><dt className="font-medium text-slate-700">Student</dt><dd>{editingStudent.profile?.full_name ?? 'Name unavailable'}</dd></div><div><dt className="font-medium text-slate-700">Student Code</dt><dd>{editingStudent.student_code}</dd></div><div><dt className="font-medium text-slate-700">Student Base Level</dt><dd>{editingStudent.level?.name ?? 'Level unavailable'}</dd></div>{isCorrectionMode && <><div><dt className="font-medium text-slate-700">Existing Operational Enrollment</dt><dd>{operationalLevel.name}</dd></div><div><dt className="font-medium text-slate-700">Teaching Group</dt><dd>{editingStudent.teaching_group_names.length > 0 ? editingStudent.teaching_group_names.join(', ') : 'Not Assigned'}</dd></div></>}</dl>
            {isLoadingProtectedEnrollments ? <p className="mt-5 text-sm text-slate-600">Loading enrollment state...</p> : <label className="mt-5 block text-sm font-medium text-slate-700">{isCorrectionMode ? 'Correction' : 'Level'}<select value={editLevelId} onChange={(event) => setEditLevelId(event.target.value)} disabled={isSavingLevel || hasConflictingOperationalLevels} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"><option value="">Select level</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>}
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{isCorrectionMode ? `This will correct the student's base level to ${operationalLevel.name}. The existing enrollment, Teaching Group, attendance, progress, payment, and Teacher Fee records will not be changed.` : 'This changes the level used for future enrollments only. Existing enrollment history is unchanged.'}</p>
            {editError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{editError}</p>}
            {editingStudent.is_active && <button type="button" onClick={() => setIsRemoveConfirmationOpen(true)} disabled={isSavingLevel || isRemovingStudent} className="mt-6 text-sm font-medium text-red-700 underline disabled:opacity-50">Remove Student</button>}
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeStudentEditor} disabled={isSavingLevel || isRemovingStudent} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button><button type="button" onClick={() => void saveStudentLevel()} disabled={!editLevelId || isSavingLevel || isRemovingStudent || isLoadingProtectedEnrollments || hasConflictingOperationalLevels} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isSavingLevel ? 'Saving...' : isCorrectionMode ? 'Correct Level' : 'Save'}</button></div>
          </section>
        </div>
      )}

      {editingStudent && isRemoveConfirmationOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="remove-student-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 id="remove-student-title" className="text-xl font-semibold text-slate-900">Remove this student?</h3>
            <p className="mt-3 text-sm text-slate-600">This will deactivate the student and remove them from active student management. Historical attendance, payment, enrollment, and teaching group records will be preserved.</p>
            {editError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{editError}</p>}
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setIsRemoveConfirmationOpen(false)} disabled={isRemovingStudent} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button><button type="button" onClick={() => void removeStudent()} disabled={isRemovingStudent} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isRemovingStudent ? 'Removing...' : 'Remove Student'}</button></div>
          </section>
        </div>
      )}

      {/* Waiting registrations are managed on the dedicated Waiting Students page. */}
      {/*
        {successMessage && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{successMessage}</p>}
        {approvalError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{approvalError}</p>}
        {studentsError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Unable to load waiting students: {studentsError}</p>}
        {levelsError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Unable to load levels: {levelsError}</p>}
        {(isLoadingStudents || isLoadingLevels) && <p className="mt-4 text-sm text-slate-600">Loading waiting students...</p>}
        {!isLoadingStudents && !studentsError && waitingStudents.length === 0 && <p className="mt-4 text-sm text-slate-600">There are no waiting students.</p>}
        <div className="mt-4 space-y-4">
          {waitingStudents.map((student) => {
            const selectedLevelId = selectedLevels[student.id] ?? ''
            const isApproving = approvingProfileId === student.id
            return <article key={student.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h4 className="font-semibold text-slate-900">{student.full_name}</h4><p className="text-sm text-slate-600">{student.email}</p><p className="mt-1 text-sm text-amber-700">Status: {student.status}</p></div><div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto"><label className="sr-only" htmlFor={`level-${student.id}`}>Starting level for {student.full_name}</label><select id={`level-${student.id}`} value={selectedLevelId} onChange={(event) => setSelectedLevels((current) => ({ ...current, [student.id]: event.target.value }))} disabled={isApproving || isLoadingLevels || levels.length === 0} className="min-w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"><option value="">Select starting level</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select><button type="button" onClick={() => void handleApprove(student)} disabled={!selectedLevelId || isApproving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{isApproving ? 'Approving...' : 'Approve Student'}</button></div></div></article>
          })}
        </div>
      </section> */}
    </section>
  )
}
