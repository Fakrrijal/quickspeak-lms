import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAdminDashboardSummary } from '../services/admin.service'
import { getAdminTeacherFeePeriods } from '../services/teacher-fee.service'
import { reportSystemError } from '../lib/systemErrorReporter'

export function useAdminDashboard(enabled: boolean) {
  const today = new Date()
  const month = today.getMonth() + 1
  const year = today.getFullYear()

  const summaryQuery = useQuery({
    queryKey: ['admin-dashboard-summary'],
    queryFn: getAdminDashboardSummary,
    enabled,
  })
  const feePeriodsQuery = useQuery({
    queryKey: ['admin-teacher-fee-periods', month, year],
    queryFn: () => getAdminTeacherFeePeriods(month, year),
    enabled,
  })

  useEffect(() => {
    if (summaryQuery.isError) {
      void reportSystemError({
        feature: 'DASHBOARD',
        action: 'LOAD_DASHBOARD',
        error: summaryQuery.error,
      })
    }
  }, [summaryQuery.isError, summaryQuery.error])

  useEffect(() => {
    if (feePeriodsQuery.isError) {
      void reportSystemError({
        feature: 'DASHBOARD',
        action: 'LOAD_DASHBOARD',
        error: feePeriodsQuery.error,
      })
    }
  }, [feePeriodsQuery.isError, feePeriodsQuery.error])

  const unpaidPeriods = (feePeriodsQuery.data ?? []).filter((period) => period.status === 'unpaid')

  return {
    summary: summaryQuery.data ?? null,
    outstandingTeacherFees: unpaidPeriods.reduce((total, period) => total + period.earned_amount, 0),
    unpaidTeacherPeriods: unpaidPeriods.length,
    isLoading: summaryQuery.isLoading || feePeriodsQuery.isLoading,
    error: summaryQuery.isError || feePeriodsQuery.isError
      ? 'Unable to load the admin dashboard summary. Please try again.'
      : null,
  }
}
