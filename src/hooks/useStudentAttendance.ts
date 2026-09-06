import { useCallback, useEffect, useState } from 'react'
import {
  getMyStudentAttendance,
  type StudentAttendanceRecord,
} from '../services/student-attendance.service'
import { reportSystemError } from '../lib/systemErrorReporter'

export function useStudentAttendance(enabled: boolean, month = new Date().getMonth() + 1, year = new Date().getFullYear()) {
  const [attendance, setAttendance] = useState<StudentAttendanceRecord[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(false)

  const loadAttendance = useCallback(async () => {
    setLoading(true)
    setError(false)

    try {
      setAttendance(await getMyStudentAttendance(month, year))
    } catch (error) {
      setError(true)
      await reportSystemError({
        feature: 'ATTENDANCE',
        action: 'LOAD_STUDENT_ATTENDANCE',
        error,
      })
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    if (!enabled) {
      setAttendance([])
      setError(false)
      setLoading(false)
      return
    }

    void loadAttendance()
  }, [enabled, loadAttendance])

  return { attendance, loading, error, reload: loadAttendance }
}
