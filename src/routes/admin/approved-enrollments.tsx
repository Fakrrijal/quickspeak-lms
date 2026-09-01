import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import {
  adoptExistingPaidEnrollmentAssignment,
  assignPaidEnrollmentToTeachingGroup,
  getActiveEnrollmentAssignmentExceptions,
  getAssignmentCandidateGroups,
  getPaymentApprovedEnrollments,
  reconcileActiveEnrollmentTeachingGroupAssignment,
  type ActiveEnrollmentAssignmentException,
  type AssignmentCandidateGroup,
  type ApprovedEnrollment,
} from '../../services/admin-enrollment-assignment.service'

export const Route = createFileRoute('/admin/approved-enrollments')({
  component: ApprovedEnrollmentsPage,
})

function getExceptionSelectionKey(exception: ActiveEnrollmentAssignmentException) {
  return `${exception.enrollment_id}:${exception.teaching_group_id}`
}

function ApprovedEnrollmentsPage() {
  const {
    isAuthenticated,
    loading,
    profileLoading,
    profileError,
    role,
    status,
  } = useAuthContext()
  const navigate = useNavigate()
  const [enrollments, setEnrollments] = useState<ApprovedEnrollment[]>([])
  const [assignmentExceptions, setAssignmentExceptions] = useState<ActiveEnrollmentAssignmentException[]>([])
  const [candidateGroups, setCandidateGroups] = useState<Record<string, AssignmentCandidateGroup[]>>({})
  const [selectedGroups, setSelectedGroups] = useState<Record<string, string>>({})
  const [selectedExceptionGroups, setSelectedExceptionGroups] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isAssigning, setIsAssigning] = useState<string | null>(null)
  const [isReconciling, setIsReconciling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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

  const loadApprovedEnrollments = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [approvedEnrollments, exceptions] = await Promise.all([
        getPaymentApprovedEnrollments(),
        getActiveEnrollmentAssignmentExceptions(),
      ])
      setEnrollments(approvedEnrollments)
      setAssignmentExceptions(exceptions)

      const groups = await Promise.all(
        approvedEnrollments.map(async (enrollment) => [
          enrollment.id,
          await getAssignmentCandidateGroups(enrollment.level_id, enrollment.package_type),
        ] as const),
      )

      setCandidateGroups(Object.fromEntries(groups))
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load approved enrollments.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  const canManageEnrollments =
    isAuthenticated && role === 'admin' && status === 'active'

  useEffect(() => {
    if (canManageEnrollments) {
      void loadApprovedEnrollments()
    }
  }, [canManageEnrollments, loadApprovedEnrollments])

  const handleAssign = async (enrollment: ApprovedEnrollment) => {
    const teachingGroupId = selectedGroups[enrollment.id]

    if (!teachingGroupId) {
      setError('Select a teaching group before assigning the enrollment.')
      return
    }

    const group = (candidateGroups[enrollment.id] ?? []).find(
      (candidate) => candidate.id === teachingGroupId,
    )
    const groupName = group?.name ?? 'the selected teaching group'

    if (!window.confirm(`Assign this paid enrollment to ${groupName}?`)) {
      return
    }

    setIsAssigning(enrollment.id)
    setError(null)
    setSuccessMessage(null)

    try {
      await assignPaidEnrollmentToTeachingGroup(enrollment.id, teachingGroupId)
      setSuccessMessage('Enrollment assigned to the teaching group successfully.')
      await loadApprovedEnrollments()
    } catch (assignmentError) {
      setError(
        assignmentError instanceof Error
          ? assignmentError.message
          : 'Unable to assign this enrollment. Refreshing the list.',
      )
      await loadApprovedEnrollments()
    } finally {
      setIsAssigning(null)
    }
  }

  const handleAdoptExistingAssignment = async (enrollment: ApprovedEnrollment) => {
    if (!window.confirm(
      'Use this existing teaching-group assignment for this enrollment?\n\nThis membership predates the current enrollment.',
    )) {
      return
    }

    setIsAssigning(enrollment.id)
    setError(null)
    setSuccessMessage(null)

    try {
      await adoptExistingPaidEnrollmentAssignment(enrollment.id)
      setSuccessMessage('Existing teaching-group assignment adopted successfully.')
      await loadApprovedEnrollments()
    } catch (adoptionError) {
      setError(
        adoptionError instanceof Error
          ? adoptionError.message
          : 'Unable to adopt this existing assignment. Refreshing the list.',
      )
      await loadApprovedEnrollments()
    } finally {
      setIsAssigning(null)
    }
  }

  const handleActivateExistingAssignment = async (
    enrollment: ApprovedEnrollment,
    teachingGroupId: string,
  ) => {
    if (!window.confirm('Activate this existing teacher assignment?')) {
      return
    }

    setIsAssigning(enrollment.id)
    setError(null)
    setSuccessMessage(null)

    try {
      await assignPaidEnrollmentToTeachingGroup(enrollment.id, teachingGroupId)
      setSuccessMessage('Existing teacher assignment activated successfully.')
      await loadApprovedEnrollments()
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : 'Unable to activate this existing assignment. Refreshing the list.',
      )
      await loadApprovedEnrollments()
    } finally {
      setIsAssigning(null)
    }
  }

  const handleReconcileAssignment = async (exception: ActiveEnrollmentAssignmentException) => {
    const teachingGroupId = selectedExceptionGroups[getExceptionSelectionKey(exception)]

    if (!teachingGroupId) {
      setError('Select a teaching group before reconciling the enrollment assignment.')
      return
    }

    if (!window.confirm(
      'Create the enrollment-specific Teaching Group assignment for this active enrollment?',
    )) {
      return
    }

    setIsReconciling(exception.enrollment_id)
    setError(null)
    setSuccessMessage(null)

    try {
      await reconcileActiveEnrollmentTeachingGroupAssignment(
        exception.enrollment_id,
        teachingGroupId,
      )
      setSuccessMessage('Active enrollment assignment reconciled successfully.')
      await loadApprovedEnrollments()
    } catch {
      setError('Unable to reconcile this active enrollment assignment. Refreshing the list.')
      await loadApprovedEnrollments()
    } finally {
      setIsReconciling(null)
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
        <p className="mt-2">You do not have permission to assign paid enrollments.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Approved Enrollments</h2>
          <p className="mt-2 text-slate-600">
            Assign paid enrollments to compatible active teaching groups.
          </p>
        </div>
        <Link to="/admin" className="text-sm font-medium text-slate-700 underline">
          Back to Admin
        </Link>
      </div>

      {successMessage && (
        <p className="mt-6 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMessage}
        </p>
      )}

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-8 overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-6 py-3 font-semibold">Student</th>
              <th className="px-6 py-3 font-semibold">Level</th>
              <th className="px-6 py-3 font-semibold">Package</th>
              <th className="px-6 py-3 font-semibold">Payment Approved</th>
              <th className="px-6 py-3 font-semibold">Teaching Group</th>
              <th className="px-6 py-3 font-semibold">Teacher</th>
              <th className="px-6 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-6 py-6 text-slate-600">
                  Loading approved enrollments...
                </td>
              </tr>
            )}

            {!isLoading && enrollments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-6 text-slate-600">
                  There are no payment-approved enrollments awaiting assignment.
                </td>
              </tr>
            )}

            {enrollments.map((enrollment) => {
              const groups = candidateGroups[enrollment.id] ?? []
              const isLegacyTeacherAssignment = enrollment.status === 'teacher_assignment'
              const memberships = enrollment.students?.teaching_group_students ?? []
              const existingMembership = memberships.length === 1
                ? memberships[0]
                : null
              const existingGroup = existingMembership?.teaching_groups ?? null
              const hasCompatibleExistingMembership = existingGroup !== null
                && existingGroup.is_active
                && existingGroup.level_id === enrollment.level_id
                && existingGroup.group_type === enrollment.package_type
              const existingMembershipPredatesEnrollment = existingMembership !== null
                && new Date(existingMembership.joined_at) < new Date(enrollment.created_at)
              const selectedGroup = groups.find(
                (group) => group.id === selectedGroups[enrollment.id],
              )
              const isProcessing = isAssigning === enrollment.id

              return (
                <tr key={enrollment.id}>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">
                      {enrollment.students?.profiles?.full_name ?? 'Unknown student'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {enrollment.students?.student_code ?? 'No student code'}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    {enrollment.levels
                      ? `${enrollment.levels.level_number}. ${enrollment.levels.name}`
                      : 'Unknown level'}
                  </td>
                  <td className="px-6 py-4">
                    {enrollment.package_type === 'private' ? 'Private' : 'Semi-private'}
                  </td>
                  <td className="px-6 py-4">
                    {new Date(enrollment.updated_at).toLocaleDateString()}
                    {isLegacyTeacherAssignment && (
                      <p className="mt-1 text-xs text-amber-700">
                        Teacher assignment awaiting activation
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {memberships.length === 0 && !isLegacyTeacherAssignment ? (
                      <select
                        aria-label={`Teaching group for ${enrollment.students?.profiles?.full_name ?? 'student'}`}
                        value={selectedGroups[enrollment.id] ?? ''}
                        onChange={(event) => {
                          setSelectedGroups((current) => ({
                            ...current,
                            [enrollment.id]: event.target.value,
                          }))
                        }}
                        disabled={isProcessing || groups.length === 0}
                        className="min-w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        <option value="">
                          {groups.length === 0 ? 'No compatible active groups' : 'Select teaching group'}
                        </option>
                        {groups.map((group) => {
                          const capacity = group.group_type === 'private' ? 1 : 4
                          return (
                            <option key={group.id} value={group.id}>
                              {group.name} ({group.teaching_group_students.length}/{capacity})
                            </option>
                          )
                        })}
                      </select>
                    ) : existingGroup ? (
                      <div>
                        <p className="font-medium text-slate-900">{existingGroup.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Joined {new Date(existingMembership!.joined_at).toLocaleDateString()} · {existingGroup.teaching_group_students.length}/{existingGroup.group_type === 'private' ? 1 : 4}
                        </p>
                        <p className={`mt-1 text-xs ${hasCompatibleExistingMembership ? 'text-emerald-700' : 'text-red-700'}`}>
                          {hasCompatibleExistingMembership ? 'Compatible existing assignment' : 'Conflicting existing assignment'}
                        </p>
                        <p className="mt-1 text-xs text-amber-700">
                          {existingMembershipPredatesEnrollment
                            ? 'This membership predates the current enrollment.'
                            : 'This membership does not predate the current enrollment.'}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-red-700">Conflicting existing assignment</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {existingGroup
                      ? `${existingGroup.teachers?.profiles?.full_name ?? 'Unknown teacher'} (${existingGroup.teachers?.teacher_code ?? 'no code'})`
                      : selectedGroup
                      ? `${selectedGroup.teachers?.profiles?.full_name ?? 'Unknown teacher'} (${selectedGroup.teachers?.teacher_code ?? 'no code'})`
                      : 'Select a group'}
                  </td>
                  <td className="px-6 py-4">
                    {isLegacyTeacherAssignment ? (
                      hasCompatibleExistingMembership && existingGroup ? (
                        <button
                          type="button"
                          onClick={() => void handleActivateExistingAssignment(enrollment, existingGroup.id)}
                          disabled={isProcessing}
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isProcessing ? 'Activating...' : 'Activate Existing Assignment'}
                        </button>
                      ) : (
                        <p className="text-sm text-red-700">
                          A valid existing assignment is required for activation.
                        </p>
                      )
                    ) : memberships.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => void handleAssign(enrollment)}
                        disabled={!selectedGroup || isProcessing}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isProcessing ? 'Assigning...' : 'Assign'}
                      </button>
                    ) : hasCompatibleExistingMembership && existingMembershipPredatesEnrollment ? (
                      <button
                        type="button"
                        onClick={() => void handleAdoptExistingAssignment(enrollment)}
                        disabled={isProcessing}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isProcessing ? 'Adopting...' : 'Use Existing Assignment'}
                      </button>
                    ) : (
                      <p className="text-sm text-red-700">
                        {memberships.length > 1
                          ? 'Multiple existing memberships must be resolved first.'
                          : 'Existing membership cannot be adopted.'}
                      </p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <section className="mt-10 overflow-x-auto rounded-xl border border-amber-200 bg-amber-50 shadow-sm">
        <div className="border-b border-amber-200 px-6 py-5">
          <h3 className="text-xl font-semibold text-amber-950">Active Enrollment Assignment Exceptions</h3>
          <p className="mt-1 text-sm text-amber-900">
            Active enrollments with valid group membership but no enrollment-specific teaching group assignment.
          </p>
        </div>

        {isLoading ? (
          <p className="px-6 py-6 text-sm text-amber-900">Loading assignment exceptions...</p>
        ) : assignmentExceptions.length === 0 ? (
          <p className="px-6 py-6 text-sm text-amber-900">There are no active enrollment assignment exceptions.</p>
        ) : (
          <table className="min-w-full divide-y divide-amber-200 text-left text-sm">
            <thead className="bg-amber-100/70 text-amber-950">
              <tr>
                <th className="px-6 py-3 font-semibold">Student</th>
                <th className="px-6 py-3 font-semibold">Level</th>
                <th className="px-6 py-3 font-semibold">Package</th>
                <th className="px-6 py-3 font-semibold">Current Membership</th>
                <th className="px-6 py-3 font-semibold">Assignment State</th>
                <th className="px-6 py-3 font-semibold">Confirm Teaching Group</th>
                <th className="px-6 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200 bg-white text-slate-700">
              {assignmentExceptions.map((exception) => {
                const selectionKey = getExceptionSelectionKey(exception)
                const selectedGroupId = selectedExceptionGroups[selectionKey] ?? ''
                const isProcessing = isReconciling === exception.enrollment_id

                return (
                  <tr key={`${exception.enrollment_id}-${exception.teaching_group_id}`}>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{exception.student_display_name}</p>
                      <p className="mt-1 text-xs text-slate-500">{exception.student_code}</p>
                    </td>
                    <td className="px-6 py-4">{exception.level_number}. {exception.level_name}</td>
                    <td className="px-6 py-4">
                      {exception.package_type === 'private' ? 'Private' : 'Semi-private'}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{exception.teaching_group_name}</p>
                      <p className="mt-1 text-xs text-slate-500">Teacher: {exception.teacher_code}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                        Missing
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        aria-label={`Teaching group for ${exception.student_code}`}
                        value={selectedGroupId}
                        onChange={(event) => {
                          setSelectedExceptionGroups((current) => ({
                            ...current,
                            [selectionKey]: event.target.value,
                          }))
                        }}
                        disabled={isProcessing}
                        className="min-w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        <option value="">Select teaching group</option>
                        <option value={exception.teaching_group_id}>
                          {exception.teaching_group_name}
                        </option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => void handleReconcileAssignment(exception)}
                        disabled={!selectedGroupId || isProcessing}
                        className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isProcessing ? 'Reconciling...' : 'Reconcile Assignment'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </section>
  )
}
