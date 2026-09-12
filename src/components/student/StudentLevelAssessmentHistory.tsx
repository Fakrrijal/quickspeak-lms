import { useEffect, useState } from 'react'
import { getStudentLevelResults, type LevelResult } from '../../services/level-completion.service'

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

export function StudentLevelAssessmentHistory() {
  const [results, setResults] = useState<LevelResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

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

  return (
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
            {results.map((item) => (
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
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
