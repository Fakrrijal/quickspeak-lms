// @ts-nocheck

import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { TeacherLevelAssessmentPanel } from '../../components/teacher/TeacherLevelAssessmentPanel'
import {
  getMyTeacherLearningProgress,
  markTeacherChapterCompleted,
  unmarkTeacherChapterCompleted,
  type TeacherLearningProgressRow,
} from '../../services/teacher-learning-progress.service'

export const Route = createFileRoute('/teacher/learning-progress')({ component: TeacherLearningProgressPage })

const PAGE_SIZE = 10

type StudentSummary = {
  studentId: string
  studentName: string
  currentLevelNumber: number
  currentLevelName: string
  latestChapterNumber: number | null
  latestChapterTitle: string | null
}

type Chapter = {
  id: string
  number: number
  title: string
  completedAt: string | null
}

type LevelSection = {
  levelId: string | null
  levelNumber: number
  levelName: string
  ebookTitle: string | null
  teachingGroupName: string | null
  teacherName: string | null
  teacherCode: string | null
  chapters: Chapter[]
}

function Pagination({ page, totalItems, onPageChange }: { page: number; totalItems: number; onPageChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  return (
    <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold text-slate-500">
        Showing {totalItems === 0 ? 0 : Math.min((page - 1) * PAGE_SIZE + 1, totalItems)}–{Math.min(page * PAGE_SIZE, totalItems)} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page === 1} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
        <span className="min-w-20 text-center text-xs font-bold text-slate-600">Page {page} of {totalPages}</span>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page === totalPages} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </div>
    </div>
  )
}

function buildStudentSummaries(rows: TeacherLearningProgressRow[]) {
  const students = new Map<string, StudentSummary>()

  for (const row of rows) {
    const existing = students.get(row.student_id)

    if (!existing) {
      students.set(row.student_id, {
        studentId: row.student_id,
        studentName: row.student_name,
        currentLevelNumber: row.current_level_number,
        currentLevelName: row.current_level_name,
        latestChapterNumber: row.completed_at && row.chapter_number !== null ? row.chapter_number : null,
        latestChapterTitle: row.completed_at && row.chapter_title ? row.chapter_title : null,
      })
      continue
    }

    if (row.completed_at && row.chapter_number !== null && row.chapter_title) {
      const existingCompletion = rows.find(
        (candidate) =>
          candidate.student_id === existing.studentId &&
          candidate.chapter_number === existing.latestChapterNumber &&
          candidate.chapter_title === existing.latestChapterTitle &&
          candidate.completed_at,
      )?.completed_at

      if (!existingCompletion || String(row.completed_at) > String(existingCompletion)) {
        existing.latestChapterNumber = row.chapter_number
        existing.latestChapterTitle = row.chapter_title
      }
    }
  }

  return [...students.values()].sort((a, b) => a.studentName.localeCompare(b.studentName))
}

