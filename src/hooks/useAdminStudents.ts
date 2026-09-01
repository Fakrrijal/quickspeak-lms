import { useQuery } from '@tanstack/react-query'
import { getAdminStudents } from '../services/admin.service'

export function useAdminStudents(enabled: boolean) {
  const query = useQuery({
    queryKey: ['admin-students'],
    queryFn: getAdminStudents,
    enabled,
  })

  return {
    students: query.data ?? [],
    isLoading: query.isLoading,
    error: query.isError ? 'Unable to load students.' : null,
    reload: query.refetch,
  }
}
