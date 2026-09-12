// @ts-nocheck

import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import {
  getMyTeacherLearningProgress,
  markTeacherChapterCompleted,
  unmarkTeacherChapterCompleted,
  type TeacherLearningProgressRow,
} from '../../services/teacher-learning-progress.service'

export const Route = createFileRoute('/teacher/learning-progress')({ component: TeacherLearningProgressPage })

type StudentSummary = {
  studentId: string
  studentName: string
  currentLevelNumber: number
  currentLevelName: string
}

type Chapter = {
  id: string
  number: number
  title: string
  completedAt: string | null
}

type LevelSection = {
  levelNumber: number
  levelName: string
  ebookTitle: string | null
  chapters: Chapter[]
}

function buildStudentSummaries(rows: TeacherLearningProgressRow[]) {
  const students = new Map<string, StudentSummary>()
  for (const row of rows) {
    if (!students.has(row.student_id)) {
      students.set(row.student_id, {
        studentId: row.student_id,
        studentName: row.student_name,
        currentLevelNumber: row.current_level_number,
        currentLevelName: row.current_level_name,
      })
    }
  }
  return [...students.values()].sort((a, b) => a.studentName.localeCompare(b.studentName))
}

function buildLevels(rows: TeacherLearningProgressRow[], studentId: string | null) {
  const selectedRows = rows.filter((row) => row.student_id === studentId)
  const levelMap = new Map<number, LevelSection>()

  for (const row of selectedRows) {
    const level = levelMap.get(row.level_number) ?? {
      levelNumber: row.level_number,
      levelName: row.level_name,
      ebookTitle: row.ebook_title,
      chapters: [],
    }
    if (row.chapter_id && row.chapter_number !== null && row.chapter_title) {
      level.chapters.push({
        id: row.chapter_id,
        number: row.chapter_number,
        title: row.chapter_title,
        completedAt: row.completed_at,
      })
    }
    levelMap.set(row.level_number, level)
  }

  return [1, 2, 3, 4]
    .map((levelNumber) => levelMap.get(levelNumber) ?? {
      levelNumber,
      levelName: `Level ${levelNumber}`,
      ebookTitle: null,
      chapters: [],
    })
    .map((level) => ({
      ...level,
      chapters: [...new Map(level.chapters.map((chapter) => [chapter.id, chapter])).values()].sort((a, b) => a.number - b.number),
    }))
}

