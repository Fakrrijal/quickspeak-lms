import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getMyTeacherFeeReport } from '../services/teacher-fee.service'

export function useTeacherFee(month: number, year: number, enabled: boolean) {
  const reportQuery = useQuery({
    queryKey: ['teacher-fee-report', month, year],
    queryFn: () => getMyTeacherFeeReport(month, year),
    enabled,
    placeholderData: keepPreviousData,
  })

  return {
    entries: reportQuery.data?.entries ?? [],
    detailEntries: reportQuery.data?.detail_entries ?? [],
    detailReconcilesPeriod: reportQuery.data?.detail_reconciles_period ?? true,
    periodSummary: reportQuery.data?.period_summary ?? null,
    loading: reportQuery.isLoading,
    error: reportQuery.isError ? 'Unable to load teacher fee data. Please try again.' : null,
    reload: async () => {
      await reportQuery.refetch()
    },
  }
}
