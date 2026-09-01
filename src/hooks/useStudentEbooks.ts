import { useCallback, useEffect, useState } from 'react'
import {
  getMyActiveLevelEbooks,
  type StudentEbook,
} from '../services/student-ebook.service'

export function useStudentEbooks(enabled: boolean) {
  const [ebooks, setEbooks] = useState<StudentEbook[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(false)

  const loadEbooks = useCallback(async () => {
    setLoading(true)
    setError(false)

    try {
      setEbooks(await getMyActiveLevelEbooks())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setEbooks([])
      setError(false)
      setLoading(false)
      return
    }

    void loadEbooks()
  }, [enabled, loadEbooks])

  return { ebooks, loading, error, reload: loadEbooks }
}
