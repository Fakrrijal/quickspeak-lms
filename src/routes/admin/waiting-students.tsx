/* eslint-disable react-refresh/only-export-components -- TanStack file route. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import {
  approveStudent,
  rejectWaitingStudent,
  type WaitingStudent,
} from '../../services/admin.service'
import { getVerifiedWaitingStudents } from '../../services/admin-waiting.service'

export const Route = createFileRoute('/admin/waiting-students')({ component: WaitingStudentsPage })

const date = (value: string) => new Intl.DateTimeFormat('en-US').format(new Date(value))
const label = (value: string | null) => value === 'semi_private' ? 'Semi-private' : value === 'private' ? 'Private' : 'Not available'

function WaitingStudentsPage() {
  const { isAuthenticated, loading, profileLoading, profileError, role, status } = useAuthContext()
  const [students, setStudents] = useState<WaitingStudent[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [rejectedStudent, setRejectedStudent] = useState<WaitingStudent | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      setStudents(await getVerifiedWaitingStudents())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load waiting students.')
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || role !== 'admin' || status !== 'active') return
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [isAuthenticated, role, status, load])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return students.filter((student) => !query || [student.full_name, student.email, student.phone ?? ''].some((value) => value.toLowerCase().includes(query)))
  }, [search, students])

  const approve = async (student: WaitingStudent) => {
    if (!student.starting_level) return
    setBusy(student.id)
    setError(null)
    setSuccess(null)
    try {
      await approveStudent(student.id, student.starting_level.id)
      await load()
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Unable to approve this student.')
    } finally {
      setBusy(null)
    }
  }

  const reject = async () => {
    if (!rejectedStudent) return
    setBusy(rejectedStudent.id)
    setError(null)
    setSuccess(null)
    try {
      await rejectWaitingStudent(rejectedStudent.id)
      setRejectedStudent(null)
      setSuccess('Student registration rejected.')
      await load()
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : 'Unable to reject this student.')
    } finally {
      setBusy(null)
    }
  }

  if (loading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || profileError || status !== 'active') return null
  if (role !== 'admin') return <p>Access denied.</p>

  return <section>
    <h2 className="text-3xl font-bold text-slate-900">Waiting Students</h2>
    <p className="mt-2 text-slate-600">Review student registrations awaiting approval.</p>
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <label className="block"><span className="sr-only">Search waiting students</span><input aria-label="Search waiting students" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or phone..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
      {success && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
        {!error && filtered.length === 0 ? <p className="p-6 text-sm text-slate-600">{students.length === 0 ? 'No waiting students.' : 'No waiting students match the current search.'}</p> : <table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{['Student', 'Email', 'Phone', 'Starting Level', 'Class Type', 'Registration Date', 'Status', 'Actions'].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-200">{filtered.map((student) => <tr key={student.id}><td className="px-4 py-3 font-medium">{student.full_name}</td><td className="px-4 py-3">{student.email}</td><td className="px-4 py-3">{student.phone ?? 'Not available'}</td><td className="px-4 py-3">{student.starting_level?.name ?? 'Not available'}</td><td className="px-4 py-3">{label(student.class_type)}</td><td className="px-4 py-3">{date(student.registration_date)}</td><td className="px-4 py-3">{student.status}</td><td className="px-4 py-3"><div className="flex gap-2"><button type="button" onClick={() => void approve(student)} disabled={!student.starting_level || busy === student.id} className="rounded-lg bg-slate-900 px-3 py-2 text-white disabled:opacity-50">{busy === student.id ? 'Approving...' : 'Approve'}</button><button type="button" onClick={() => { setError(null); setSuccess(null); setRejectedStudent(student) }} disabled={busy !== null} className="rounded-lg bg-red-700 px-3 py-2 text-white disabled:opacity-50">Reject</button></div></td></tr>)}</tbody></table>}
      </div>
    </section>
    {rejectedStudent && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="reject-student-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"><h3 id="reject-student-title" className="text-xl font-semibold text-slate-900">Reject Student?</h3><p className="mt-3 text-sm text-slate-600">This applicant will not be approved as a QuickSpeak Student. Their registration history will be preserved.</p>{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setRejectedStudent(null)} disabled={busy !== null} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button><button type="button" onClick={() => void reject()} disabled={busy !== null} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Rejecting...' : 'Reject'}</button></div></section></div>}
  </section>
}

