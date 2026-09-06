import { createFileRoute } from '@tanstack/react-router'
import { QuickSpeakLanding } from '../components/public/QuickSpeakLanding'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return <QuickSpeakLanding />
}
