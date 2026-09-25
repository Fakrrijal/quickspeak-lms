import { createFileRoute } from '@tanstack/react-router'
import { QuickSpeakLanding } from '../components/public/QuickSpeakLanding'
import { createSeoHead } from '../lib/seo'

const canonicalUrl = 'https://quickspeakindonesia.net/kursus-bahasa-inggris-bandung'

export const Route = createFileRoute('/kursus-bahasa-inggris-bandung')({
  head: () =>
    createSeoHead({
      title: 'Kursus Bahasa Inggris Bandung | QuickSpeak',
      description:
        'Kursus Bahasa Inggris di Bandung bersama QuickSpeak dengan pembelajaran terstruktur, 4 level, teacher, serta pilihan private dan semi-private.',
      url: canonicalUrl,
    }),
  component: BandungEnglishCoursePage,
})

function BandungEnglishCoursePage() {
  return (
    <QuickSpeakLanding
      heroEyebrow="QUICKSPEAK BANDUNG"
      heroTitle="Kursus Bahasa Inggris di Bandung"
      heroDescription="QuickSpeak menyediakan pembelajaran Bahasa Inggris terstruktur untuk siswa di Bandung melalui 4 level, pendampingan teacher, dan pilihan private maupun semi-private."
    />
  )
}
