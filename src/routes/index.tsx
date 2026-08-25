import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">QuickSpeak LMS</h1>
      <p className="mt-2">Routing foundation is ready.</p>
    </main>
  )
}