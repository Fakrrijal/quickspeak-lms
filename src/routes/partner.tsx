import { createFileRoute, Link } from '@tanstack/react-router'
import { PublicHeader } from '../components/public/PublicHeader'

export const Route = createFileRoute('/partner')({
  component: PartnerPage,
})

function PartnerPage() {
  const whatsappUrl = "https://wa.me/6282138138564?text=Halo%20QuickSpeak%2C%20saya%20ingin%20mendapatkan%20informasi%20mengenai%20kesempatan%20menjadi%20Teaching%20Partner%20QuickSpeak."

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased pt-20">
      <PublicHeader />

      <main className="mx-auto max-w-7xl px-6 py-16 pb-24">
        {/* HERO SECTION */}
        <section className="relative bg-[#faf8f5] py-16 lg:py-24 overflow-hidden rounded-3xl">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              {/* Left: Copy */}
              <div>
                <span className="text-xs font-bold text-blue-600 tracking-widest uppercase">BECOME A QUICKSPEAK</span>
                <h1 className="mt-4 text-4xl font-semibold leading-[1.15] tracking-[-0.03em] text-[#102449] sm:text-5xl lg:text-[3.25rem]">
                  Teaching Partner
                </h1>
                <p className="mt-5 max-w-lg text-base leading-7 text-slate-700 sm:text-lg">
                  Ambillah peran penting dalam mentransformasi cara siswa belajar bahasa Inggris secara terstruktur, terarah, dan berkelanjutan. Di QuickSpeak, Anda tidak hanya mengajar, tetapi juga mengawal setiap tahapan perkembangan siswa secara terukur.
                </p>
                <p className="mt-3 max-w-lg text-base leading-7 text-slate-700 sm:text-lg">
                  Nikmati pengalaman mengajar yang kolaboratif, dukungan kurikulum yang terintegrasi, serta kesempatan untuk terus berkembang secara profesional dalam lingkungan kerja yang suportif.
                </p>
              </div>

              {/* Right: Teacher Visual */}
              <div className="relative overflow-hidden rounded-3xl">
                <img src="/teacher-partner-hero.png.png" alt="Teaching Partner" className="w-full h-auto object-cover aspect-[4/3]" />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-24">
            <h2 className="text-4xl font-extrabold text-center text-slate-900">Why Teach With QuickSpeak?</h2>
            <div className="mt-12 grid md:grid-cols-3 gap-8">
              {[
                {t: 'Structured Teaching', d: 'Sistem terstruktur dan jelas.', icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>},
                {t: 'Teaching Groups', d: 'Manajemen grup terorganisir.', icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>},
                {t: 'Progress Tracking', d: 'Pantau perkembangan.', icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/></svg>},
                {t: 'Attendance', d: 'Sistem tercatat.', icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/></svg>},
                {t: 'Teacher Fee', d: 'Transparan & detail.', icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>},
                {t: 'Platform', d: 'Sistem terintegrasi.', icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/></svg>}
              ].map(i => (
                <div key={i.t} className="p-8 rounded-3xl bg-white border border-slate-100 shadow-sm text-center">
                    <div className="text-blue-600 text-3xl mb-4 flex justify-center">{i.icon}</div>
                    <h3 className="text-lg font-bold text-slate-900">{i.t}</h3>
                    <p className="mt-2 text-sm text-slate-600">{i.d}</p>
                </div>
              ))}
            </div>
        </section>

        <section className="mt-24 py-16 bg-slate-900 text-white rounded-3xl text-center">
            <h2 className="text-4xl font-extrabold">Ready to Teach With QuickSpeak?</h2>
            <p className="mt-4 text-slate-400">Bangun pengalaman mengajar yang terstruktur dan tumbuh bersama.</p>
            <div className="mt-10 flex gap-4 justify-center">
              <a href="/register" className="rounded-full bg-yellow-400 px-8 py-4 font-bold text-blue-900 hover:bg-yellow-300">Daftar Sebagai Pengajar</a>
              <a href={whatsappUrl} className="rounded-full border border-white/20 px-8 py-4 font-bold text-white hover:bg-white/10">Chat Admin via WhatsApp</a>
            </div>
        </section>
      </main>

      <footer className="bg-[#08111e] pb-12 pt-16 text-slate-300">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_1.4fr_1.4fr]">
            <div className="lg:pr-6">
              <div className="text-2xl font-black tracking-[-0.04em] text-white">QuickSpeak</div>
              <div className="mt-2 text-sm font-medium text-slate-400">English Course</div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Quick Links</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li><a href="/" className="transition hover:text-white">Home</a></li>
                <li><a href="/#programs" className="transition hover:text-white">Program</a></li>
                <li><a href="/#contact" className="transition hover:text-white">Contact</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">For Teachers</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li>
                  <Link to="/partner" className="transition hover:text-white">
                    Become Our Partner
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Contact</div>
              <ul className="mt-4 space-y-5 text-base">
                <li>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">WhatsApp</div>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block whitespace-nowrap text-sm text-white hover:text-[#f5d779]"
                  >
                    0821 3813 8564
                  </a>
                </li>
                <li>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Address</div>
                  <div className="mt-1 text-sm leading-7 text-white">
                    Jl. Raya Kopo No. 433, Kota Bandung, Jawa Barat, Indonesia
                  </div>
                </li>
              </ul>
            </div>

            <div>
              <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Our Social Media</div>
              <ul className="mt-4 space-y-5 text-base">
                <li>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Instagram</div>
                  <div className="mt-1 whitespace-nowrap text-sm text-white">@Quickspeakindonesia</div>
                </li>
                <li>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Facebook</div>
                  <div className="mt-1 text-sm text-white">Quickspeak</div>
                </li>
              </ul>
            </div>
          </div>

        </div>
      </footer>
    </div>
  )
}
