import { createFileRoute } from '@tanstack/react-router'
import { SeoLandingPage } from '../components/public/SeoLandingPage'
import { createSeoHead } from '../lib/seo'

const canonicalUrl = 'https://quickspeakindonesia.net/kursus-bahasa-inggris-bandung'

export const Route = createFileRoute('/kursus-bahasa-inggris-bandung')({
  head: () =>
    createSeoHead({
      title: 'Kursus Bahasa Inggris Bandung | QuickSpeak',
      description:
        'Cari kursus Bahasa Inggris di Bandung dengan pembelajaran terstruktur, 4 level, teacher, serta pilihan private dan semi-private bersama QuickSpeak.',
      url: canonicalUrl,
    }),
  component: BandungEnglishCoursePage,
})

function BandungEnglishCoursePage() {
  return (
    <SeoLandingPage
      eyebrow="QUICKSPEAK BANDUNG"
      title="Kursus Bahasa Inggris di Bandung"
      intro="QuickSpeak menyediakan pembelajaran Bahasa Inggris yang terstruktur untuk siswa di Bandung melalui tahapan belajar yang jelas, pendampingan teacher, dan pilihan kelas yang dapat disesuaikan dengan kebutuhan siswa."
      sections={[
        {
          title: 'Pembelajaran Bahasa Inggris yang Terstruktur',
          body:
            'QuickSpeak menyusun perjalanan belajar melalui empat level, dari foundation hingga pengembangan lanjutan. Setiap level membantu siswa memahami materi, berlatih secara bertahap, dan memantau perkembangan belajarnya bersama teacher.',
        },
        {
          title: 'Pilihan Private dan Semi-Private Class',
          body:
            'Siswa dapat memilih private class untuk pembelajaran yang lebih personal atau semi-private class dengan kelompok kecil hingga empat siswa. Pilihan ini membantu keluarga menentukan format belajar yang sesuai dengan kebutuhan dan kenyamanan siswa.',
        },
        {
          title: 'Bisa Belajar dengan Pendampingan Teacher',
          body:
            'Teacher mendampingi proses belajar dan membantu siswa memahami materi, berlatih, serta mengevaluasi perkembangan. Sistem QuickSpeak juga mendokumentasikan progress pembelajaran agar perjalanan belajar lebih terarah.',
        },
        {
          title: 'Pilihan Pembelajaran Online',
          body:
            'Selain konteks Bandung, QuickSpeak juga menyediakan pengalaman belajar online sehingga siswa dapat mengikuti pembelajaran dari lokasi yang sesuai dengan kebutuhan mereka, tanpa mengubah struktur level dan pendampingan yang digunakan.',
        },
      ]}
      relatedLinks={[
        {
          to: '/kursus-bahasa-inggris-online',
          label: 'Kursus Bahasa Inggris Online',
        },
        {
          to: '/kursus-bahasa-inggris-anak',
          label: 'Kursus Bahasa Inggris untuk Anak',
        },
        {
          to: '/kursus-bahasa-inggris-bandung',
          label: 'Kursus Bahasa Inggris Bandung',
        },
      ]}
    />
  )
}
