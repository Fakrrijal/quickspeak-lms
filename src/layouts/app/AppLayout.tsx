import { Outlet } from '@tanstack/react-router'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-6">
          <h1 className="text-xl font-bold text-slate-900">
            QuickSpeak LMS
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}