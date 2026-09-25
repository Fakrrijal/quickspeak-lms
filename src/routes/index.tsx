import { createFileRoute } from '@tanstack/react-router'
import { QuickSpeakLanding } from '../components/public/QuickSpeakLanding'
import { createSeoHead } from '../lib/seo'

const canonicalUrl = 'https://quickspeakindonesia.net/'

export const Route = createFileRoute('/')({
  head: () =>
    createSeoHead({
      title: 'Kursus Bahasa Inggris | QuickSpeak English Course',
      description:
        'QuickSpeak English Course menyediakan kursus Bahasa Inggris online dan di Bandung dengan pembelajaran terstruktur, 4 level, private dan semi-private.',
      url: canonicalUrl,
    }),
  component: HomePage,
})

function HomePage() {
  return <QuickSpeakLanding />
}
