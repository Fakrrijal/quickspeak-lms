import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { PublicHeader } from './PublicHeader'

const whatsappUrl =
  'https://wa.me/6282138138564?text=Halo%20QuickSpeak%2C%20saya%20ingin%20mendapatkan%20informasi%20mengenai%20program%20English%20Course.'

const levels = [
  { number: '01', title: 'Foundation', description: 'Membangun dasar bahasa Inggris dengan materi yang jelas dan terarah.' },
  { number: '02', title: 'Development', description: 'Melatih kemampuan komunikasi dan pemahaman konsep secara bertahap.' },
  { number: '03', title: 'Progress', description: 'Memperkuat kemampuan berbahasa melalui latihan dan evaluasi berkelanjutan.' },
  { number: '04', title: 'Advanced Development', description: 'Membawa siswa ke level yang lebih siap untuk penggunaan bahasa yang luas.' },
]

const programs = [
  {
    tag: 'PRIVATE CLASS',
    title: 'Belajar lebih fokus secara personal.',
    description: 'Pendampingan yang lebih personal untuk kebutuhan belajar siswa.',
    items: ['Fokus pada kebutuhan siswa', 'Interaksi personal', 'Dukungan teacher'],
    price: 'Rp180.000',
  },
  {
    tag: 'SEMI-PRIVATE CLASS',
    title: 'Belajar bersama kelompok kecil hingga 4 siswa.',
    description: 'Interaksi aktif dalam kelompok kecil dengan suasana belajar yang kolaboratif.',
    items: ['Maksimal 4 siswa', 'Interaksi lebih aktif', 'Suasana kolaboratif'],
    price: 'Rp150.000',
  },
]

const testimonials = [
  { name: 'Rayhan', identity: 'Siswa SD', quote: 'Belajar Bahasa Inggris di QuickSpeak menyenangkan. Saya jadi lebih berani berbicara Bahasa Inggris dan lebih percaya diri saat belajar.' },
  { name: 'Hana', identity: 'Siswa SMP', quote: 'Saya suka karena teachernya menjelaskan dengan sabar dan membuat materi lebih mudah dipahami.' },
  { name: 'Haikal', identity: 'Siswa SMP/SMA', quote: 'Latihan di QuickSpeak membuat saya lebih terbiasa menggunakan Bahasa Inggris. Belajarnya tidak terasa membosankan.' },
  { name: 'Nizar Ali', identity: 'Siswa SMP/SMA', quote: 'Saya merasa kemampuan Bahasa Inggris saya semakin berkembang karena belajar secara bertahap dan terarah.' },
  { name: 'Zahra', identity: 'Mahasiswa', quote: 'Pembelajarannya membantu saya lebih fokus pada kemampuan yang ingin saya tingkatkan, terutama dalam menggunakan Bahasa Inggris.' },
  { name: 'Kaila', identity: 'Young Adult/Mahasiswa', quote: 'QuickSpeak membuat proses belajar Bahasa Inggris terasa lebih terstruktur dan lebih mudah diikuti.' },
]

const faqs = [
  { question: 'Apa saja level QuickSpeak?', answer: 'QuickSpeak memiliki pembelajaran yang disusun dalam empat level, mulai dari dasar hingga pengembangan lanjutan.' },
  { question: 'Bagaimana cara mendaftar?', answer: 'Calon siswa dapat mendaftar melalui formulir pendaftaran dan mengikuti proses review yang ditentukan oleh tim QuickSpeak.' },
  { question: 'Apakah pendaftaran langsung aktif?', answer: 'Pendaftaran diproses sesuai administrasi dan peninjauan yang berlaku di QuickSpeak.' },
  { question: 'Bagaimana proses belajar di QuickSpeak?', answer: 'Siswa mengikuti pembelajaran secara bertahap sesuai level, didampingi teacher, dengan latihan dan evaluasi yang terarah.' },
  { question: 'Bagaimana cara menghubungi QuickSpeak?', answer: 'Anda dapat menghubungi tim QuickSpeak melalui WhatsApp admin di nomor 0821 3813 8564.' },
]

