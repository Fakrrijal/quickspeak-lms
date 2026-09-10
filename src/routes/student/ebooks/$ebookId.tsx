import { useEffect, type ReactNode } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../../providers/AuthProvider'
import { useStudentEbooks } from '../../../hooks/useStudentEbooks'

export const Route = createFileRoute('/student/ebooks/$ebookId')({
  component: StudentEbookReader,
})

function StudentEbookReader() {
  const { ebookId } = Route.useParams()
  const {
    isAuthenticated,
    loading: authLoading,
    profile,
    profileError,
    profileLoading,
    role,
    status,
  } = useAuthContext()
  const navigate = useNavigate()
  const canLoadEbooks = (
    !authLoading
    && !profileLoading
    && isAuthenticated
    && Boolean(profile)
    && !profileError
    && role === 'student'
    && status === 'active'
  )
  const { ebooks, loading, error, reload } = useStudentEbooks(canLoadEbooks)

  useEffect(() => {
    if (authLoading || profileLoading) {
      return
    }

    if (!isAuthenticated || !profile || profileError || status === null) {
      navigate({ to: '/login', replace: true })
      return
    }

    if (status === 'waiting') {
      navigate({ to: '/waiting', replace: true })
    }
  }, [authLoading, isAuthenticated, navigate, profile, profileError, profileLoading, status])

  if (authLoading || profileLoading) {
    return <ReaderShell><p>Loading...</p></ReaderShell>
  }

  if (!isAuthenticated || !profile || profileError || status === null || status === 'waiting') {
    return null
  }

  if (role !== 'student' || status !== 'active') {
    return <ReaderShell><p>Access denied.</p></ReaderShell>
  }

  if (loading) {
    return <ReaderShell><p className="text-sm text-slate-600">Loading ebook...</p></ReaderShell>
  }

  if (error) {
    return (
      <ReaderShell>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p>Unable to load your ebook. Please try again.</p>
          <button type="button" onClick={() => void reload()} className="font-medium underline">Retry</button>
        </div>
      </ReaderShell>
    )
  }

  const ebook = ebooks.find((candidate) => candidate.ebook_id === ebookId)

  if (!ebook) {
    return (
      <ReaderShell>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          This ebook is not available for your active level.
        </div>
      </ReaderShell>
    )
  }

  return (
    <ReaderShell>
      <h1 className="text-3xl font-bold text-slate-900">{ebook.title}</h1>
      <p className="mt-2 text-slate-600">{ebook.level_name}</p>
      <div className="mt-6 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        <iframe
          title={`${ebook.title} reader`}
          src={ebook.heyzine_url}
          allowFullScreen
          className="block h-[70vh] min-h-[32rem] w-full border-0"
        />
      </div>
    </ReaderShell>
  )
}

function ReaderShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen overflow-x-hidden p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <Link to="/student/learning" className="text-sm font-medium text-slate-700 underline hover:text-slate-900">
          Back to My Learning
        </Link>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  )
}
