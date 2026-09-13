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
    <section className="border border-slate-200 bg-white shadow-sm" aria-labelledby="level-history-title">
      <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
        <h2 id="level-history-title" className="text-xl font-extrabold tracking-[-0.02em] text-[#102449]">Level History</h2>
        <p className="mt-1 text-sm text-slate-500">Level yang sudah selesai tetap tersimpan sebagai riwayat akademik.</p>
      </div>

      <div className="p-6 sm:p-7">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Unable to load level history.</div>
        ) : results.length === 0 ? (
          <p className="text-sm leading-6 text-slate-600">Belum ada level yang diselesaikan.</p>
        ) : (
          <div className="space-y-2">
            {results.map((item) => (
              <details key={item.result_id} className="group rounded-xl border border-slate-200 bg-slate-50/50">
                <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="text-sm font-extrabold text-[#102449]">Level {item.level_number}</p>
                      <span className="text-sm font-semibold text-slate-500">{item.level_name ?? `Level ${item.level_number}`}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Selesai {formatDate(item.completed_at)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-extrabold text-[#102449]">{item.final_score}</p>
                    <p className="text-[11px] font-bold text-blue-700">{item.result}</p>
                  </div>
                  <span className="text-slate-400 transition-transform group-open:rotate-180">⌄</span>
                </summary>

                <div className="border-t border-slate-200 px-4 py-4 sm:px-5">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    {scoreFields.map(([key, label]) => (
                      <div key={key} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-500">{label}</p>
                        <p className="mt-1 text-sm font-extrabold text-[#102449]">{item[key]}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-500">Teacher Feedback</p>
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