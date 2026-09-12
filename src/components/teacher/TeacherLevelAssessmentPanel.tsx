import { useEffect, useMemo, useState } from 'react'
import {
  completeStudentLevel,
  getTeacherLevelPackageStatus,
  getTeacherLevelResult,
  type LevelResult,
  type TeacherLevelPackageStatus,
} from '../../services/level-completion.service'

type TeacherLevelAssessmentPanelProps = {
  studentId: string
  levelId: string
  levelNumber: number
  levelName: string
  isCurrentLevel: boolean
  onCompleted?: () => void | Promise<void>
}

const scoreFields = [
  ['speaking', 'Speaking'],
  ['listening', 'Listening'],
  ['vocabulary', 'Vocabulary'],
  ['grammar', 'Grammar'],
  ['pronunciation', 'Pronunciation'],
] as const

type ScoreKey = (typeof scoreFields)[number][0]

type Scores = Record<ScoreKey, string>

function emptyScores(): Scores {
  return {
    speaking: '',
    listening: '',
    vocabulary: '',
    grammar: '',
    pronunciation: '',
  }
}

function scoreValue(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function resultLabel(score: number) {
  if (score >= 90) return 'Excellent'
  if (score >= 80) return 'Good'
  if (score >= 70) return 'Satisfactory'
  return 'Needs Improvement'
}

function formatRupiah(value: number | null) {
  return value == null ? '—' : `Rp${value.toLocaleString('id-ID')}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

export function TeacherLevelAssessmentPanel({
  studentId,
  levelId,
  levelNumber,
  levelName,
  isCurrentLevel,
  onCompleted,
}: TeacherLevelAssessmentPanelProps) {
  const [result, setResult] = useState<LevelResult | null>(null)
  const [packageStatus, setPackageStatus] = useState<TeacherLevelPackageStatus | null>(null)
  const [scores, setScores] = useState<Scores>(emptyScores())
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      getTeacherLevelResult(studentId, levelId),
      getTeacherLevelPackageStatus(studentId, levelId),
    ])
      .then(([nextResult, nextPackageStatus]) => {
        if (cancelled) return
        setResult(nextResult)
        setPackageStatus(nextPackageStatus)
        if (nextResult) {
          setScores({
            speaking: String(nextResult.speaking),
            listening: String(nextResult.listening),
            vocabulary: String(nextResult.vocabulary),
            grammar: String(nextResult.grammar),
            pronunciation: String(nextResult.pronunciation),
          })
          setFeedback(nextResult.feedback ?? '')
        } else {
          setScores(emptyScores())
          setFeedback('')
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load level assessment.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [levelId, studentId])

  const parsedScores = useMemo(() => {
    return Object.fromEntries(scoreFields.map(([key]) => [key, scoreValue(scores[key])])) as Record<ScoreKey, number | null>
  }, [scores])

  const allScoresPresent = scoreFields.every(([key]) => parsedScores[key] !== null)
  const validScores = scoreFields.every(([key]) => parsedScores[key] !== null && parsedScores[key] >= 0 && parsedScores[key] <= 100)
  const finalScore = allScoresPresent && validScores
    ? Math.round(scoreFields.reduce((total, [key]) => total + (parsedScores[key] ?? 0), 0) / scoreFields.length)
    : null
  const previewResult = finalScore === null ? null : resultLabel(finalScore)

  async function saveAssessment() {
    if (!isCurrentLevel || result || !allScoresPresent || !validScores) return

    setSaving(true)
    setError(null)
    try {
      const nextResult = await completeStudentLevel({
        studentId,
        levelId,
        speaking: parsedScores.speaking ?? 0,
        listening: parsedScores.listening ?? 0,
        vocabulary: parsedScores.vocabulary ?? 0,
        grammar: parsedScores.grammar ?? 0,
        pronunciation: parsedScores.pronunciation ?? 0,
        feedback,
      })
      setResult(nextResult)
      setPackageStatus((current) => current ? { ...current, level_completed: true } : current)
      await onCompleted?.()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to complete this level.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="level-assessment-title">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-700">Level Completion</p>
          <h4 id="level-assessment-title" className="mt-1 text-xl font-extrabold text-[#102449]">Level {levelNumber} · {levelName}</h4>
          <p className="mt-1 text-sm text-slate-500">Nilai akhir diberikan satu kali saat level selesai.</p>
        </div>
        {packageStatus && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">Session Status</p>
            <p className="mt-1 text-sm font-extrabold text-[#102449]">
              {packageStatus.current_package_session_count}/{packageStatus.session_limit} sesi · {packageStatus.cumulative_level_session_count} kumulatif
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {packageStatus.current_package_type === 'private' ? 'Private' : packageStatus.current_package_type === 'semi_private' ? 'Semi-Private' : '—'} · {formatRupiah(packageStatus.current_package_price)}
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-5 space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : error ? (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
      ) : result ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {scoreFields.map(([key, label]) => (
              <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-extrabold text-[#102449]">{result[key]}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Final Score</p>
              <p className="mt-1 text-3xl font-extrabold text-[#102449]">{result.final_score}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 sm:col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">Result</p>
              <p className="mt-1 text-xl font-extrabold text-emerald-800">{result.result}</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Teacher Feedback</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{result.feedback || 'Tidak ada feedback.'}</p>
            <p className="mt-3 text-xs font-semibold text-slate-500">Level diselesaikan pada {formatDate(result.completed_at)}</p>
          </div>
        </div>
      ) : !isCurrentLevel ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Penilaian hanya dapat diberikan pada level aktif siswa. Level ini belum memiliki hasil penilaian tersimpan.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Pastikan chapter level ini sudah selesai dan data nilai sudah final sebelum menekan <strong>Level Selesai & Simpan Penilaian</strong>. Setelah tersimpan, level tidak dapat dinilai ulang.
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {scoreFields.map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-600">{label}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={scores[key]}
                  onChange={(event) => setScores((current) => ({ ...current, [key]: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-bold text-[#102449] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="0–100"
                />
              </label>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Final Score</p>
              <p className="mt-1 text-3xl font-extrabold text-[#102449]">{finalScore ?? '—'}</p>
              <p className="mt-1 text-xs font-bold text-blue-700">{previewResult ?? 'Lengkapi semua nilai'}</p>
            </div>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-600">Feedback Guru</span>
              <textarea
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                rows={5}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Tulis feedback perkembangan siswa..."
              />
            </label>
          </div>

          {error && <p className="text-sm font-medium text-rose-700">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
            <p className="text-xs font-semibold text-slate-500">Nilai rata-rata 5 aspek dibulatkan ke bilangan terdekat.</p>
            <button
              type="button"
              disabled={saving || !allScoresPresent || !validScores}
              onClick={() => void saveAssessment()}
              className="rounded-xl bg-[#102449] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#17325f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Level Selesai & Simpan Penilaian'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
