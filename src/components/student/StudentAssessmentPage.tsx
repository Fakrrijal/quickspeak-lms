import { useEffect, useState } from 'react'
import { useAuthContext } from '../../providers/AuthProvider'
import { getStudentLevelPackageStatus, type StudentLevelPackageStatus } from '../../services/level-completion.service'

export function StudentAssessmentPage() {
  const { profile, role, status, isAuthenticated, loading: authLoading, profileLoading, profileError } = useAuthContext()
  const [packageStatus, setPackageStatus] = useState<StudentLevelPackageStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!(isAuthenticated && role === 'student' && status === 'active')) return
    let cancelled = false
    getStudentLevelPackageStatus().then((data) => { if (!cancelled) setPackageStatus(data) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isAuthenticated, role, status])

  if (authLoading || profileLoading) return <section className="border border-slate-200 bg-white p-6 shadow-sm"><div className="h-8 w-52 animate-pulse rounded bg-slate-100" /></section>
  if (!isAuthenticated || !profile || profileError || role !== 'student' || status !== 'active') return null

  return <div className="space-y-6">
    <header className="border-b border-slate-200 pb-5"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Assessment</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[#102449]">Penilaian</h1><p className="mt-1.5 text-sm leading-6 text-slate-600">Penilaian dilakukan oleh teacher ketika satu level dinyatakan selesai.</p></header>
    {loading ? <div className="h-28 animate-pulse rounded-xl bg-slate-50" /> : packageStatus ? <section className="border border-slate-200 bg-white p-6 shadow-sm sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Current Level</p><h2 className="mt-1 text-2xl font-extrabold text-[#102449]">Level {packageStatus.current_level_number}</h2><p className="mt-1 text-sm font-semibold text-blue-700">{packageStatus.current_level_name}</p></div><span className={`rounded-md px-2.5 py-1.5 text-xs font-bold ${packageStatus.level_completed ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{packageStatus.level_completed ? 'Level completed' : 'In progress'}</span></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Sessions</p><p className="mt-1.5 text-xl font-extrabold text-[#102449]">{packageStatus.current_package_session_count}/{packageStatus.session_limit}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Status</p><p className="mt-1.5 text-sm font-extrabold text-[#102449]">{packageStatus.current_package_status ?? '—'}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Result</p><p className="mt-1.5 text-sm font-extrabold text-[#102449]">{packageStatus.level_completed ? 'Available in History' : 'Not available yet'}</p></div></div><div className="mt-5 border-t border-slate-200 pt-4 text-sm leading-6 text-slate-600">Final assessment uses Speaking, Listening, Vocabulary, Grammar, and Pronunciation. Teacher feedback is saved with the completed level result.</div></section> : <section className="border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">No active level assessment yet.</section>}
  </div>
}
