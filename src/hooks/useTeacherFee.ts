import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getMyTeacherFeeReportAllTime, getMyTeacherFeeReportRange } from '../services/teacher-fee.service'

export function useTeacherFee(startDate: string, endDate: string, enabled: boolean, allTime = false) {
  const reportQuery = useQuery({
    queryKey: ['teacher-fee-report', allTime ? 'all-time' : 'range', startDate, endDate],
    queryFn: () => allTime ? getMyTeacherFeeReportAllTime() : getMyTeacherFeeReportRange(startDate, endDate),
    enabled,
    placeholderData: keepPreviousData,
  })

  return {
    entries: reportQuery.data?.entries ?? [],
    detailEntries: reportQuery.data?.detail_entries ?? [],
    monthlySummaries: reportQuery.data?.monthly_summaries ?? [],
    detailReconcilesPeriod: reportQuery.data?.detail_reconciles_period ?? true,
    loading: reportQuery.isLoading,
    error: reportQuery.isError ? 'Unable to load teacher fee data. Please try again.' : null,
    reload: async () => {
      await reportQuery.refetch()
    },
  }
}
