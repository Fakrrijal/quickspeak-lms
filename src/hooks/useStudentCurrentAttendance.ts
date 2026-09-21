import { useCallback, useEffect, useState } from 'react'
import {
  getMyCurrentStudentAttendanceSummary,
  type StudentCurrentAttendanceSummary,
} from '../services/student-attendance.service'
import { reportSystemError } from '../lib/systemErrorReporter'

export function useStudentCurrentAttendance(enabled: boolean) {
  const [attendance, setAttendance] = useState<StudentCurrentAttendanceSummary | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(false)

  const loadAttendance = useCallback(async () => {
    setLoading(true)
    setError(false)

    try {
      setAttendance(await getMyCurrentStudentAttendanceSummary())
    } catch (loadError) {
      setAttendance(null)
      setError(true)
      await reportSystemError({
        feature: 'ATTENDANCE',
        action: 'LOAD_STUDENT_CURRENT_ATTENDANCE',
        error: loadError,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setAttendance(null)
      setError(false)
      setLoading(false)
      return
    }

    void loadAttendance()
  }, [enabled, loadAttendance])

  return {
    attendance,
    loading,
    error,
    reload: loadAttendance,
  }
}
