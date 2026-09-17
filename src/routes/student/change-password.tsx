import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AccountSecurity } from '../../components/AccountSecurity'
import { useAuthContext } from '../../providers/AuthProvider'

export const Route = createFileRoute('/student/change-password')({ component: StudentChangePasswordPage })

function StudentChangePasswordPage() {
  const { isAuthenticated, loading: authLoading, profileLoading, profileError, role, status, user, profile } = useAuthContext()
  const navigate = useNavigate()
  const canRender = !authLoading && !profileLoading && isAuthenticated && !profileError && role === 'student' && status === 'active'

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!isAuthenticated || profileError || status === null) navigate({ to: '/login', replace: true })
    else if (status === 'waiting') navigate({ to: '/waiting', replace: true })
  }, [authLoading, isAuthenticated, navigate, profileError, profileLoading, status])

  if (authLoading || profileLoading) return <p>Loading...</p>
  if (!canRender) return <p>Access denied.</p>

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">Student Portal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#102449]">Ganti Password</h1>
        <p className="mt-1.5 text-sm leading-6 text-slate-600">Change your QuickSpeak login password securely.</p>
      </header>
      <AccountSecurity email={user?.email ?? profile?.email ?? null} />
    </div>
  )
}
