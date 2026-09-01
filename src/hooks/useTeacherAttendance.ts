import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import {
  getMyTeacherAttendance,
  recordTeacherAttendance,
  type TeacherAttendancePeriod,
} from '../services/teacher-attendance.service'

type AttendanceStatus = 'present' | 'absent'

function formatDateAsIso(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function normalizeReferenceDate(referenceDate: string | Date) {
  if (referenceDate instanceof Date) {
    return formatDateAsIso(referenceDate)
  }

  return referenceDate.slice(0, 10)
}

function getErrorDetails(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return { code: '', message: '' }
  }

  const candidate = error as { code?: unknown; message?: unknown }
  return {
    code: typeof candidate.code === 'string' ? candidate.code : '',
    message: typeof candidate.message === 'string' ? candidate.message : '',
  }
}

function isDuplicateAttendanceError(error: unknown) {
  const { code, message } = getErrorDetails(error)

  return code === '23505' || message.includes('already been recorded')
}

function getMutationErrorMessage(error: unknown) {
  const { code, message } = getErrorDetails(error)

  if (isDuplicateAttendanceError(error)) {
    return 'Attendance was already recorded. The list has been refreshed.'
  }

  if (message.includes('session limit')) {
    return 'This enrollment has reached its session limit.'
  }

  if (message.includes('Active teacher access')) {
    return 'Your teacher access is not active.'
  }

  if (
    code === '42501'
    || message.includes('not owned')
    || message.includes('not found')
    || message.includes('Meeting ')
    || message.includes('teaching group')
    || message.includes('not assigned')
    || message.includes('not eligible')
  ) {
    return 'Attendance cannot be recorded for this meeting.'
  }

  return 'Unable to record attendance. Please try again.'
}

export function useTeacherAttendance(
  period: TeacherAttendancePeriod,
  referenceDate: string | Date,
  enabled: boolean,
) {
  const queryClient = useQueryClient()
  const normalizedReferenceDate = normalizeReferenceDate(referenceDate)
  const queryKey = ['teacher-attendance', period, normalizedReferenceDate] as const
  const recordingMeetingIds = useRef(new Set<string>())
  const [recordingMeetingId, setRecordingMeetingId] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)

  const query = useQuery({
    queryKey,
    queryFn: () => getMyTeacherAttendance(period, normalizedReferenceDate),
    enabled,
    placeholderData: keepPreviousData,
  })

  const mutation = useMutation({
    mutationFn: recordTeacherAttendance,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: async (error) => {
      if (isDuplicateAttendanceError(error)) {
        await queryClient.invalidateQueries({ queryKey })
      }
    },
  })

  const recordAttendance = useCallback(async (meetingId: string, teacherStatus: AttendanceStatus) => {
    if (recordingMeetingIds.current.has(meetingId)) {
      return
    }

    recordingMeetingIds.current.add(meetingId)
    setRecordingMeetingId(meetingId)
    setMutationError(null)

    try {
      await mutation.mutateAsync({ meetingId, teacherStatus })
    } catch (error) {
      setMutationError(getMutationErrorMessage(error))
    } finally {
      recordingMeetingIds.current.delete(meetingId)
      setRecordingMeetingId((currentMeetingId) => (
        currentMeetingId === meetingId ? null : currentMeetingId
      ))
    }
  }, [mutation])

  return {
    meetings: query.data ?? [],
    loading: query.isLoading,
    error: query.isError ? 'Unable to load attendance. Please try again.' : null,
    isUpdating: query.isFetching && !query.isLoading,
    mutationError,
    mutationLoading: mutation.isPending,
    recordingMeetingId,
    recordAttendance,
    reload: query.refetch,
  }
}
