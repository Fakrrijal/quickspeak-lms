import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { getMyTeacherLearningProgress, markTeacherMaterialCompleted, type TeacherLearningProgressRow } from '../../services/teacher-learning-progress.service'

export const Route = createFileRoute('/teacher/learning-progress')({ component: TeacherLearningProgressPage })

type StudentGroup = {
  studentId: string
  studentName: string
  levelName: string
  ebookTitle: string | null
  chapters: Map<string, {
    id: string
    number: number
    title: string
    materials: Array<{
      id: string
      number: number
      title: string
      completedAt: string | null
    }>
  }>
}

function buildStudents(rows: TeacherLearningProgressRow[]) {
  const students = new Map<string, StudentGroup>()
  for (const row of rows) {
    const student = students.get(row.student_id) ?? {
      studentId: row.student_id,
      studentName: row.student_name,
      levelName: row.level_name,
      ebookTitle: row.ebook_title,
      chapters: new Map(),
    }
    if (row.chapter_id && row.chapter_number !== null && row.chapter_title) {
      const chapter = student.chapters.get(row.chapter_id) ?? {
        id: row.chapter_id,
        number: row.chapter_number,
        title: row.chapter_title,
        materials: [],
      }
      if (row.material_id && row.material_number !== null && row.material_title) {
        chapter.materials.push({
          id: row.material_id,
          number: row.material_number,
          title: row.material_title,
          completedAt: row.completed_at,
        })
      }
      student.chapters.set(row.chapter_id, chapter)
    }
    students.set(row.student_id, student)
  }
  return [...students.values()].map((student) => ({
    ...student,
    chapters: [...student.chapters.values()].sort((a, b) => a.number - b.number),
  }))
}

function TeacherLearningProgressPage() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [rows, setRows] = useState<TeacherLearningProgressRow[]>([])
  const [search, setSearch] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingMaterialId, setSavingMaterialId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canLoad = !authLoading && !profileLoading && isAuthenticated && Boolean(profile) && !profileError && role === 'teacher' && status === 'active'

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || !profile || profileError || status === null) navigate({ to: '/login', replace: true })
    else if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  useEffect(() => {
    if (!canLoad) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getMyTeacherLearningProgress(activeSearch)
      .then((data) => {
        if (cancelled) return
        setRows(data)
        setLoading(false)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load learning progress')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [activeSearch, canLoad])

  const students = useMemo(() => buildStudents(rows), [rows])

  async function completeMaterial(studentId: string, materialId: string) {
    setSavingMaterialId(materialId)
    setError(null)
    try {
      await markTeacherMaterialCompleted(studentId, materialId)
      const refreshed = await getMyTeacherLearningProgress(activeSearch)
      setRows(refreshed)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to mark material as completed')
    } finally {
      setSavingMaterialId(null)
    }
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActiveSearch(search)
    setExpandedStudentId(null)
  }

  if (authLoading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || !profile || profileError || status === null || status === 'waiting') return null
  if (role !== 'teacher' || status !== 'active') return <p>Access denied.</p>

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Teacher Portal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#102449] sm:text-4xl">Learning Progress</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Track completed learning materials for each student in your assigned teaching groups.</p>
      </header>

      <form onSubmit={submitSearch} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="teacher-learning-progress-search">Search student name</label>
        <input
          id="teacher-learning-progress-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search student name..."
          className="h-11 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <button type="submit" className="h-11 rounded-xl bg-[#102449] px-5 text-sm font-bold text-white transition hover:bg-[#17325f]">Search</button>
        {activeSearch && <button type="button" onClick={() => { setSearch(''); setActiveSearch('') }} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Clear</button>}
      </form>

      {loading ? (
        <div className="space-y-4">{[1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />)}</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">{error}</div>
      ) : students.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <h2 className="text-lg font-bold text-[#102449]">No learning progress found</h2>
          <p className="mt-2 text-sm text-slate-600">Learning content will appear here when chapters and materials are configured for the student&apos;s book.</p>
        </section>
      ) : (
        <section className="space-y-4">
          {students.map((student) => {
            const expanded = expandedStudentId === student.studentId
            return (
              <article key={student.studentId} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button type="button" onClick={() => setExpandedStudentId(expanded ? null : student.studentId)} className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-xl font-bold tracking-[-0.02em] text-[#102449]">{student.studentName}</h2>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{student.levelName}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{student.ebookTitle ?? 'Book content not configured'}</p>
                  </div>
                  <span className="shrink-0 text-lg font-bold text-slate-400" aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
                </button>

                {expanded && (
                  <div className="border-t border-slate-100 p-5 sm:p-6">
                    {student.chapters.length === 0 ? (
                      <p className="text-sm text-slate-600">No chapters or materials have been configured for this book yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {student.chapters.map((chapter) => (
                          <div key={chapter.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Chapter {chapter.number}</p>
                                <h3 className="mt-1 text-base font-bold text-[#102449]">{chapter.title}</h3>
                              </div>
                              <span className="text-xs font-semibold text-slate-500">{chapter.materials.filter((material) => material.completedAt).length}/{chapter.materials.length} completed</span>
                            </div>
                            <div className="mt-4 space-y-2">
                              {chapter.materials.map((material) => (
                                <div key={material.id} className="flex items-center justify-between gap-4 rounded-xl border border-white bg-white px-4 py-3 shadow-sm">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800">{material.number}. {material.title}</p>
                                  </div>
                                  {material.completedAt ? (
                                    <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">✓ Completed</span>
                                  ) : (
                                    <button type="button" disabled={savingMaterialId === material.id} onClick={() => completeMaterial(student.studentId, material.id)} className="shrink-0 rounded-lg bg-[#102449] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#17325f] disabled:cursor-wait disabled:opacity-60">
                                      {savingMaterialId === material.id ? 'Saving...' : 'Mark Completed'}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
