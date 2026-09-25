import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAdminStudents } from '../../hooks/useAdminStudents'
import { useAuthContext } from '../../providers/AuthProvider'
import { deactivateStudent, getLevels, type AdminStudentDirectoryItem, type AdminStudentDirectoryStatus, type ActiveLevel } from '../../services/admin.service'
import { adminEditPaidEnrollment, getEditablePaidEnrollmentsForStudent, type EnrollmentCorrectionItem } from '../../services/admin-enrollment-correction.service'

export const Route = createFileRoute('/admin/')({ component: AdminStudentManagementPage })

function formatDirectoryStatus(status: AdminStudentDirectoryStatus) {
  return status === 'next_level'
    ? 'Next Level'
    : status === 'non_active'
      ? 'Non-active'
      : status === 'renewal'
        ? 'Renewal'
        : 'Active'
}
function formatClassType(classType: 'private' | 'semi_private') { return classType === 'private' ? 'Private' : 'Semi-private' }

function AdminStudentManagementPage() {
  const { isAuthenticated, loading, profileLoading, profileError, role, status } = useAuthContext()
  const navigate = useNavigate()
  const canManageStudents = isAuthenticated && role === 'admin' && status === 'active'
  const directory = useAdminStudents(canManageStudents)
  const [levels, setLevels] = useState<ActiveLevel[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AdminStudentDirectoryStatus | 'all'>('active')
  const [levelFilter, setLevelFilter] = useState('all')
  const [classTypeFilter, setClassTypeFilter] = useState<'all' | 'private' | 'semi_private'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [editingStudent, setEditingStudent] = useState<AdminStudentDirectoryItem | null>(null)
  const [editLevelId, setEditLevelId] = useState('')
  const [editPackageType, setEditPackageType] = useState<'private' | 'semi_private'>('private')
  const [editError, setEditError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isRemovingStudent, setIsRemovingStudent] = useState(false)
  const [isRemoveConfirmationOpen, setIsRemoveConfirmationOpen] = useState(false)
  const [paidEnrollments, setPaidEnrollments] = useState<EnrollmentCorrectionItem[]>([])
  const [isLoadingEnrollments, setIsLoadingEnrollments] = useState(false)
  const pageSize = 10

  useEffect(() => {
    if (loading || profileLoading) return
    if (!isAuthenticated || profileError || status === null) navigate({ to: '/login' })
    else if (status !== 'active') navigate({ to: '/waiting' })
  }, [isAuthenticated, loading, navigate, profileError, profileLoading, status])

  const loadLevels = useCallback(async () => { try { setLevels(await getLevels()) } catch { /* Editing will surface the actionable error if the list cannot be loaded. */ } }, [])
  useEffect(() => { if (canManageStudents) void loadLevels() }, [canManageStudents, loadLevels])

  const statusOptions: Array<AdminStudentDirectoryStatus | 'all'> = ['all', 'active', 'renewal', 'next_level', 'non_active']
  const availableLevels = useMemo(() => directory.students.flatMap((student) => student.level ? [student.level] : []).filter((level, index, all) => all.findIndex((candidate) => candidate.id === level.id) === index).sort((left, right) => left.level_number - right.level_number), [directory.students])

  const filteredStudents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return directory.students.filter((student) => {
      const matchesSearch = !normalizedSearch || student.profile?.full_name.toLowerCase().includes(normalizedSearch) || student.student_code.toLowerCase().includes(normalizedSearch) || student.profile?.email.toLowerCase().includes(normalizedSearch)
      const matchesStatus = statusFilter === 'all' || student.directory_status === statusFilter
      const matchesLevel = levelFilter === 'all' || student.level?.id === levelFilter
      const matchesClassType = classTypeFilter === 'all' || student.class_types.includes(classTypeFilter)
      return matchesSearch && matchesStatus && matchesLevel && matchesClassType
    })
  }, [classTypeFilter, directory.students, levelFilter, search, statusFilter])

  useEffect(() => { setCurrentPage(1) }, [classTypeFilter, levelFilter, search, statusFilter])
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize))
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages) }, [currentPage, totalPages])
  const paginatedStudents = useMemo(() => filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize), [currentPage, filteredStudents])

  const correctionEnrollment = paidEnrollments.length === 1 ? paidEnrollments[0] : null
  const hasMultiplePaidEnrollments = paidEnrollments.length > 1
  const isCorrectionMode = correctionEnrollment !== null

  const openStudentEditor = async (student: AdminStudentDirectoryItem) => {
    setEditingStudent(student); setEditLevelId(student.level?.id ?? ''); setEditPackageType(student.class_types[0] ?? 'private'); setEditError(null); setPaidEnrollments([]); setIsLoadingEnrollments(true)
    try {
      const enrollments = await getEditablePaidEnrollmentsForStudent(student.id)
      setPaidEnrollments(enrollments)
      if (enrollments.length === 1) { setEditLevelId(enrollments[0].level_id); setEditPackageType(enrollments[0].package_type) }
      else if (enrollments.length > 1) setEditError('This student has more than one payment-approved enrollment. Resolve the enrollment history before editing this student.')
    } catch (error) { setEditError(error instanceof Error ? error.message : 'Unable to load the student enrollment state.') }
    finally { setIsLoadingEnrollments(false) }
  }

  const closeStudentEditor = () => { if (isSaving || isRemovingStudent) return; setEditingStudent(null); setEditLevelId(''); setEditPackageType('private'); setEditError(null); setPaidEnrollments([]); setIsRemoveConfirmationOpen(false) }

  const removeStudent = async () => {
    if (!editingStudent) return
    setIsRemovingStudent(true); setEditError(null)
    try { await deactivateStudent(editingStudent.id); await directory.reload(); closeStudentEditor() }
    catch (error) { setEditError(error instanceof Error ? error.message : 'Unable to remove this student.') }
    finally { setIsRemovingStudent(false) }
  }

  const saveStudent = async () => {
    if (!editingStudent || !editLevelId || hasMultiplePaidEnrollments) return
    setIsSaving(true); setEditError(null)
    try {
      if (correctionEnrollment) {
        const changed = editLevelId !== correctionEnrollment.level_id || editPackageType !== correctionEnrollment.package_type
        if (changed) await adminEditPaidEnrollment(correctionEnrollment.id, editLevelId, editPackageType)
      } else if (editLevelId !== editingStudent.level?.id) {
        const { supabase } = await import('../../lib/supabase')
        const { error } = await supabase.rpc('admin_update_student_level', { p_student_id: editingStudent.id, p_level_id: editLevelId })
        if (error) throw error
      }
      await directory.reload(); closeStudentEditor()
    } catch (error) { setEditError(error instanceof Error ? error.message : 'Unable to save the student correction.') }
    finally { setIsSaving(false) }
  }

  if (loading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || profileError || status === null || status !== 'active') return null
  if (role !== 'admin') return <p>Access denied.</p>

  const showingStart = filteredStudents.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1
  const showingEnd = Math.min(currentPage * pageSize, filteredStudents.length)

  return (
    <section>
      <h2 className="text-3xl font-bold text-slate-900">Student Management</h2>
      <p className="mt-2 text-slate-600">View registered students and review waiting student registrations.</p>
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold text-slate-900">Student Directory</h3>
        <div className="mt-5 flex flex-col gap-3 md:flex-row">
          <label className="flex-1"><span className="sr-only">Search students</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student..." className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" /></label>
          <label className="text-sm font-medium text-slate-700">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AdminStudentDirectoryStatus | 'all')} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">{statusOptions.map((studentStatus) => <option key={studentStatus} value={studentStatus}>{studentStatus === 'all' ? 'All statuses' : formatDirectoryStatus(studentStatus)}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Level<select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"><option value="all">All levels</option>{availableLevels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Class Type<select value={classTypeFilter} onChange={(event) => setClassTypeFilter(event.target.value as 'all' | 'private' | 'semi_private')} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"><option value="all">All types</option><option value="private">Private</option><option value="semi_private">Semi-private</option></select></label>
        </div>
        {directory.isLoading && <p className="mt-6 text-sm text-slate-600">Loading students...</p>}
        {directory.error && <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{directory.error}</p>}
        {!directory.isLoading && !directory.error && filteredStudents.length === 0 && <p className="mt-6 text-sm text-slate-600">No students match the current search or filters.</p>}
        {!directory.isLoading && !directory.error && filteredStudents.length > 0 && <>
          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full table-fixed divide-y divide-slate-200 text-left text-sm">
              <colgroup><col style={{ width: '18%' }} /><col style={{ width: '24%' }} /><col style={{ width: '17%' }} /><col style={{ width: '11%' }} /><col style={{ width: '14%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} /></colgroup>
              <thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-3 font-semibold">Student</th><th className="px-3 py-3 font-semibold">Contact</th><th className="px-3 py-3 font-semibold">Enrollment</th><th className="px-3 py-3 font-semibold">Joined</th><th className="px-3 py-3 font-semibold">Teaching Group</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedStudents.map((student) => <tr key={student.id} className="align-top text-slate-700">
                  <td className="px-3 py-3"><div className="break-words font-medium text-slate-900">{student.profile?.full_name ?? 'Name unavailable'}</div><div className="mt-1 break-words text-xs text-slate-500">{student.student_code}</div></td>
                  <td className="break-words px-3 py-3"><div>{student.profile?.email ?? '—'}</div><div className="mt-1 text-xs text-slate-500">{student.profile?.phone ?? '—'}</div></td>
                  <td className="break-words px-3 py-3"><div>{student.level?.name ?? 'Level unavailable'}</div><div className="mt-1 text-xs text-slate-500">{student.class_types.length > 0 ? student.class_types.map(formatClassType).join(', ') : '—'}</div></td>
                  <td className="px-3 py-3">{student.profile?.created_at ? new Intl.DateTimeFormat('en-US').format(new Date(student.profile.created_at)) : '—'}</td>
                  <td className="break-words px-3 py-3">
                    {student.teaching_group_names.length > 0 ? (
                      <>
                        <div>{student.teaching_group_names.join(', ')}</div>
                        {student.session_progress && (
                          <div className="mt-1 text-xs font-medium text-slate-500">
                            Sessions {student.session_progress.completed}/{student.session_progress.limit}
                          </div>
                        )}
                      </>
                    ) : (
                      'Not Assigned'
                    )}
                  </td>
                  <td className="px-3 py-3"><span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{formatDirectoryStatus(student.directory_status)}</span></td>
                  <td className="px-3 py-3"><button type="button" onClick={() => void openStudentEditor(student)} className="font-medium text-slate-900 underline">Edit</button></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600">Showing {showingStart}–{showingEnd} of {filteredStudents.length}</p><nav aria-label="Student pagination" className="flex items-center gap-1"><button type="button" aria-label="Previous page" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => <button key={page} type="button" aria-label={`Page ${page}`} aria-current={currentPage === page ? 'page' : undefined} onClick={() => setCurrentPage(page)} className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-medium ${currentPage === page ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700'}`}>{page}</button>)}<button type="button" aria-label="Next page" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">›</button></nav></div>
        </>}
      </section>

      {editingStudent && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="edit-student-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"><h3 id="edit-student-title" className="text-xl font-semibold text-slate-900">Edit Student</h3><dl className="mt-5 space-y-3 text-sm"><div><dt className="font-medium text-slate-700">Student</dt><dd>{editingStudent.profile?.full_name ?? 'Name unavailable'}</dd></div><div><dt className="font-medium text-slate-700">Student Code</dt><dd>{editingStudent.student_code}</dd></div><div><dt className="font-medium text-slate-700">Student Base Level</dt><dd>{editingStudent.level?.name ?? 'Level unavailable'}</dd></div>{correctionEnrollment && <><div><dt className="font-medium text-slate-700">Existing Operational Enrollment</dt><dd>{correctionEnrollment.levels?.name ?? 'Level unavailable'} · {formatClassType(correctionEnrollment.package_type)}</dd></div><div><dt className="font-medium text-slate-700">Payment</dt><dd>Approved · Rp{correctionEnrollment.price.toLocaleString('id-ID')}</dd></div><div><dt className="font-medium text-slate-700">Teaching Group</dt><dd>{editingStudent.teaching_group_names.length > 0 ? editingStudent.teaching_group_names.join(', ') : 'Not Assigned'}</dd></div></>}</dl>{isLoadingEnrollments ? <p className="mt-5 text-sm text-slate-600">Loading enrollment state...</p> : hasMultiplePaidEnrollments ? <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{editError}</p> : <div className="mt-5 space-y-4"><label className="block text-sm font-medium text-slate-700">Level<select value={editLevelId} onChange={(event) => setEditLevelId(event.target.value)} disabled={isSaving || isRemovingStudent} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"><option value="">Select level</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>{isCorrectionMode && <label className="block text-sm font-medium text-slate-700">Class Type<select value={editPackageType} onChange={(event) => setEditPackageType(event.target.value as 'private' | 'semi_private')} disabled={isSaving || isRemovingStudent} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"><option value="private">Private</option><option value="semi_private">Semi-private</option></select></label>}<p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{isCorrectionMode ? `Save will correct the operational enrollment to ${levels.find((level) => level.id === editLevelId)?.name ?? 'the selected level'} · ${formatClassType(editPackageType)}. Existing invoice and payment history are preserved.` : 'This changes the level used for future enrollments only. Existing enrollment history is unchanged.'}</p></div>}{editError && !hasMultiplePaidEnrollments && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{editError}</p>}{editingStudent.is_active && <button type="button" onClick={() => setIsRemoveConfirmationOpen(true)} disabled={isSaving || isRemovingStudent} className="mt-6 text-sm font-medium text-red-700 underline disabled:opacity-50">Remove Student</button>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={closeStudentEditor} disabled={isSaving || isRemovingStudent} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button><button type="button" onClick={() => void saveStudent()} disabled={!editLevelId || isSaving || isRemovingStudent || isLoadingEnrollments || hasMultiplePaidEnrollments} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isSaving ? 'Saving...' : isCorrectionMode ? 'Save Correction' : 'Save'}</button></div></section></div>}
      {editingStudent && isRemoveConfirmationOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="remove-student-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"><h3 id="remove-student-title" className="text-xl font-semibold text-slate-900">Remove this student?</h3><p className="mt-3 text-sm text-slate-600">This will deactivate the student and remove them from active student management. Historical attendance, payment, enrollment, and teaching group records will be preserved.</p>{editError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{editError}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setIsRemoveConfirmationOpen(false)} disabled={isRemovingStudent} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button><button type="button" onClick={() => void removeStudent()} disabled={isRemovingStudent} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isRemovingStudent ? 'Removing...' : 'Remove Student'}</button></div></section></div>}
    </section>
  )
}
