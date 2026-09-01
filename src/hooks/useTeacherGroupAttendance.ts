import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import {
  getMyTeacherAttendanceGroups,
  recordTeacherGroupAttendance,
  type RecordTeacherGroupAttendanceInput,
} from '../services/teacher-attendance.service'

function getErrorMessage(error: unknown) {
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String(error.message)
    : ''

  if (message.includes('session limit')) {
    return 'One or more students have reached the 8-session limit. No attendance was saved.'
  }

  if (message.includes('already been recorded')) {
    return 'Attendance has already been saved for this teaching group today.'
  }

  if (message.includes('every current active student')) {
    return 'The group changed. Please review the student list and try again.'
  }

  return 'Unable to save attendance. No attendance was recorded.'
}

export function useTeacherGroupAttendance(enabled: boolean) {
  const queryClient = useQueryClient()
  const queryKey = ['teacher-attendance-groups'] as const
  const [mutationError, setMutationError] = useState<string | null>(null)

  const query = useQuery({
    queryKey,
    queryFn: getMyTeacherAttendanceGroups,
    enabled,
  })

  const mutation = useMutation({
    mutationFn: recordTeacherGroupAttendance,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
      await queryClient.invalidateQueries({ queryKey: ['teacher-attendance'] })
      await queryClient.invalidateQueries({ queryKey: ['student-attendance'] })
    },
  })

  const saveAttendance = useCallback(async (input: RecordTeacherGroupAttendanceInput) => {
    setMutationError(null)

    try {
      await mutation.mutateAsync(input)
      return true
    } catch (error) {
      setMutationError(getErrorMessage(error))
      return false
    }
  }, [mutation])

  return {
    groups: query.data ?? [],
    loading: query.isLoading,
    error: query.isError ? 'Unable to load teaching groups. Please try again.' : null,
    mutationError,
    saving: mutation.isPending,
    saveAttendance,
    reload: query.refetch,
  }
}
