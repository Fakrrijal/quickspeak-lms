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
          <div className="space-y-2">
            {[1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Unable to load assessment history.</div>
        ) : results.length === 0 ? (
          <p className="text-sm leading-6 text-slate-600">Belum ada level yang diselesaikan.</p>
        ) : (
          <div className="space-y-2">
            {results.map((item) => (
              <details key={item.result_id} className="group rounded-xl border border-slate-200 bg-slate-50/50">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Level {item.level_number}</p>
                      <span className="text-xs text-slate-300">•</span>
                      <p className="truncate text-sm font-extrabold text-[#102449]">{item.level_name ?? `Level ${item.level_number}`}</p>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Selesai {formatDate(item.completed_at)}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-right">
                      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-blue-700">Score</p>
                      <p className="text-lg font-extrabold leading-none text-[#102449]">{item.final_score}</p>
                    </div>
                    <span className="hidden rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-700 sm:inline-flex">{item.result}</span>
                    <span className="text-slate-400 transition-transform group-open:rotate-180">⌄</span>
                  </div>
                </summary>

                <div className="border-t border-slate-200 px-4 pb-4 pt-3.5 sm:px-5">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    {scoreFields.map(([key, label]) => (
                      <div key={key} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
                        <p className="mt-1 text-sm font-extrabold text-[#102449]">{item[key]}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">Teacher Feedback</p>
                      <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">{item.result}</span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.feedback || 'Tidak ada feedback.'}</p>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
