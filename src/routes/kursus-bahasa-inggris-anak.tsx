import { createFileRoute } from '@tanstack/react-router'
import { QuickSpeakLanding } from '../components/public/QuickSpeakLanding'
import { createSeoHead } from '../lib/seo'

const canonicalUrl = 'https://quickspeakindonesia.net/kursus-bahasa-inggris-anak'

export const Route = createFileRoute('/kursus-bahasa-inggris-anak')({
  head: () =>
    createSeoHead({
      title: 'Kursus Bahasa Inggris Online untuk Anak | QuickSpeak',
      description:
        'Kursus Bahasa Inggris online untuk anak dengan pembelajaran terstruktur, 4 level, teacher, dan progress yang terpantau bersama QuickSpeak.',
      url: canonicalUrl,
    }),
  component: ChildrenEnglishCoursePage,
})

function ChildrenEnglishCoursePage() {
  return (
    <QuickSpeakLanding
      heroEyebrow="ENGLISH COURSE FOR CHILDREN"
      heroTitle="Kursus Bahasa Inggris Online untuk Anak"
      heroDescription="QuickSpeak membantu anak belajar Bahasa Inggris secara bertahap melalui 4 level pembelajaran, teacher, latihan, dan pemantauan perkembangan."
    />
  )
}