export function QuickSpeakLanding() {
  const [openFaq, setOpenFaq] = useState(0)
  const [showStickyCta, setShowStickyCta] = useState(false)

  useEffect(() => {
    document.title = 'QuickSpeak — English Course'
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = 'QuickSpeak adalah English Course dengan pembelajaran terstruktur, empat level, dan dukungan teacher.'

    const handleScroll = () => setShowStickyCta(window.scrollY > 320)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div id="top" className="min-h-screen overflow-x-hidden bg-[#f7f9fc] text-slate-900">
      <PublicHeader />

      <main>
        <section className="relative overflow-hidden bg-[#f7f9fc] pt-28 pb-20 sm:pt-32 lg:pb-28">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-sky-100/60 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:px-12">
            <div>
              <span className="inline-flex rounded-full border border-blue-100 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-blue-700 shadow-sm">
                ENGLISH COURSE
              </span>
              <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-[-0.045em] text-[#102449] sm:text-5xl lg:text-[4.15rem]">
                Belajar Bahasa Inggris dengan Cara Praktis dan Menyenangkan
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Pembelajaran Bahasa Inggris yang terstruktur melalui 4 level, didampingi teacher, dan dirancang agar siswa berkembang secara bertahap.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/register" className="inline-flex items-center justify-center rounded-full bg-[#102449] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-300/40 transition hover:-translate-y-0.5 hover:bg-[#16345f]">
                  Mulai Pembelajaran
                </Link>
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-3.5 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50">
                  Hubungi Kami
                </a>
              </div>
              <div className="mt-8 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
                {['4 Level', 'Teacher Support', 'Private', 'Semi-Private'].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-white px-3 py-4 text-center shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -right-8 top-8 h-28 w-28 rounded-full bg-yellow-100 blur-3xl" />
              <div className="absolute -left-8 bottom-8 h-32 w-32 rounded-full bg-blue-100 blur-3xl" />
              <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(16,36,73,0.10)]">
                <div className="rounded-[26px] bg-[#102449] p-6 text-white sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-200">QuickSpeak Learning Journey</p>
                      <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Grow step by step.</h2>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-sm font-extrabold">QS</div>
                  </div>
                  <div className="mt-8 space-y-3">
                    {levels.map((level) => (
                      <div key={level.number} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-extrabold text-[#102449]">{level.number}</div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">LEVEL {Number(level.number)}</p>
                          <p className="mt-1 truncate text-sm font-bold sm:text-base">{level.title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-100 bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">ABOUT QUICKSPEAK</p>
                <h2 className="mt-4 max-w-xl text-3xl font-extrabold tracking-[-0.04em] text-[#102449] sm:text-4xl">Sistem belajar yang jelas, rapi, dan bertahap.</h2>
                <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">QuickSpeak membantu siswa belajar melalui alur yang mudah dipahami, pendampingan teacher, serta pilihan kelas yang sesuai kebutuhan.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ['01', 'Terstruktur', 'Alur belajar jelas dari Level 1 hingga Level 4.'],
                  ['02', 'Didampingi Teacher', 'Bimbingan langsung selama proses belajar.'],
                  ['03', 'Fleksibel', 'Pilihan private dan semi-private.'],
                ].map(([number, title, description]) => (
                  <div key={number} className="rounded-3xl border border-slate-200 bg-[#f8fbff] p-6 shadow-sm">
                    <div className="text-xs font-extrabold tracking-[0.18em] text-blue-700">{number}</div>
                    <h3 className="mt-7 text-lg font-extrabold text-[#102449]">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f7f9fc] py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">LEARNING LEVELS</p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.04em] text-[#102449] sm:text-4xl">Empat level pembelajaran.</h2>
              <p className="mt-4 text-base leading-8 text-slate-600">Siswa berkembang secara bertahap melalui level pembelajaran yang terarah.</p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {levels.map((level) => (
                <article key={level.number} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60">
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#102449] text-sm font-extrabold text-white">{level.number}</span>
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">LEVEL {Number(level.number)}</span>
                  </div>
                  <h3 className="mt-7 text-xl font-extrabold tracking-tight text-[#102449]">{level.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{level.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="programs" className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">PROGRAMS</p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.04em] text-[#102449] sm:text-4xl">Pilih cara belajar yang paling sesuai.</h2>
              <p className="mt-4 text-base leading-8 text-slate-600">Dua pilihan kelas dengan pengalaman belajar yang fokus dan terarah.</p>
            </div>
            <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-2">
              {programs.map((program, index) => (
                <article key={program.tag} className={`rounded-[30px] border p-8 shadow-sm sm:p-9 ${index === 1 ? 'border-[#102449] bg-[#102449] text-white shadow-xl shadow-slate-300/30' : 'border-slate-200 bg-[#f8fbff]'}`}>
                  <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-extrabold tracking-[0.18em] ${index === 1 ? 'bg-white/10 text-blue-100' : 'bg-blue-50 text-blue-700'}`}>{program.tag}</span>
                  <h3 className={`mt-5 text-2xl font-extrabold tracking-tight ${index === 1 ? 'text-white' : 'text-[#102449]'}`}>{program.title}</h3>
                  <p className={`mt-3 text-sm leading-7 ${index === 1 ? 'text-slate-300' : 'text-slate-600'}`}>{program.description}</p>
                  <div className="mt-7 space-y-3">
                    {program.items.map((item) => (
                      <div key={item} className="flex items-center gap-3 text-sm font-medium">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${index === 1 ? 'bg-white text-[#102449]' : 'bg-blue-100 text-blue-700'}`}>✓</span>
                        <span className={index === 1 ? 'text-slate-100' : 'text-slate-700'}>{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-8 border-t pt-6 ${index === 1 ? 'border-white/10' : 'border-slate-200'}`}>
                    <p className={`text-xs font-bold uppercase tracking-[0.18em] ${index === 1 ? 'text-slate-400' : 'text-slate-500'}`}>Mulai dari</p>
                    <div className="mt-1 flex items-end justify-between gap-4">
                      <p className={`text-3xl font-black ${index === 1 ? 'text-white' : 'text-[#102449]'}`}>{program.price}</p>
                      <Link to="/register" className={`rounded-full px-5 py-2.5 text-sm font-bold ${index === 1 ? 'bg-white text-[#102449]' : 'bg-[#102449] text-white'}`}>Daftar</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f7f9fc] py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">STUDENT STORIES</p>
                <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.04em] text-[#102449] sm:text-4xl">Pengalaman belajar di QuickSpeak.</h2>
              </div>
              <span className="text-sm font-semibold text-slate-500">Apa yang mereka rasakan setelah belajar bersama QuickSpeak.</span>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {testimonials.map((item) => (
                <article key={item.name} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-sm font-extrabold text-blue-700">{item.name.slice(0, 1)}</div>
                    <div>
                      <h3 className="font-extrabold text-[#102449]">{item.name}</h3>
                      <p className="text-xs font-medium text-slate-500">{item.identity}</p>
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-7 text-slate-600">“{item.quote}”</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-6 sm:px-8">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">FAQ</p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.04em] text-[#102449] sm:text-4xl">Pertanyaan yang sering diajukan.</h2>
            </div>
            <div className="mt-10 space-y-3">
              {faqs.map((faq, index) => {
                const open = openFaq === index
                return (
                  <div key={faq.question} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <button type="button" onClick={() => setOpenFaq(open ? -1 : index)} className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left">
                      <span className="text-sm font-bold text-[#102449] sm:text-base">{faq.question}</span>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-medium text-slate-700 transition ${open ? 'rotate-45' : ''}`}>+</span>
                    </button>
                    {open && <div className="border-t border-slate-100 px-5 pb-5 pt-4 text-sm leading-7 text-slate-600">{faq.answer}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section id="contact" className="bg-[#102449] py-20 text-white sm:py-24">
          <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-12">
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-200">READY TO START?</p>
                <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">Mulai perjalanan belajar Bahasa Inggris Anda bersama QuickSpeak.</h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">Daftar untuk memulai proses pembelajaran atau hubungi tim QuickSpeak untuk mendapatkan informasi lebih lanjut.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link to="/register" className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3.5 text-sm font-bold text-[#102449] hover:bg-slate-100">Daftar Sekarang</Link>
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-7 py-3.5 text-sm font-bold text-white hover:bg-white/15">WhatsApp QuickSpeak</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#0b1933] py-8 text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 text-sm sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <p>© {new Date().getFullYear()} QuickSpeak English Course. All rights reserved.</p>
          <p>Belajar. Berlatih. Berkembang.</p>
        </div>
      </footer>

      {showStickyCta && (
        <a href={whatsappUrl} target="_blank" rel="noreferrer" className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#102449] px-4 py-3 text-sm font-bold text-white shadow-2xl shadow-slate-900/20 ring-1 ring-white/10 transition hover:-translate-y-0.5">
          WhatsApp QuickSpeak
        </a>
      )}
    </div>
  )
}
