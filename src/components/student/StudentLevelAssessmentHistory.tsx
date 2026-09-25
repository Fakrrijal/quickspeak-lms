import { useEffect, useMemo, useState } from 'react'
import { getStudentLevelResults, type LevelResult } from '../../services/level-completion.service'
import {
  getMyTeacherFeedback,
  submitTeacherFeedback,
  type TeacherFeedback,
} from '../../services/teacher-feedback.service'

const scoreFields = [
  ['speaking', 'Speaking'],
  ['listening', 'Listening'],
  ['vocabulary', 'Vocabulary'],
  ['grammar', 'Grammar'],
  ['pronunciation', 'Pronunciation'],
] as const

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

function renderStars(rating: number | null) {
  if (!rating) return 'Belum ada rating'
  return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`
}

export function StudentLevelAssessmentHistory() {
  const [results, setResults] = useState<LevelResult[]>([])
  const [feedback, setFeedback] = useState<TeacherFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [feedbackLoading, setFeedbackLoading] = useState(true)
  const [error, setError] = useState(false)
  const [feedbackError, setFeedbackError] = useState(false)

  const [selectedResult, setSelectedResult] = useState<LevelResult | null>(null)
  const [viewingResult, setViewingResult] = useState<LevelResult | null>(null)
  const [levelFilter, setLevelFilter] = useState<'all' | number>('all')
  const [teacherFilter, setTeacherFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [draftRating, setDraftRating] = useState<number | null>(null)
  const [draftComment, setDraftComment] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pageSize = 5

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    getStudentLevelResults()
      .then((data) => {
        if (!cancelled) setResults(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setFeedbackLoading(true)
    setFeedbackError(false)

    getMyTeacherFeedback()
      .then((data) => {
        if (!cancelled) setFeedback(data)
      })
      .catch(() => {
        if (!cancelled) setFeedbackError(true)
      })
      .finally(() => {
        if (!cancelled) setFeedbackLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const feedbackByResultId = useMemo(
    () => new Map(feedback.map((item) => [item.level_result_id, item])),
    [feedback],
  )

  const levelOptions = useMemo(
    () => [...new Map(results.map((item) => [
      item.level_number ?? 0,
      { value: item.level_number ?? 0, label: item.level_name ?? `Level ${item.level_number ?? '—'}` },
    ])).values()].sort((left, right) => left.value - right.value),
    [results],
  )

  const teacherOptions = useMemo(
    () => [...new Map(
      results.map((item) => [
        item.teacher_id,
        {
          value: item.teacher_id,
          label: item.teacher_name
            ? `${item.teacher_name}${item.teacher_code ? ` · ${item.teacher_code.replace(/^TCH-/i, '')}` : ''}`
            : item.teacher_code ?? '—',
        },
      ]),
    ).values()],
    [results],
  )

  const filteredResults = useMemo(
    () => results.filter((item) => (
      (levelFilter === 'all' || item.level_number === levelFilter)
      && (teacherFilter === 'all' || item.teacher_id === teacherFilter)
    )),
    [levelFilter, results, teacherFilter],
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [levelFilter, teacherFilter])

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize))

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const paginatedResults = useMemo(
    () => filteredResults.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredResults],
  )

  const showingStart = filteredResults.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const showingEnd = Math.min(currentPage * pageSize, filteredResults.length)

  const openFeedback = (result: LevelResult) => {
    setSelectedResult(result)
    setDraftRating(null)
    setDraftComment('')
    setSubmitError(null)
  }

  const closeFeedback = () => {
    if (isSubmitting) return
    setSelectedResult(null)
    setDraftRating(null)
    setDraftComment('')
    setSubmitError(null)
  }

  const handleSubmitFeedback = async () => {
    if (!selectedResult || isSubmitting) return

    const comment = draftComment.trim()
    if (draftRating === null && !comment) {
      setSubmitError('Berikan rating atau komentar sebelum mengirim feedback.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const saved = await submitTeacherFeedback({
        levelResultId: selectedResult.result_id,
        rating: draftRating,
        comment,
      })
      setFeedback((current) => [...current, saved])
      setSelectedResult(null)
      setDraftRating(null)
      setDraftComment('')
    } catch (submitFeedbackError) {
      setSubmitError(
        submitFeedbackError instanceof Error
          ? submitFeedbackError.message
          : 'Feedback gagal dikirim.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <section className="border border-slate-200 bg-white shadow-sm" aria-labelledby="assessment-history-title">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-700">Assessment History</p>
          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="assessment-history-title" className="text-xl font-extrabold tracking-[-0.02em] text-[#102449]">Hasil Penilaian per Level</h2>
              <p className="mt-1 text-sm text-slate-500">Setiap hasil disimpan berdasarkan level dan teacher yang menyelesaikan assessment.</p>
            </div>
            {!loading && !error && results.length > 0 && (
              <p className="text-sm font-medium text-slate-500">{results.length} assessment</p>
            )}
          </div>
        </div>

        <div className="p-6 sm:p-7">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Unable to load assessment history.</div>
          ) : results.length === 0 ? (
            <p className="text-sm leading-6 text-slate-600">Belum ada level yang diselesaikan.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-end">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Level
                  <select
                    value={levelFilter}
                    onChange={(event) => setLevelFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))}
                    className="min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="all">All levels</option>
                    {levelOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Teacher
                  <select
                    value={teacherFilter}
                    onChange={(event) => setTeacherFilter(event.target.value)}
                    className="min-w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="all">All teachers</option>
                    {teacherOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <p className="text-sm text-slate-500 sm:ml-auto">
                  Showing {showingStart}–{showingEnd} of {filteredResults.length} assessments
                </p>
              </div>

              {filteredResults.length === 0 ? (
                <p className="mt-5 text-sm leading-6 text-slate-600">Tidak ada assessment yang sesuai dengan filter.</p>
              ) : (
                <div className="mt-5 space-y-3">
                  {paginatedResults.map((item) => {
                    const teacherFeedback = feedbackByResultId.get(item.result_id)
                    return (
                      <article key={item.result_id} className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Level {item.level_number}</p>
                            <h3 className="mt-1 text-lg font-extrabold text-[#102449]">{item.level_name ?? `Level ${item.level_number}`}</h3>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              Completed {formatDate(item.completed_at)}
                            </p>
                            <p className="mt-2 text-sm font-semibold text-slate-700">
                              Teacher: {item.teacher_name ? `${item.teacher_name}${item.teacher_code ? ` · ${item.teacher_code.replace(/^TCH-/i, '')}` : ''}` : item.teacher_code ? item.teacher_code.replace(/^TCH-/i, '') : '—'}
                            </p>
                          </div>

                          <div className="flex flex-col items-start gap-2 sm:items-end">
                            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 sm:min-w-32 sm:text-right">
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Final Score</p>
                              <p className="mt-1 text-2xl font-extrabold text-[#102449]">{item.final_score}</p>
                              <p className="mt-1 text-xs font-bold text-blue-700">{item.result}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setViewingResult(item)}
                                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                              >
                                View Details
                              </button>
                              {!feedbackLoading && !feedbackError && !teacherFeedback && (
                                <button
                                  type="button"
                                  onClick={() => openFeedback(item)}
                                  className="inline-flex items-center justify-center rounded-xl bg-[#102449] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f]"
                                >
                                  Give Feedback
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {teacherFeedback && (
                          <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-slate-500">Your feedback: <span className="font-bold tracking-[0.08em] text-blue-700">{renderStars(teacherFeedback.rating)}</span></p>
                            <p className="text-xs text-slate-500">Submitted {formatDate(teacherFeedback.submitted_at)}</p>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}

              {filteredResults.length > 0 && (
                <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">Page {currentPage} of {totalPages}</p>
                  <nav aria-label="Assessment pagination" className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Previous assessment page"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ‹
                    </button>
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        aria-label={`Assessment page ${page}`}
                        aria-current={currentPage === page ? 'page' : undefined}
                        onClick={() => setCurrentPage(page)}
                        className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-medium ${currentPage === page ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700'}`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-label="Next assessment page"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-lg text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ›
                    </button>
                  </nav>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {viewingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="assessment-detail-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">Assessment Details</p>
                <h3 id="assessment-detail-title" className="mt-1 text-xl font-extrabold text-[#102449]">Level {viewingResult.level_number} · {viewingResult.level_name ?? `Level ${viewingResult.level_number}`}</h3>
                <p className="mt-1 text-sm text-slate-500">Completed {formatDate(viewingResult.completed_at)} · Teacher {viewingResult.teacher_name ? `${viewingResult.teacher_name}${viewingResult.teacher_code ? ` · ${viewingResult.teacher_code.replace(/^TCH-/i, '')}` : ''}` : viewingResult.teacher_code ? viewingResult.teacher_code.replace(/^TCH-/i, '') : '—'}</p>
              </div>
              <button type="button" onClick={() => setViewingResult(null)} aria-label="Close assessment details" className="rounded-lg px-2 py-1 text-lg font-bold text-slate-500 hover:bg-slate-100">×</button>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {scoreFields.map(([key, label]) => (
                <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-500">{label}</p>
                  <p className="mt-1 text-base font-extrabold text-[#102449]">{viewingResult[key]}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-blue-700">Final Score</p>
                <p className="mt-1 text-2xl font-extrabold text-[#102449]">{viewingResult.final_score}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-500">Result</p>
                <p className="mt-1 text-sm font-extrabold text-[#102449]">{viewingResult.result}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-500">Teacher</p>
                <p className="mt-1 text-sm font-extrabold text-[#102449]">{viewingResult.teacher_name ? viewingResult.teacher_name : viewingResult.teacher_code ? viewingResult.teacher_code.replace(/^TCH-/i, '') : '—'}</p>
              </div>
            </div>

            <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-500">Teacher Feedback</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{viewingResult.feedback || 'Tidak ada feedback.'}</p>
            </section>

            {(() => {
              const teacherFeedback = feedbackByResultId.get(viewingResult.result_id)
              return (
                <section className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-blue-700">My Feedback About Teacher</p>
                      {teacherFeedback ? (
                        <>
                          <p className="mt-1 text-sm font-bold tracking-[0.08em] text-blue-700">{renderStars(teacherFeedback.rating)}</p>
                          <p className="mt-1 text-xs text-slate-500">Submitted {formatDate(teacherFeedback.submitted_at)}</p>
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-slate-600">Belum ada feedback.</p>
                      )}
                    </div>
                    {!feedbackLoading && !feedbackError && !teacherFeedback && (
                      <button type="button" onClick={() => { setViewingResult(null); openFeedback(viewingResult) }} className="inline-flex items-center justify-center rounded-xl bg-[#102449] px-4 py-2.5 text-sm font-bold text-white">Give Feedback</button>
                    )}
                  </div>
                  {teacherFeedback?.comment && (
                    <div className="mt-3 rounded-lg border border-blue-100 bg-white px-3.5 py-3">
                      <p className="text-sm leading-6 text-slate-700 whitespace-pre-wrap">{teacherFeedback.comment}</p>
                    </div>
                  )}
                </section>
              )
            })()}

            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setViewingResult(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">Close</button>
            </div>
          </section>
        </div>
      )}

      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-feedback-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">Level {selectedResult.level_number}</p>
                <h3 id="teacher-feedback-title" className="mt-1 text-xl font-extrabold text-[#102449]">Your Feedback About Teacher</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Bagikan pengalaman belajar Anda. Isi rating atau komentar, atau keduanya.</p>
              </div>
              <button
                type="button"
                onClick={closeFeedback}
                disabled={isSubmitting}
                aria-label="Close feedback dialog"
                className="rounded-lg px-2 py-1 text-lg font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <div className="mt-6">
              <p className="text-sm font-bold text-slate-800">How would you rate your teacher?</p>
              <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Teacher rating">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={draftRating === value}
                    aria-label={`${value} star${value > 1 ? 's' : ''}`}
                    onClick={() => setDraftRating(value)}
                    disabled={isSubmitting}
                    className={`rounded-lg px-2 text-3xl leading-none transition hover:bg-blue-50 disabled:opacity-50 ${draftRating !== null && value <= draftRating ? 'text-amber-400' : 'text-slate-300'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">{draftRating ? `${draftRating}/5` : 'Rating is optional'}</p>
            </div>

            <label className="mt-6 block">
              <span className="text-sm font-bold text-slate-800">Your comment <span className="font-normal text-slate-500">(optional)</span></span>
              <textarea
                value={draftComment}
                onChange={(event) => setDraftComment(event.target.value)}
                disabled={isSubmitting}
                rows={4}
                maxLength={1000}
                placeholder="Tell us about your learning experience..."
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
              />
              <span className="mt-1 block text-right text-[11px] text-slate-400">{draftComment.length}/1000</span>
            </label>

            {submitError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {submitError}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeFeedback}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmitFeedback()}
                disabled={isSubmitting || (draftRating === null && !draftComment.trim())}
                className="rounded-xl bg-[#102449] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">Feedback yang sudah dikirim tidak dapat diedit.</p>
          </section>
        </div>
      )}
    </>
  )
}
