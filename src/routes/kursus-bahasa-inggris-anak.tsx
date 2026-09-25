import { createFileRoute } from '@tanstack/react-router'
import { SeoLandingPage } from '../components/public/SeoLandingPage'
import { createSeoHead } from '../lib/seo'

const canonicalUrl = 'https://quickspeakindonesia.net/kursus-bahasa-inggris-anak'

export const Route = createFileRoute('/kursus-bahasa-inggris-anak')({
  head: () =>
    createSeoHead({
      title: 'Kursus Bahasa Inggris Online untuk Anak | QuickSpeak',
      description:
        'Kursus Bahasa Inggris untuk anak dengan pembelajaran bertahap, teacher, latihan terarah, dan 4 level belajar bersama QuickSpeak.',
      url: canonicalUrl,
    }),
  component: ChildrenEnglishCoursePage,
})

function ChildrenEnglishCoursePage() {
  return (
    <SeoLandingPage
      eyebrow="ENGLISH COURSE FOR CHILDREN"
      title="Kursus Bahasa Inggris Online untuk Anak"
      intro="QuickSpeak membantu anak dan remaja belajar Bahasa Inggris melalui tahapan yang terstruktur, teacher, latihan, dan pemantauan perkembangan yang dilakukan secara bertahap."
      sections={[
        {
          title: 'Pembelajaran Sesuai Tahap Anak',
          body:
            'Pembelajaran disusun bertahap agar siswa dapat memahami materi pada level yang sesuai, berlatih secara konsisten, dan membangun kebiasaan menggunakan Bahasa Inggris dalam proses belajar.',
        },
        {
          title: '4 Level Pembelajaran',
          body:
            'QuickSpeak menggunakan empat level pembelajaran yang membentuk perjalanan belajar dari foundation sampai advanced development. Struktur ini membantu keluarga memahami bahwa perkembangan siswa dibangun secara bertahap.',
        },
        {
          title: 'Speaking, Listening, Vocabulary, dan Grammar',
          body:
            'Pembelajaran Bahasa Inggris mencakup kemampuan yang saling mendukung seperti speaking, listening, vocabulary, grammar, dan pronunciation. Latihan serta evaluasi membantu siswa melihat bagian yang perlu terus dikembangkan.',
        },
        {
          title: 'Teacher dan Progress yang Terpantau',
          body:
            'Teacher mendampingi proses belajar dan memberikan arahan selama pembelajaran. Perkembangan siswa juga didokumentasikan melalui sistem QuickSpeak sehingga perjalanan belajar dapat dipantau dari waktu ke waktu.',
        },
      ]}
      relatedLinks={[
        {
          to: '/kursus-bahasa-inggris-online',
          label: 'Kursus Bahasa Inggris Online',
        },
        {
          to: '/kursus-bahasa-inggris-bandung',
          label: 'Kursus Bahasa Inggris Bandung',
        },
        {
          to: '/kursus-bahasa-inggris-anak',
          label: 'Kursus Bahasa Inggris untuk Anak',
        },
      ]}
    />
  )
}
