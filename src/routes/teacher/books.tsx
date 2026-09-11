import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { getTeacherPublishedEbooks, type TeacherEbook } from '../../services/teacher-ebook.service'

export const Route = createFileRoute('/teacher/books')({ component: TeacherBooksPage })

function BookCover({ ebook }: { ebook: TeacherEbook | null }) {
  if (!ebook) {
    return <div className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs font-semibold text-slate-400">Book not published</div>
  }

  return ebook.thumbnail_url ? (
    <img src={ebook.thumbnail_url} alt={ebook.title} className="aspect-[3/4] w-full rounded-xl border border-slate-200 object-cover shadow-sm" />
  ) : (
    <div className="flex aspect-[3/4] flex-col justify-between rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 p-5 shadow-sm">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">QuickSpeak</p><p className="mt-2 text-sm font-bold text-slate-700">{ebook.level_name}</p></div>
      <h3 className="text-xl font-extrabold leading-tight text-[#102449]">{ebook.title}</h3>
    </div>
  )
}

function TeacherBooksPage() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const [ebooks, setEbooks] = useState<TeacherEbook[]>([])
  const [loading, setLoading] = useState(true)
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
    getTeacherPublishedEbooks()
      .then((data) => {
        if (cancelled) return
        setEbooks(data)
        setLoading(false)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load books')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [canLoad])

  const booksByLevel = useMemo(() => {
    const byLevel = new Map<number, TeacherEbook>()
    for (const ebook of ebooks) if (!byLevel.has(ebook.level_number)) byLevel.set(ebook.level_number, ebook)
    return [1, 2, 3, 4].map((levelNumber) => byLevel.get(levelNumber) ?? null)
  }, [ebooks])

  if (authLoading || profileLoading) return <p>Loading...</p>
  if (!isAuthenticated || !profile || profileError || status === null || status === 'waiting') return null
  if (role !== 'teacher' || status !== 'active') return <p>Access denied.</p>

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Teacher Portal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#102449] sm:text-4xl">Books</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">All four QuickSpeak core books are available for teaching reference.</p>
      </header>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="aspect-[3/4] animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">{error}</div>
      ) : (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {booksByLevel.map((ebook, index) => {
            const level = index + 1
            return (
              <article key={ebook?.ebook_id ?? `level-${level}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <BookCover ebook={ebook} />
                <div className="px-1 pb-1 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-700">Level {level}</p>
                  <h2 className="mt-1 min-h-12 text-lg font-bold leading-6 text-[#102449]">{ebook?.title ?? `Level ${level} Book`}</h2>
                  {ebook ? <a href={ebook.heyzine_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-[#102449] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#17325f]">Open Book</a> : <span className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-400">Unavailable</span>}
                </div>
              </article>
            )
          })}
        </section>
      )}

      <div className="text-sm text-slate-500"><a href="/teacher/overview" className="font-semibold text-blue-700 hover:text-blue-800">← Back to Dashboard</a></div>
    </div>
  )
}
