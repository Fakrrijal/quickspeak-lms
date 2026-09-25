import { Link } from '@tanstack/react-router'

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

export function SeoLandingPage({
  eyebrow,
  title,
  intro,
  sections,
  relatedLinks,
}: SeoLandingPageProps) {
  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-10 sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1b5dd7]">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[#102449] sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">{intro}</p>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-6 py-12 sm:px-8 sm:py-16">
        <article className="space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-2xl font-semibold tracking-[-0.025em] text-[#102449] sm:text-3xl">{section.title}</h2>
              <p className="mt-4 text-base leading-8 text-slate-700">{section.body}</p>
            </section>
          ))}
        </article>

        <section className="mt-14 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-[#102449]">Program QuickSpeak lainnya</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {relatedLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-2xl border border-slate-200 bg-[#f9fbff] p-4 text-sm font-semibold text-[#102449] transition hover:border-[#1b5dd7]/40 hover:text-[#1b5dd7]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl bg-[#102449] p-8 text-white">
          <h2 className="text-2xl font-semibold">Mulai belajar bersama QuickSpeak</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">
            Lihat program yang sesuai kebutuhan Anda atau hubungi tim QuickSpeak untuk mendapatkan informasi lebih lanjut.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/register"
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-bold text-[#102449] transition hover:bg-slate-100"
            >
              Daftar Sekarang
            </Link>
            <a
              href="https://wa.me/6282138138564?text=Halo%20QuickSpeak%2C%20saya%20ingin%20mendapatkan%20informasi%20mengenai%20program%20English%20Course."
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Hubungi QuickSpeak
            </a>
          </div>
        </section>
      </main>
    </div>
  )
}
