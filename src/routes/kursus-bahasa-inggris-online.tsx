import { createFileRoute } from '@tanstack/react-router'
import { SeoLandingPage } from '../components/public/SeoLandingPage'
import { createSeoHead } from '../lib/seo'

const canonicalUrl = 'https://quickspeakindonesia.net/kursus-bahasa-inggris-online'

export const Route = createFileRoute('/kursus-bahasa-inggris-online')({
  head: () =>
    createSeoHead({
      title: 'Kursus Bahasa Inggris Online | QuickSpeak',
      description:
        'Belajar Bahasa Inggris online bersama QuickSpeak melalui pembelajaran terstruktur, 4 level, teacher, latihan, dan evaluasi perkembangan siswa.',
      url: canonicalUrl,
    }),
  component: OnlineEnglishCoursePage,
})

function OnlineEnglishCoursePage() {
  return (
    <SeoLandingPage
      eyebrow="ONLINE ENGLISH COURSE"
      title="Kursus Bahasa Inggris Online"
      intro="QuickSpeak menghadirkan kursus Bahasa Inggris online dengan alur belajar yang terstruktur, pendampingan teacher, dan tahapan yang membantu siswa belajar, berlatih, dan memantau perkembangannya."
      sections={[
        {
          title: 'Bagaimana Sistem Belajar Online QuickSpeak?',
          body:
            'Pembelajaran online mengikuti alur yang jelas dari materi, latihan, sesi interaktif, hingga evaluasi. Siswa tetap belajar berdasarkan level yang relevan sehingga prosesnya tidak berhenti pada satu sesi, tetapi menjadi perjalanan belajar yang bertahap.',
        },
        {
          title: 'Empat Level Pembelajaran',
          body:
            'QuickSpeak menyusun pembelajaran melalui empat level: Foundation, Development, Progress, dan Advanced Development. Setiap tahap dirancang untuk membantu siswa memperkuat kemampuan Bahasa Inggris secara berkelanjutan.',
        },
        {
          title: 'Pendampingan Teacher',
          body:
            'Teacher menjadi bagian penting dalam proses belajar online. Siswa memperoleh arahan selama pembelajaran dan dapat memantau perkembangan melalui sistem yang mendokumentasikan aktivitas belajar dan hasil evaluasi.',
        },
        {
          title: 'Private dan Semi-Private',
          body:
            'QuickSpeak menyediakan private class untuk kebutuhan belajar yang lebih personal dan semi-private class untuk kelompok kecil hingga empat siswa. Keduanya menggunakan pendekatan pembelajaran terstruktur dengan dukungan teacher.',
        },
      ]}
      relatedLinks={[
        {
          to: '/kursus-bahasa-inggris-bandung',
          label: 'Kursus Bahasa Inggris Bandung',
        },
        {
          to: '/kursus-bahasa-inggris-anak',
          label: 'Kursus Bahasa Inggris untuk Anak',
        },
        {
          to: '/kursus-bahasa-inggris-online',
          label: 'Kursus Bahasa Inggris Online',
        },
      ]}
    />
  )
}
