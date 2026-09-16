import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { useStudentEbooks } from '../../hooks/useStudentEbooks'

export const Route = createFileRoute('/student/ebooks')({ component: StudentEbooksPage })

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function StudentEbooksPage() {
  const { isAuthenticated, loading: authLoading, profile, profileError, profileLoading, role, status } = useAuthContext()
  const navigate = useNavigate()
  const canLoad = !authLoading && !profileLoading && isAuthenticated && Boolean(profile) && !profileError && role === 'student' && status === 'active'
  const { catalog, loading, error, reload } = useStudentEbooks(canLoad)

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || !profile || profileError || status === null) {
      navigate({ to: '/login', replace: true })
      return
    }
    if (status === 'waiting') {
      navigate({ to: '/waiting', replace: true })
    }
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, role, status])

  if (authLoading || profileLoading) {
    return (
      <section className="border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-2.5 w-28 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-8 w-72 max-w-full animate-pulse rounded-lg bg-slate-100" />
        <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded-full bg-slate-100" />
      </section>
    )
  }

  if (!isAuthenticated || !profile || profileError || status !== 'active' || role !== 'student') return null

  const ebookSlots = [1, 2, 3, 4].map((levelNumber) => ({
    levelNumber,
    ebook: catalog.find((candidate) => candidate.level_number === levelNumber) ?? null,
  }))

  return (
    <section className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Learning Materials</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-[#102449]">Ebooks</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">Your QuickSpeak level books, unlocked as your learning progress advances.</p>
      </header>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="overflow-hidden border border-slate-200 bg-slate-50 shadow-sm">
              <div className="aspect-[3/4] animate-pulse bg-slate-200" />
              <div className="space-y-2 p-4"><div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" /><div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" /></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p>Unable to load your ebook catalog.</p>
          <button type="button" onClick={() => void reload()} className="font-bold underline">Retry</button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ebookSlots.map(({ levelNumber, ebook }) => {
            const unlocked = Boolean(ebook?.is_unlocked)
            return (
              <article key={levelNumber} className={`group overflow-hidden border bg-white shadow-sm transition ${unlocked ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md' : 'border-slate-200'}`}>
                <div className="relative aspect-[3/4] overflow-hidden bg-slate-100">
                  {ebook?.thumbnail_url ? (
                    <img src={ebook.thumbnail_url} alt={`Cover ${ebook.title}`} className={`h-full w-full object-cover ${unlocked ? '' : 'blur-[1px]'}`} />
                  ) : (
                    <div className="flex h-full w-full items-end bg-gradient-to-br from-slate-100 via-white to-blue-50 p-5">
                      <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">QuickSpeak</p><p className="mt-2 text-xl font-extrabold text-[#102449]">Level {levelNumber}</p><p className="mt-1 text-sm text-slate-600">English Course</p></div>
                    </div>
                  )}
                  {!unlocked && <div className="absolute inset-0 flex items-center justify-center bg-[#102449]/45"><div className="flex size-12 items-center justify-center rounded-full bg-white/95 text-[#102449] shadow-lg"><LockIcon /></div></div>}
                  <div className="absolute left-3 top-3 rounded-md bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#102449] shadow-sm">Level {levelNumber}</div>
                </div>
                <div className="p-4">
                  <h2 className="line-clamp-2 text-base font-extrabold text-[#102449]">{ebook?.title ?? `Level ${levelNumber} Ebook`}</h2>
                  <p className="mt-1 text-sm text-slate-500">{ebook?.level_name ?? `Level ${levelNumber}`}</p>
                  {unlocked && ebook ? (
                    <a href={ebook.heyzine_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:text-blue-800">Open Ebook <ArrowIcon /></a>
                  ) : (
                    <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><LockIcon /> Locked</p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}