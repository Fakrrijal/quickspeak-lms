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
  const [draftRating, setDraftRating] = useState<number | null>(null)
  const [draftComment, setDraftComment] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
          <h2 id="assessment-history-title" className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-[#102449]">Hasil Penilaian per Level</h2>
          <p className="mt-1 text-sm text-slate-500">Riwayat penilaian yang sudah dinyatakan selesai oleh teacher.</p>
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
            <div className="space-y-4">
              {results.map((item) => {
                const teacherFeedback = feedbackByResultId.get(item.result_id)

                return (
                  <article key={item.result_id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Level {item.level_number}</p>
                        <h3 className="mt-1 text-lg font-extrabold text-[#102449]">{item.level_name ?? `Level ${item.level_number}`}</h3>
                        <p className="mt-1 text-xs font-semibold text-slate-500">Selesai {formatDate(item.completed_at)}</p>
                      </div>
                      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 sm:text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Final Score</p>
                        <p className="mt-1 text-2xl font-extrabold text-[#102449]">{item.final_score}</p>
                        <p className="mt-1 text-xs font-bold text-blue-700">{item.result}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      {scoreFields.map(([key, label]) => (
                        <div key={key} className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-500">{label}</p>
                          <p className="mt-1 text-base font-extrabold text-[#102449]">{item[key]}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-500">Teacher Feedback</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.feedback || 'Tidak ada feedback.'}</p>
                    </div>

                    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-blue-700">Your Feedback About Teacher</p>
                          {feedbackLoading ? (
                            <p className="mt-1 text-sm text-slate-500">Memeriksa status feedback...</p>
                          ) : feedbackError ? (
                            <p className="mt-1 text-sm text-slate-500">Feedback teacher belum dapat dimuat.</p>
                          ) : teacherFeedback ? (
                            <>
                              <p className="mt-1 text-sm font-bold tracking-[0.08em] text-blue-700">{renderStars(teacherFeedback.rating)}</p>
                              <p className="mt-1 text-xs text-slate-500">Submitted {formatDate(teacherFeedback.submitted_at)}</p>
                            </>
                          ) : (
                            <p className="mt-1 text-sm leading-6 text-slate-600">Bagikan pengalaman belajar Anda. Feedback bersifat opsional.</p>
                          )}
                        </div>

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

                      {teacherFeedback?.comment && (
                        <div className="mt-3 rounded-lg border border-blue-100 bg-white px-3.5 py-3">
                          <p className="text-sm leading-6 text-slate-700 whitespace-pre-wrap">{teacherFeedback.comment}</p>
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>

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
