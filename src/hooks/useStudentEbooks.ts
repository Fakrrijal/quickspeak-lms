import { useCallback, useEffect, useState } from 'react'
import {
  getMyPublishedEbooks,
  type StudentEbook,
} from '../services/student-ebook.service'

export function useStudentEbooks(enabled: boolean) {
  const [ebooks, setEbooks] = useState<StudentEbook[]>([])
  const [catalog, setCatalog] = useState<StudentEbook[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(false)

  const loadEbooks = useCallback(async () => {
    setLoading(true)
    setError(false)

    try {
      const nextCatalog = await getMyPublishedEbooks()
      setCatalog(nextCatalog)
      setEbooks(nextCatalog.filter((ebook) => ebook.is_unlocked))
    } catch {
      setCatalog([])
      setEbooks([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setEbooks([])
      setCatalog([])
      setError(false)
      setLoading(false)
      return
    }

    void loadEbooks()
  }, [enabled, loadEbooks])

  return { ebooks, catalog, loading, error, reload: loadEbooks }
}
