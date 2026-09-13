import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAdminDashboardSummary } from '../services/admin.service'
import { getAdminTeacherFeePeriods } from '../services/teacher-fee.service'
import { reportSystemError } from '../lib/systemErrorReporter'
import { supabase } from '../lib/supabase'

export function useAdminDashboard(enabled: boolean) {
  const today = new Date()
  const month = today.getMonth() + 1
  const year = today.getFullYear()

  const summaryQuery = useQuery({
    queryKey: ['admin-dashboard-summary'],
    queryFn: getAdminDashboardSummary,
    enabled,
  })
  const verifiedWaitingStudentsQuery = useQuery({
    queryKey: ['admin-dashboard-verified-waiting-students'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_waiting_students')
      if (error) throw error
      return data ?? []
    },
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
    if (verifiedWaitingStudentsQuery.isError) {
      void reportSystemError({
        feature: 'DASHBOARD',
        action: 'LOAD_DASHBOARD',
        error: verifiedWaitingStudentsQuery.error,
      })
    }
  }, [verifiedWaitingStudentsQuery.isError, verifiedWaitingStudentsQuery.error])

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
  const verifiedWaitingStudents = verifiedWaitingStudentsQuery.data ?? []
  const summary = summaryQuery.data
    ? {
        ...summaryQuery.data,
        waitingStudents: verifiedWaitingStudents.length,
      }
    : null

  return {
    summary,
    outstandingTeacherFees: unpaidPeriods.reduce((total, period) => total + period.earned_amount, 0),
    unpaidTeacherPeriods: unpaidPeriods.length,
    isLoading:
      summaryQuery.isLoading ||
      verifiedWaitingStudentsQuery.isLoading ||
      feePeriodsQuery.isLoading,
    error:
      summaryQuery.isError || verifiedWaitingStudentsQuery.isError || feePeriodsQuery.isError
        ? 'Unable to load the admin dashboard summary. Please try again.'
        : null,
  }
}
