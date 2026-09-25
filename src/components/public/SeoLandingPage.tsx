import { Link } from '@tanstack/react-router'
import { PublicHeader } from './PublicHeader'

type SeoLink = {
  to:
    | '/kursus-bahasa-inggris-bandung'
    | '/kursus-bahasa-inggris-online'
    | '/kursus-bahasa-inggris-anak'
  label: string
}

type SeoSection = {
  title: string
  body: string
}

type SeoLandingPageProps = {
  eyebrow: string
  title: string
  intro: string
  sections: SeoSection[]
  relatedLinks: SeoLink[]
}

const whatsappUrl =
  'https://wa.me/6282138138564?text=Halo%20QuickSpeak%2C%20saya%20ingin%20mendapatkan%20informasi%20mengenai%20program%20English%20Course.'

export function SeoLandingPage({
  eyebrow,
  title,
  intro,
  sections,
  relatedLinks,
}: SeoLandingPageProps) {
  return (
    <div id="top" className="min-h-screen overflow-x-hidden bg-[#f6f8fc] text-slate-900">
      <PublicHeader />

      <main>
        <section className="relative overflow-hidden bg-white">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#eaf1ff] blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-[#fff6cf] blur-3xl" aria-hidden="true" />

          <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1b5dd7]">{eyebrow}</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.05] tracking-[-0.045em] text-[#102449] sm:text-5xl lg:text-6xl">
                {title}
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
                {intro}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-full bg-[#102449] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-200 transition hover:bg-[#143562]"
                >
                  Daftar Sekarang
                </Link>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-[#102449] transition hover:border-[#1b5dd7] hover:text-[#1b5dd7]"
                >
                  Hubungi QuickSpeak
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-3 text-sm font-medium text-slate-600">
                <span className="rounded-full bg-[#f4f8ff] px-4 py-2">4 level pembelajaran</span>
                <span className="rounded-full bg-[#f4f8ff] px-4 py-2">Private & semi-private</span>
                <span className="rounded-full bg-[#f4f8ff] px-4 py-2">Progress terpantau</span>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-[#f8fbff] p-6 shadow-[0_24px_70px_rgba(16,36,73,0.08)] sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1b5dd7]">QuickSpeak English</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#102449]">
                Belajar dengan alur yang jelas
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Siswa mengikuti pembelajaran secara bertahap bersama teacher, dengan latihan dan evaluasi yang membantu perjalanan belajar tetap terarah.
              </p>

              <div className="mt-6 grid gap-3">
                {['Foundation', 'Development', 'Progress', 'Advanced Development'].map((level, index) => (
                  <div
                    key={level}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#102449] text-xs font-bold text-white">
                      0{index + 1}
                    </span>
                    <span className="text-sm font-semibold text-[#102449]">{level}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1b5dd7]">Why QuickSpeak</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#102449] sm:text-4xl">
              Pembelajaran Bahasa Inggris yang terstruktur
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-600">
              Setiap program dirancang agar siswa memahami materi, berlatih, mendapatkan pendampingan teacher, dan melihat perkembangan belajarnya secara bertahap.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {sections.map((section, index) => (
              <section
                key={section.title}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-8"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f0f5ff] text-sm font-bold text-[#1b5dd7]">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <h2 className="mt-5 text-2xl font-semibold tracking-[-0.025em] text-[#102449]">{section.title}</h2>
                <p className="mt-4 text-base leading-8 text-slate-600">{section.body}</p>
              </section>
            ))}
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="rounded-[2rem] border border-slate-200 bg-[#f8fbff] p-7 sm:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1b5dd7]">Program QuickSpeak</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#102449]">
                Pilih program yang sesuai kebutuhan
              </h2>

              <div className="mt-7 grid gap-4 md:grid-cols-3">
                {relatedLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-[#1b5dd7]/40 hover:shadow-sm"
                  >
                    <div className="text-base font-semibold text-[#102449] group-hover:text-[#1b5dd7]">{link.label}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-500">Lihat detail program QuickSpeak</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="rounded-[2rem] bg-[#102449] p-8 text-white sm:p-10 lg:p-12">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f5d779]">Mulai Belajar</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Mulai belajar bersama QuickSpeak
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-200">
                Pilih program yang sesuai kebutuhan siswa atau hubungi tim QuickSpeak untuk mendapatkan informasi lebih lanjut mengenai kelas dan proses pendaftaran.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#102449] transition hover:bg-slate-100"
                >
                  Daftar Sekarang
                </Link>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Chat WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-slate-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <div className="font-semibold text-[#102449]">QuickSpeak English</div>
            <div className="mt-1">Kursus Bahasa Inggris online dan di Bandung.</div>
          </div>
          <div>Jl. Raya Kopo No. 433, Kota Bandung, Jawa Barat, Indonesia</div>
        </div>
      </footer>
    </div>
  )
}