function buildLevels(rows: TeacherLearningProgressRow[], studentId: string | null) {
  const selectedRows = rows.filter((row) => row.student_id === studentId)
  const levelMap = new Map<number, LevelSection>()

  for (const row of selectedRows) {
    const level = levelMap.get(row.level_number) ?? {
      levelId: row.level_id ?? null,
      levelNumber: row.level_number,
      levelName: row.level_name,
      ebookTitle: row.ebook_title,
      teachingGroupName: row.teaching_group_name,
      teacherName: row.teacher_name,
      teacherCode: row.teacher_code,
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
      levelId: null,
      levelNumber,
      levelName: `Level ${levelNumber}`,
      ebookTitle: null,
      teachingGroupName: null,
      teacherName: null,
      teacherCode: null,
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
  const [studentPage, setStudentPage] = useState(1)
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
        setStudentPage(1)
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
  const paginatedStudents = useMemo(() => visibleStudents.slice((studentPage - 1) * PAGE_SIZE, studentPage * PAGE_SIZE), [visibleStudents, studentPage])
  const levels = useMemo(() => buildLevels(rows, selectedStudentId), [rows, selectedStudentId])
  const activeLevel = levels.find((level) => level.levelNumber === selectedLevelNumber) ?? null
  const latestSavedAchievement = useMemo(() => {
    const completed = rows
      .filter((row) => row.student_id === selectedStudentId && row.material_id && row.completed_at)
      .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))
    return completed[0] ?? null
  }, [rows, selectedStudentId])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(visibleStudents.length / PAGE_SIZE))
    if (studentPage > totalPages) setStudentPage(totalPages)
  }, [studentPage, visibleStudents.length])

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
    setStudentPage(1)
    setError(null)
  }

  function clearSearch() {
    setSearch('')
    setActiveSearch('')
    setSelectedStudentId(null)
    setSelectedLevelNumber(null)
    setStudentPage(1)
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
          <input id="teacher-learning-progress-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student name..." className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </div>
        <button type="submit" className="h-11 rounded-xl bg-[#102449] px-5 text-sm font-bold text-white transition hover:bg-[#17325f]">Search</button>
        {(activeSearch || search) && <button type="button" onClick={clearSearch} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Clear</button>}
      </form>

      {loading ? (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">{[1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>
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
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Students</p><h2 className="mt-1 text-xl font-extrabold text-[#102449]">Learning Progress</h2></div>
            <p className="text-sm font-semibold text-slate-500">{visibleStudents.length} student{visibleStudents.length === 1 ? '' : 's'}</p>
          </div>

          {visibleStudents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"><h2 className="text-lg font-bold text-[#102449]">Student not found</h2><p className="mt-2 text-sm text-slate-600">Try another student name.</p></div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="hidden grid-cols-[minmax(180px,1.2fr)_minmax(240px,2fr)_130px_44px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 sm:grid">
                <span>Student</span><span>Latest Progress</span><span>Level</span><span aria-hidden="true" />
              </div>
              <div className="divide-y divide-slate-100">
                {paginatedStudents.map((student) => (
                  <button key={student.studentId} type="button" onClick={() => selectStudent(student.studentId)} className="grid w-full grid-cols-1 gap-2 px-4 py-4 text-left transition hover:bg-slate-50 sm:grid-cols-[minmax(180px,1.2fr)_minmax(240px,2fr)_130px_44px] sm:items-center">
                    <span className="min-w-0 truncate text-sm font-bold text-[#102449]">{student.studentName}</span>
                    <span className="min-w-0 truncate text-sm text-slate-600">{student.latestChapterTitle ? `Chapter ${student.latestChapterNumber} — ${student.latestChapterTitle}` : 'Belum ada chapter yang disimpan'}</span>
                    <span className="text-sm font-semibold text-slate-600">Level {student.currentLevelNumber}</span>
                    <span className="flex items-center justify-end text-lg font-bold text-blue-700" aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
              <Pagination page={studentPage} totalItems={visibleStudents.length} onPageChange={setStudentPage} />
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

            {latestSavedAchievement && (
              <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-[#102449]">{latestSavedAchievement.student_name}</p><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">{latestSavedAchievement.level_name}</span></div>
                <p className="mt-2 text-sm text-slate-600">Chapter {latestSavedAchievement.chapter_number} — {latestSavedAchievement.chapter_title}</p>
                <p className="mt-1 text-sm font-bold text-emerald-700">✓ {latestSavedAchievement.material_title}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{latestSavedAchievement.teaching_group_name ?? 'Group not available'} · {latestSavedAchievement.teacher_name ?? latestSavedAchievement.teacher_code ?? 'Teacher not available'}</p>
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {levels.map((level) => {
                const unlocked = level.levelNumber <= selectedStudent.currentLevelNumber
                return (
                  <button key={level.levelNumber} type="button" disabled={!unlocked} onClick={() => unlocked && selectLevel(level.levelNumber)} className={`rounded-xl border p-4 text-left transition ${!unlocked ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'}`}>
                    <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-slate-500">Level {level.levelNumber}</span><span className="text-lg" aria-hidden="true">{unlocked ? '→' : '🔒'}</span></div>
                    {unlocked && <p className="mt-2 text-xs font-semibold text-slate-500">{level.teachingGroupName ?? 'Group not available'} · {level.teacherName ?? level.teacherCode ?? 'Teacher not available'}</p>}
                    {unlocked && <p className="mt-1 text-xs font-semibold text-slate-500">{level.chapters.length} chapters</p>}
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
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{activeLevel?.teachingGroupName ?? 'Group not available'} · {activeLevel?.teacherName ?? activeLevel?.teacherCode ?? 'Teacher not available'}</p>
                <h3 className="mt-1 text-xl font-extrabold text-[#102449]">Level {activeLevel?.levelNumber}</h3>
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
                    <div key={chapter.id} className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${chapter.completedAt ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/60'}`}>
                      <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Chapter {chapter.number}</p><p className="mt-1 text-base font-bold text-[#102449]">{chapter.title}</p></div>
                      {chapter.completedAt ? (
                        <div className="flex shrink-0 items-center gap-2"><span className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700">✓ Saved</span><button type="button" disabled={saving} onClick={() => undoChapter(selectedStudent.studentId, chapter.id)} className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving...' : 'Undo'}</button></div>
                      ) : (
                        <button type="button" disabled={saving} onClick={() => saveChapter(selectedStudent.studentId, chapter.id)} className="shrink-0 rounded-lg bg-[#102449] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f] disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {activeLevel?.levelId && <TeacherLevelAssessmentPanel studentId={selectedStudent.studentId} levelId={activeLevel.levelId} levelNumber={activeLevel.levelNumber} levelName={activeLevel.levelName} isCurrentLevel={activeLevel.levelNumber === selectedStudent.currentLevelNumber} onCompleted={refresh} />}
          </div>
        </section>
      )}
    </div>
  )
}
