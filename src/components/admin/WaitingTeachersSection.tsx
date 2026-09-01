import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  approveTeacher,
  getWaitingTeachers,
  rejectWaitingTeacher,
  type WaitingTeacher,
} from '../../services/admin.service'

type WaitingTeachersSectionProps = { enabled: boolean }
const date = (value: string) => new Intl.DateTimeFormat('en-US').format(new Date(value))
const label = (value: string | null) => value === 'semi_private' ? 'Semi-private' : value === 'private' ? 'Private' : 'Not available'

export function WaitingTeachersSection({ enabled }: WaitingTeachersSectionProps) {
  const [teachers, setTeachers] = useState<WaitingTeacher[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [rejectedTeacher, setRejectedTeacher] = useState<WaitingTeacher | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { try { setError(null); setTeachers(await getWaitingTeachers()) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load waiting teachers.') } }, [])

  useEffect(() => {
    if (!enabled) return
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [enabled, load])
  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return teachers.filter((teacher) => !query || [teacher.full_name, teacher.email, teacher.phone ?? ''].some((value) => value.toLowerCase().includes(query))) }, [search, teachers])
  const approve = async (teacher: WaitingTeacher) => { setBusy(teacher.id); setError(null); setSuccess(null); try { await approveTeacher(teacher.id); await load() } catch (approveError) { setError(approveError instanceof Error ? approveError.message : 'Unable to approve this teacher.') } finally { setBusy(null) } }
  const reject = async () => { if (!rejectedTeacher) return; setBusy(rejectedTeacher.id); setError(null); setSuccess(null); try { await rejectWaitingTeacher(rejectedTeacher.id); setRejectedTeacher(null); setSuccess('Teacher registration rejected.'); await load() } catch (rejectError) { setError(rejectError instanceof Error ? rejectError.message : 'Unable to reject this teacher.') } finally { setBusy(null) } }

  return <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><label className="block"><span className="sr-only">Search waiting teachers</span><input aria-label="Search waiting teachers" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or phone..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>{success && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</p>}{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">{!error && filtered.length === 0 ? <p className="p-6 text-sm text-slate-600">{teachers.length === 0 ? 'No waiting teachers.' : 'No waiting teachers match the current search.'}</p> : <table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{['Teacher', 'Email', 'Phone', 'Supported Levels', 'Class Type', 'Registration Date', 'Status', 'Actions'].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-200">{filtered.map((teacher) => <tr key={teacher.id}><td className="px-4 py-3 font-medium">{teacher.full_name}</td><td className="px-4 py-3">{teacher.email}</td><td className="px-4 py-3">{teacher.phone ?? 'Not available'}</td><td className="px-4 py-3">{teacher.supported_levels.length ? teacher.supported_levels.map((level) => level.name).join(', ') : 'Not available'}</td><td className="px-4 py-3">{label(teacher.class_type)}</td><td className="px-4 py-3">{date(teacher.registration_date)}</td><td className="px-4 py-3">{teacher.status}</td><td className="px-4 py-3"><div className="flex gap-2"><button type="button" onClick={() => void approve(teacher)} disabled={busy === teacher.id} className="rounded-lg bg-slate-900 px-3 py-2 text-white disabled:opacity-50">{busy === teacher.id ? 'Approving...' : 'Approve'}</button><button type="button" onClick={() => { setError(null); setSuccess(null); setRejectedTeacher(teacher) }} disabled={busy !== null} className="rounded-lg bg-red-700 px-3 py-2 text-white disabled:opacity-50">Reject</button></div></td></tr>)}</tbody></table>}</div>{rejectedTeacher && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="reject-teacher-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"><h3 id="reject-teacher-title" className="text-xl font-semibold text-slate-900">Reject Teacher?</h3><p className="mt-3 text-sm text-slate-600">This applicant will not be approved as a QuickSpeak Teacher. Their registration history will be preserved.</p>{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setRejectedTeacher(null)} disabled={busy !== null} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button><button type="button" onClick={() => void reject()} disabled={busy !== null} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Rejecting...' : 'Reject'}</button></div></section></div>}</section>
}

