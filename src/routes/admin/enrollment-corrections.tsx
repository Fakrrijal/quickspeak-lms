import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import {
  adminEditPaidEnrollment,
  getEditablePaidEnrollments,
  getEnrollmentCorrectionLevels,
  type EnrollmentCorrectionItem,
  type EnrollmentCorrectionLevel,
} from '../../services/admin-enrollment-correction.service'

export const Route = createFileRoute('/admin/enrollment-corrections')({
  component: EnrollmentCorrectionsPage,
})

type EditState = {
  enrollmentId: string
  levelId: string
  packageType: 'private' | 'semi_private'
}

function EnrollmentCorrectionsPage() {
  const {
    isAuthenticated,
    loading,
    profileLoading,
    profileError,
    role,
    status,
  } = useAuthContext()
  const navigate = useNavigate()
  const [enrollments, setEnrollments] = useState<EnrollmentCorrectionItem[]>([])
  const [levels, setLevels] = useState<EnrollmentCorrectionLevel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (loading || profileLoading) return
    if (!isAuthenticated || profileError || status === null) {
      navigate({ to: '/login', replace: true })
      return
    }
    if (status !== 'active') {
      navigate({ to: '/waiting', replace: true })
    }
  }, [isAuthenticated, loading, navigate, profileError, profileLoading, status])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [paidEnrollments, levelRows] = await Promise.all([
        getEditablePaidEnrollments(),
        getEnrollmentCorrectionLevels(),
      ])
      setEnrollments(paidEnrollments)
      setLevels(levelRows)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load enrollment corrections.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const canManage = isAuthenticated && role === 'admin' && status === 'active'

  useEffect(() => {
    if (canManage) void loadData()
  }, [canManage, loadData])

  const beginEdit = (enrollment: EnrollmentCorrectionItem) => {
    setError(null)
    setSuccessMessage(null)
    setEditState({
      enrollmentId: enrollment.id,
      levelId: enrollment.level_id,
      packageType: enrollment.package_type,
    })
  }

  const cancelEdit = () => {
    if (isSaving) return
    setEditState(null)
  }

  const saveEdit = async () => {
    if (!editState || isSaving) return

    const current = enrollments.find((item) => item.id === editState.enrollmentId)
    if (!current) return

    if (current.level_id === editState.levelId && current.package_type === editState.packageType) {
      setEditState(null)
      return
    }

    if (!window.confirm(
      'Simpan perubahan Level dan Kelas enrollment ini?\n\nData invoice dan pembayaran yang sudah ada tidak diubah.',
    )) {
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      await adminEditPaidEnrollment(
        editState.enrollmentId,
        editState.levelId,
        editState.packageType,
      )
      setSuccessMessage('Enrollment berhasil diperbarui. Level dan kelas baru akan menjadi acuan Teaching Group.')
      setEditState(null)
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the enrollment correction.')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || profileError || status !== 'active') return null

  if (role !== 'admin') {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <h2 className="text-xl font-semibold">Access denied</h2>
        <p className="mt-2">You do not have permission to edit paid enrollments.</p>
      </section>
    )
  }

  const selectedEnrollment = editState
    ? enrollments.find((item) => item.id === editState.enrollmentId) ?? null
    : null

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Admin Correction</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">Enrollment Corrections</h2>
          <p className="mt-2 max-w-3xl text-slate-600">
            Gunakan halaman ini hanya untuk memperbaiki Level atau Kelas pada enrollment yang sudah payment approved.
            Invoice dan riwayat pembayaran tidak diubah.
          </p>
        </div>
        <Link to="/admin/approved-enrollments" className="text-sm font-medium text-slate-700 underline">
          Back to Approved Enrollments
        </Link>
      </div>

      {successMessage && (
        <p className="mt-6 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{successMessage}</p>
      )}
      {error && (
        <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-6 py-3 font-semibold">Student</th>
              <th className="px-6 py-3 font-semibold">Current Level</th>
              <th className="px-6 py-3 font-semibold">Current Class</th>
              <th className="px-6 py-3 font-semibold">Payment</th>
              <th className="px-6 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-6 py-6">Loading approved enrollments...</td>
              </tr>
            )}
            {!isLoading && enrollments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-6">No payment-approved enrollments are available for correction.</td>
              </tr>
            )}
            {enrollments.map((enrollment) => (
              <tr key={enrollment.id}>
                <td className="px-6 py-4">
                  <p className="font-medium text-slate-900">{enrollment.students?.profiles?.full_name ?? 'Unknown student'}</p>
                  <p className="mt-1 text-xs text-slate-500">{enrollment.students?.profiles?.email ?? ''}</p>
                  <p className="mt-1 text-xs text-slate-500">{enrollment.students?.student_code ?? 'No student code'}</p>
                </td>
                <td className="px-6 py-4">
                  {enrollment.levels ? `Level ${enrollment.levels.level_number}` : 'Unknown level'}
                </td>
                <td className="px-6 py-4 font-medium">
                  {enrollment.package_type === 'private' ? 'Private' : 'Semi-Private'}
                </td>
                <td className="px-6 py-4">
                  <p className="font-medium text-slate-900">{enrollment.status === 'teacher_assignment' ? 'Teacher assignment' : 'Approved'}</p>
                  <p className="mt-1 text-xs text-slate-500">Rp{enrollment.price.toLocaleString('id-ID')}</p>
                </td>
                <td className="px-6 py-4">
                  <button
                    type="button"
                    onClick={() => beginEdit(enrollment)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedEnrollment && editState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Edit Enrollment</p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">{selectedEnrollment.students?.profiles?.full_name ?? 'Student'}</h3>
              <p className="mt-1 text-sm text-slate-500">Perubahan hanya pada Level dan Kelas enrollment.</p>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div>
                <label htmlFor="correction-level" className="mb-2 block text-sm font-semibold text-slate-800">Level</label>
                <select
                  id="correction-level"
                  value={editState.levelId}
                  onChange={(event) => setEditState((current) => current ? { ...current, levelId: event.target.value } : current)}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                >
                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>Level {level.level_number}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="correction-package" className="mb-2 block text-sm font-semibold text-slate-800">Kelas</label>
                <select
                  id="correction-package"
                  value={editState.packageType}
                  onChange={(event) => setEditState((current) => current ? { ...current, packageType: event.target.value as 'private' | 'semi_private' } : current)}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="private">Private</option>
                  <option value="semi_private">Semi-Private</option>
                </select>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                Perubahan ini tidak menghitung ulang atau mengubah invoice dan pembayaran yang sudah disetujui.
                Setelah disimpan, Level + Kelas enrollment menjadi acuan untuk Teaching Group.
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={isSaving}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={isSaving}
                className="rounded-lg bg-[#102449] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
