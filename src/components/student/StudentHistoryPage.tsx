import { StudentLevelAssessmentHistory } from './StudentLevelAssessmentHistory'
import { useAuthContext } from '../../providers/AuthProvider'

export function StudentHistoryPage() {
  const { profile, role, status, isAuthenticated, loading, profileLoading, profileError } = useAuthContext()
  if (loading || profileLoading) return <section className="border border-slate-200 bg-white p-6 shadow-sm"><div className="h-8 w-52 animate-pulse rounded bg-slate-100" /></section>
  if (!isAuthenticated || !profile || profileError || role !== 'student' || status !== 'active') return null
  return <div className="space-y-6">
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Learning History</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[#102449]">History</h1><p className="mt-1.5 text-sm leading-6 text-slate-600">Hanya level yang sudah selesai oleh teacher yang tampil di sini.</p></div><a href="/student/learning?view=assessment" className="text-sm font-bold text-blue-700">View Current Assessment →</a></header>
    <StudentLevelAssessmentHistory />
  </div>
}
