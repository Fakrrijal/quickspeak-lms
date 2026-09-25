import { createFileRoute } from '@tanstack/react-router'
import { QuickSpeakLanding } from '../components/public/QuickSpeakLanding'
import { createSeoHead } from '../lib/seo'

const canonicalUrl = 'https://quickspeakindonesia.net/kursus-bahasa-inggris-online'

export const Route = createFileRoute('/kursus-bahasa-inggris-online')({
  head: () =>
    createSeoHead({
      title: 'Kursus Bahasa Inggris Online | QuickSpeak',
      description:
        'Kursus Bahasa Inggris online bersama QuickSpeak dengan 4 level pembelajaran, teacher, latihan, dan evaluasi perkembangan siswa.',
      url: canonicalUrl,
    }),
  component: OnlineEnglishCoursePage,
})

function OnlineEnglishCoursePage() {
  return (
    <QuickSpeakLanding
      heroEyebrow="ONLINE ENGLISH COURSE"
      heroTitle="Kursus Bahasa Inggris Online"
      heroDescription="Belajar Bahasa Inggris online bersama QuickSpeak melalui pembelajaran terstruktur, 4 level, pendampingan teacher, dan progress yang terpantau."
    />
  )
}