function TeacherLearningProgressPage() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [rows, setRows] = useState<TeacherLearningProgressRow[]>([])
  const [search, setSearch] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [selectedLevelNumber, setSelectedLevelNumber] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingChapterId, setSavingChapterId] = useState<string | null>(null)
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
        setSelectedStudentId((current) => current && data.some((row) => row.student_id === current) ? current : null)
        setSelectedLevelNumber(null)
        setLoading(false)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load learning progress')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [activeSearch, canLoad])

  const students = useMemo(() => buildStudentSummaries(rows), [rows])
  const selectedStudent = students.find((student) => student.studentId === selectedStudentId) ?? null
  const visibleStudents = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term || term === activeSearch.trim().toLowerCase()) return students
    return students.filter((student) => student.studentName.toLowerCase().includes(term))
  }, [activeSearch, search, students])
  const levels = useMemo(() => buildLevels(rows, selectedStudentId), [rows, selectedStudentId])
  const activeLevel = levels.find((level) => level.levelNumber === selectedLevelNumber) ?? null

  async function refresh() {
    const refreshed = await getMyTeacherLearningProgress(activeSearch)
    setRows(refreshed)
  }

  async function saveChapter(studentId: string, chapterId: string) {
    setSavingChapterId(chapterId)
    setError(null)
    try {
      await markTeacherChapterCompleted(studentId, chapterId)
      await refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save learning progress')
    } finally {
      setSavingChapterId(null)
    }
  }

  async function undoChapter(studentId: string, chapterId: string) {
    setSavingChapterId(chapterId)
    setError(null)
    try {
      await unmarkTeacherChapterCompleted(studentId, chapterId)
      await refresh()
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : 'Unable to undo learning progress')
    } finally {
      setSavingChapterId(null)
    }
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextSearch = search.trim()
    setActiveSearch(nextSearch)
    setSelectedStudentId(null)
    setSelectedLevelNumber(null)
    setError(null)
  }

  function clearSearch() {
    setSearch('')
    setActiveSearch('')
    setSelectedStudentId(null)
    setSelectedLevelNumber(null)
    setError(null)
  }

  function selectStudent(studentId: string) {
    setSelectedStudentId(studentId)
    setSelectedLevelNumber(null)
    setError(null)
  }

  function selectLevel(levelNumber: number) {
    setSelectedLevelNumber(levelNumber)
    setError(null)
  }

  function backToStudents() {
    setSelectedStudentId(null)
    setSelectedLevelNumber(null)
    setError(null)
  }

  function backToLevels() {
    setSelectedLevelNumber(null)
    setError(null)
  }

  if (authLoading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || !profile || profileError || status === null || status === 'waiting') return null
  if (role !== 'teacher' || status !== 'active') return <p>Access denied.</p>

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Teacher Portal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#102449] sm:text-4xl">Learning Progress</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Select a student, open the level, then save each completed chapter.</p>
      </header>

      <form onSubmit={submitSearch} className="sticky top-0 z-20 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="teacher-learning-progress-search">Search student name</label>
          <input
            id="teacher-learning-progress-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search student name..."
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button type="submit" className="h-11 rounded-xl bg-[#102449] px-5 text-sm font-bold text-white transition hover:bg-[#17325f]">Search</button>
        {(activeSearch || search) && <button type="button" onClick={clearSearch} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Clear</button>}
      </form>

      {loading ? (
        <div className="space-y-4">{[1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />)}</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">{error}</div>
      ) : students.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <h2 className="text-lg font-bold text-[#102449]">No students found</h2>
          <p className="mt-2 text-sm text-slate-600">Only students in your active teaching groups are shown.</p>
        </section>
      ) : !selectedStudent ? (
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Student</p>
              <h2 className="mt-1 text-xl font-extrabold text-[#102449]">Select student</h2>
            </div>
            <p className="text-sm font-semibold text-slate-500">{visibleStudents.length} student{visibleStudents.length === 1 ? '' : 's'}</p>
          </div>

          {visibleStudents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              <h2 className="text-lg font-bold text-[#102449]">Student not found</h2>
              <p className="mt-2 text-sm text-slate-600">Try another student name.</p>
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/60 p-3 pr-2 shadow-inner sm:max-h-[600px]">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleStudents.map((student) => (
                  <button
                    key={student.studentId}
                    type="button"
                    onClick={() => selectStudent(student.studentId)}
                    className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:bg-slate-50 hover:shadow"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="truncate text-base font-bold text-[#102449]">{student.studentName}</span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Level {student.currentLevelNumber}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{student.currentLevelName}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : !selectedLevelNumber ? (
        <section className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Learning Progress</p>
                <h2 className="mt-1 text-2xl font-extrabold text-[#102449]">{selectedStudent.studentName}</h2>
                <p className="mt-1 text-sm text-slate-500">Current level: {selectedStudent.currentLevelName}</p>
              </div>
              <button type="button" onClick={backToStudents} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">← Back to students</button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {levels.map((level) => {
                const unlocked = level.levelNumber <= selectedStudent.currentLevelNumber
                return (
                  <button
                    key={level.levelNumber}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => unlocked && selectLevel(level.levelNumber)}
                    className={`rounded-2xl border p-5 text-left transition ${
                      !unlocked
                        ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                        : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-500">Level {level.levelNumber}</span>
                      <span className="text-lg" aria-hidden="true">{unlocked ? '→' : '🔒'}</span>
                    </div>
                    <p className="mt-2 text-base font-extrabold text-[#102449]">{level.levelName}</p>
                    {unlocked && <p className="mt-2 text-xs font-semibold text-slate-500">{level.chapters.length} chapters</p>}
                    {!unlocked && <p className="mt-2 text-xs font-semibold text-slate-500">Not taken yet</p>}
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Level {activeLevel?.levelNumber}</p>
                <h3 className="mt-1 text-xl font-extrabold text-[#102449]">{activeLevel?.levelName}</h3>
                {activeLevel?.ebookTitle && <p className="mt-1 text-sm text-slate-500">{activeLevel.ebookTitle}</p>}
              </div>
              <button type="button" onClick={backToLevels} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">← Back to levels</button>
            </div>

            {activeLevel?.chapters.length === 0 ? (
              <p className="mt-5 text-sm text-slate-600">No chapters configured for this level.</p>
            ) : (
              <div className="mt-5 max-h-[560px] space-y-3 overflow-y-auto pr-2">
                {activeLevel.chapters.map((chapter) => {
                  const saving = savingChapterId === chapter.id
                  return (
                    <div
                      key={chapter.id}
                      className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${chapter.completedAt ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/60'}`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Chapter {chapter.number}</p>
                        <p className="mt-1 text-base font-bold text-[#102449]">{chapter.title}</p>
                      </div>

                      {chapter.completedAt ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700">✓ Saved</span>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => undoChapter(selectedStudent.studentId, chapter.id)}
                            className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60"
                          >
                            {saving ? 'Saving...' : 'Undo'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => saveChapter(selectedStudent.studentId, chapter.id)}
                          className="shrink-0 rounded-lg bg-[#102449] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f] disabled:cursor-wait disabled:opacity-60"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
