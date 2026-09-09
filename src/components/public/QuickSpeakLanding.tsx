import { Link } from '@tanstack/react-router'
import { useEffect, useState, useRef } from 'react'
import { PublicHeader } from './PublicHeader'

const whatsappUrl =
  'https://wa.me/6282138138564?text=Halo%20QuickSpeak%2C%20saya%20ingin%20mendapatkan%20informasi%20mengenai%20program%20English%20Course.'

const navItems = [
  { label: 'Beranda', href: '#top' },
  { label: 'Program', href: '#programs' },
  { label: 'Kontak', href: '#contact' },
]

const journeySteps = [
  {
    step: '01',
    title: 'Foundation',
    description: 'Membangun dasar bahasa Inggris dengan materi yang jelas dan terarah.',
  },
  {
    step: '02',
    title: 'Development',
    description: 'Melatih kemampuan komunikasi dan pemahaman konsep secara bertahap.',
  },
  {
    step: '03',
    title: 'Progress',
    description: 'Memperkuat kemampuan berbahasa melalui latihan dan evaluasi berkelanjutan.',
  },
  {
    step: '04',
    title: 'Advanced Development',
    description: 'Membawa siswa ke level yang lebih siap untuk penggunaan bahasa yang luas.',
  },
]

const programCards = [
  {
    tag: 'Private Class',
    title: 'Belajar lebih fokus secara personal.',
    items: ['Fokus pada kebutuhan siswa', 'Interaksi personal', 'Dukungan teacher'],
    accent: 'light',
    fee: 'Rp180.000',
  },
  {
    tag: 'Semi-Private Class',
    title: 'Belajar bersama kelompok kecil hingga 4 siswa.',
    items: ['Maksimal 4 siswa', 'Interaksi lebih aktif', 'Suasana kolaboratif'],
    accent: 'dark',
    fee: 'Rp150.000',
  },
]

const testimonials = [
  {
    id: 1,
    name: 'Rayhan',
    identity: 'Siswa SD',
    quote: 'Belajar Bahasa Inggris di QuickSpeak menyenangkan. Saya jadi lebih berani berbicara Bahasa Inggris dan lebih percaya diri saat belajar.',
    image: '/testimonials/rayhan.jpg',
    placeholderColor: 'bg-gradient-to-br from-[#fef3c7] to-[#fef08a]',
  },
  {
    id: 2,
    name: 'Hana',
    identity: 'Siswa SMP',
    quote: 'Saya suka karena teachernya menjelaskan dengan sabar dan membuat materi lebih mudah dipahami.',
    image: '/testimonials/hana.jpg',
    placeholderColor: 'bg-gradient-to-br from-[#dcfce7] to-[#bbf7d0]',
  },
  {
    id: 3,
    name: 'Haikal',
    identity: 'Siswa SMP/SMA',
    quote: 'Latihan di QuickSpeak membuat saya lebih terbiasa menggunakan Bahasa Inggris. Belajarnya tidak terasa membosankan.',
    image: '/testimonials/haikal.jpg',
    placeholderColor: 'bg-gradient-to-br from-[#f5f3ff] to-[#ede9fe]',
  },
  {
    id: 4,
    name: 'Nizar Ali',
    identity: 'Siswa SMP/SMA',
    quote: 'Saya merasa kemampuan Bahasa Inggris saya semakin berkembang karena belajar secara bertahap dan terarah.',
    image: '/testimonials/nizar-ali.jpg',
    placeholderColor: 'bg-gradient-to-br from-[#dbeafe] to-[#bfdbfe]',
  },
  {
    id: 5,
    name: 'Zahra',
    identity: 'Mahasiswa',
    quote: 'Pembelajarannya membantu saya lebih fokus pada kemampuan yang ingin saya tingkatkan, terutama dalam menggunakan Bahasa Inggris.',
    image: '/testimonials/zahra.jpg',
    placeholderColor: 'bg-gradient-to-br from-[#fbecf8] to-[#f3e8ff]',
  },
  {
    id: 6,
    name: 'Kaila',
    identity: 'Young Adult/Mahasiswa',
    quote: 'QuickSpeak membuat proses belajar Bahasa Inggris terasa lebih terstruktur. Saya bisa mengikuti perkembangan belajar saya dengan lebih jelas.',
    image: '/testimonials/kaila.jpg',
    placeholderColor: 'bg-gradient-to-br from-[#f0fdfa] to-[#ccfbf1]',
  },
]

const faqItems = [
  {
    question: 'Apa saja level QuickSpeak?',
    answer:
      'QuickSpeak memiliki pembelajaran yang disusun dalam empat level, mulai dari dasar hingga pengembangan lanjutan.',
  },
  {
    question: 'Bagaimana cara mendaftar?',
    answer:
      'Calon siswa dapat mendaftar melalui formulir pendaftaran dan mengikuti proses review yang ditentukan oleh tim QuickSpeak.',
  },
  {
    question: 'Apakah pendaftaran langsung aktif?',
    answer:
      'Pendaftaran dapat dilanjutkan sesuai proses administrasi dan peninjauan yang berlaku di QuickSpeak.',
  },
  {
    question: 'Bagaimana siswa mengetahui perkembangan belajarnya?',
    answer:
      'Siswa dapat memantau perkembangan melalui fitur tracking progress serta sistem pembelajaran yang terstruktur.',
  },
  {
    question: 'Bagaimana cara menghubungi QuickSpeak?',
    answer:
      'Anda dapat menghubungi tim QuickSpeak melalui WhatsApp admin di nomor 0821 3813 8564.',
  },
]

export function QuickSpeakLanding() {
  useEffect(() => {
    document.title = 'QuickSpeak — English Course'

    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content =
      'QuickSpeak adalah English Course dengan pembelajaran terstruktur, empat level, dan dukungan teacher.'
  }, [])

  // Testimonial carousel state
  const [currentSlide, setCurrentSlide] = useState(0)
  const [cardsPerView, setCardsPerView] = useState(3)
  const [isAutoPlayEnabled, setIsAutoPlayEnabled] = useState(true)
  const autoPlayTimerRef = useRef<number | null>(null)
  const carouselRef = useRef<HTMLDivElement | null>(null)

  // Sticky WhatsApp CTA visibility
  const [showStickyCta, setShowStickyCta] = useState(false)
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyCta(window.scrollY > 200)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Calculate total slides based on cards per view
  const totalSlides = Math.ceil(testimonials.length / cardsPerView)

  // Check for prefers-reduced-motion
  const prefersReducedMotion = () => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  // Handle responsive card count
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setCardsPerView(1)
      } else if (window.innerWidth < 1024) {
        setCardsPerView(2)
      } else {
        setCardsPerView(3)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Auto-play carousel
  useEffect(() => {
    if (!isAutoPlayEnabled) return

    const autoplayInterval = prefersReducedMotion() ? 7000 : 5000

    autoPlayTimerRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides)
    }, autoplayInterval)

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current)
      }
    }
  }, [totalSlides, isAutoPlayEnabled])

  // Handle pause on hover/focus
  const handleCarouselMouseEnter = () => {
    setIsAutoPlayEnabled(false)
  }

  const handleCarouselMouseLeave = () => {
    setIsAutoPlayEnabled(true)
  }

  const handleCarouselFocus = () => {
    setIsAutoPlayEnabled(false)
  }

  const handleCarouselBlur = () => {
    setIsAutoPlayEnabled(true)
  }

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!carouselRef.current?.contains(document.activeElement)) return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrevious()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [totalSlides])

  const handlePrevious = () => {
    setIsAutoPlayEnabled(false)
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides)
    setTimeout(() => setIsAutoPlayEnabled(true), 500)
  }

  const handleNext = () => {
    setIsAutoPlayEnabled(false)
    setCurrentSlide((prev) => (prev + 1) % totalSlides)
    setTimeout(() => setIsAutoPlayEnabled(true), 500)
  }

  const handleDotClick = (index: number) => {
    setIsAutoPlayEnabled(false)
    setCurrentSlide(index)
    setTimeout(() => setIsAutoPlayEnabled(true), 500)
  }

  return (
    <div id="top" className="min-h-screen overflow-x-hidden bg-[#f6f8fc] text-slate-900 pt-20">
      <PublicHeader />

      <main>
        {/* HERO SECTION */}
        <section className="relative bg-[#faf8f5] py-16 lg:py-24 overflow-hidden">
          <div className="absolute inset-0 hidden lg:block pointer-events-none">
            <img
              src="/hero-student-hijab.png"
              alt=""
              className="absolute right-0 top-1/2 -translate-y-1/2 h-full w-auto max-w-none object-cover object-right opacity-95"
            />
          </div>

          <div className="relative mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="grid items-center lg:grid-cols-12">
              {/* Left: Copy occupying approx 55-60% width on desktop */}
              <div className="min-w-0 lg:col-span-7 xl:col-span-6 lg:pr-8">
                <div className="inline-flex items-center rounded-full border border-[#dfe9ff] bg-[#edf4ff]/90 backdrop-blur-sm px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-[#1b5dd7]">
                  ENGLISH COURSE
                </div>

                <h1 className="mt-5 text-4xl font-semibold leading-[1.15] tracking-[-0.03em] text-[#102449] sm:text-5xl lg:text-[3.25rem]">
                  Belajar Bahasa Inggris dengan Cara Praktis dan Menyenangkan
                </h1>

                <p className="mt-5 max-w-lg text-base leading-7 text-slate-700 sm:text-lg">
                  Pembelajaran Bahasa Inggris yang terstruktur melalui 4 level, didampingi teacher, dan dirancang untuk membantu siswa berkembang secara bertahap.
                </p>

                {/* Trust Points */}
                <div className="mt-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1b5dd7] text-sm font-bold text-white">✓</div>
                    <span className="text-sm font-medium text-slate-800">Kelas Online Interaktif</span>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1b5dd7] text-sm font-bold text-white">✓</div>
                    <span className="text-sm font-medium text-slate-800">Pembelajaran Terstruktur</span>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1b5dd7] text-sm font-bold text-white">✓</div>
                    <span className="text-sm font-medium text-slate-800">Tutor Profesional & Bersertifikat</span>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1b5dd7] text-sm font-bold text-white">✓</div>
                    <span className="text-sm font-medium text-slate-800">4 Level Pembelajaran</span>
                  </div>
                </div>

                {/* CTAs */}
                <div className="mt-7 flex flex-col gap-4 sm:flex-row">
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center rounded-full bg-[#102449] px-8 py-4 text-base font-bold text-white shadow-lg shadow-slate-200 transition hover:bg-[#143562]"
                  >
                    Mulai Pembelajaran
                  </Link>
                  <a
                    href="https://wa.me/6282138138564?text=Halo%20QuickSpeak%2C%20saya%20ingin%20mendapatkan%20informasi%20mengenai%20program%20pembelajaran."
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/90 backdrop-blur-sm px-8 py-4 text-base font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Hubungi Kami
                  </a>
                </div>
              </div>

              {/* Mobile / Tablet Image View */}
              <div className="mt-12 lg:hidden relative overflow-hidden rounded-3xl bg-transparent">
                <img src="/hero-student-hijab.png" alt="QuickSpeak Learning Experience" className="w-full h-auto object-cover aspect-[4/3]" />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1b5dd7]">About QuickSpeak</p>
                <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.04em] text-[#102449] sm:text-4xl">
                  Belajar Bahasa Inggris Lebih Terarah Bersama QuickSpeak
                </h2>
                <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
                  QuickSpeak menghadirkan pembelajaran Bahasa Inggris yang terstruktur melalui tahapan Level 1 hingga Level 4, didukung teacher dan sistem pembelajaran yang membantu siswa belajar, berlatih, dan memantau perkembangannya.
                </p>

                <div className="mt-8 space-y-5">
                  {[
                    ['Terstruktur', 'Alur belajar jelas dari Level 1 hingga Level 4.'],
                    ['Didampingi Teacher', 'Bimbingan langsung dalam proses belajar.'],
                    ['Terukur', 'Perkembangan siswa dapat dipantau.'],
                  ].map(([title, content]) => (
                    <div key={title} className="flex gap-4 rounded-[24px] border border-slate-200 bg-[#f9fbff] p-5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eaf2ff] text-lg font-black text-[#1b5dd7]">
                        ✓
                      </div>
                      <div>
                        <div className="text-lg font-bold text-[#102449]">{title}</div>
                        <div className="mt-1 text-sm leading-7 text-slate-600">{content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-8 top-8 h-32 w-32 rounded-full bg-[#dfeaff] blur-3xl" />
                <div className="absolute -right-8 bottom-0 h-40 w-40 rounded-full bg-[#f9eaa5] blur-3xl" />

                <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 shadow-2xl shadow-slate-300/50 ring-1 ring-slate-200/50">
                  <img src="/about-teacher-online.png.png" alt="QuickSpeak Teacher and Student Learning Environment" className="w-full h-full object-cover aspect-square" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#1b5dd7]">
                PEMBELAJARAN TERSTRUKTUR
              </span>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#102449] sm:text-4xl lg:text-[2.5rem]">
                Empat Level Pembelajaran untuk Perkembangan Bahasa Inggris Anda
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
                Siswa belajar secara bertahap melalui empat level pembelajaran yang terstruktur dan disesuaikan dengan perkembangan kemampuan mereka.
              </p>
            </div>

            <div className="mt-12">
              {/* Desktop Horizontal Learning Journey */}
              <div className="hidden lg:grid lg:grid-cols-4 gap-6 xl:gap-8 relative">
                {/* Connecting Progress Bar Behind */}
                <div className="absolute top-[38px] left-[10%] right-[10%] h-0.5 bg-slate-200 z-0" />

                {journeySteps.map((item, index) => (
                  <div key={item.title} className="relative z-10 flex flex-col items-center text-center group">
                    {/* Level Number Node */}
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white border-2 border-[#1b5dd7] text-2xl font-black text-[#102449] shadow-sm transition-all group-hover:bg-[#1b5dd7] group-hover:text-white">
                      0{index + 1}
                    </div>

                    <div className="mt-6">
                      <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#1b5dd7]">
                        LEVEL {index + 1}
                      </div>
                      <h3 className="mt-2 text-lg xl:text-xl font-bold tracking-tight text-[#102449]">
                        {item.title}
                      </h3>
                      <p className="mt-2.5 text-sm leading-6 text-slate-600 max-w-xs mx-auto">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tablet & Mobile Vertical Progression */}
              <div className="lg:hidden max-w-2xl mx-auto space-y-8 relative">
                <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-slate-200" />

                {journeySteps.map((item, index) => (
                  <div key={item.title} className="relative z-10 flex items-start gap-6">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white border-2 border-[#1b5dd7] text-base font-bold text-[#102449] shadow-sm">
                      0{index + 1}
                    </div>
                    <div className="pt-1">
                      <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#1b5dd7]">
                        LEVEL {index + 1}
                      </div>
                      <h3 className="mt-1 text-lg font-bold text-[#102449]">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* LEARNING EXPERIENCE SECTION */}
        <section className="bg-[#f8fafc] py-24 text-slate-900 border-t border-slate-200/80">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
              {/* Left: Copy */}
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#1b5dd7]">
                  YOUR LEARNING EXPERIENCE
                </span>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#102449] sm:text-4xl">
                  Belajar Bahasa Inggris dengan Proses yang Terstruktur dan Terarah
                </h2>
                <p className="mt-5 text-base leading-8 text-slate-600">
                  QuickSpeak dirancang untuk memberikan pengalaman belajar Bahasa Inggris yang konsisten. Siswa mengikuti alur pembelajaran yang jelas mulai dari pemahaman materi hingga pemantauan perkembangan bersama teacher.
                </p>

                <div className="mt-10 space-y-5">
                  {[
                    {
                      step: '01',
                      title: 'Materi Terstruktur',
                      desc: 'Pembelajaran disusun secara sistematis sesuai dengan level kemampuan siswa.'
                    },
                    {
                      step: '02',
                      title: 'Pendampingan Teacher',
                      desc: 'Siswa mendapat bimbingan dan arahan langsung dari teacher dalam proses belajar.'
                    },
                    {
                      step: '03',
                      title: 'Pemantauan Perkembangan',
                      desc: 'Kehadiran dan perkembangan belajar terdokumentasi dengan jelas agar tetap terarah.'
                    }
                  ].map((item) => (
                    <div key={item.step} className="flex gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#edf4ff] text-base font-bold text-[#1b5dd7]">
                        {item.step}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[#102449]">{item.title}</h3>
                        <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Educational Process Visual */}
              <div className="relative">
                <div className="absolute -left-8 top-8 h-40 w-40 rounded-full bg-[#dfeaff] blur-3xl opacity-60" />
                <div className="absolute -right-8 bottom-0 h-44 w-44 rounded-full bg-[#f9eaa5] blur-3xl opacity-50" />

                <div className="relative rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-xl">
                  <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#1b5dd7]">
                    ALUR BELAJAR QUICKSPEAK
                  </div>
                  <h3 className="mt-3 text-2xl font-bold tracking-tight text-[#102449]">
                    Tahapan Pengalaman Belajar Siswa
                  </h3>

                  <div className="mt-8 space-y-6">
                    {[
                      {
                        title: '1. Pelajari Materi',
                        desc: 'Siswa mempelajari materi level yang relevan dengan bimbingan teacher.'
                      },
                      {
                        title: '2. Latihan & Praktik',
                        desc: 'Menerapkan konsep yang dipelajari melalui sesi interaktif dan latihan terarah.'
                      },
                      {
                        title: '3. Evaluasi & Progress',
                        desc: 'Memantau hasil belajar dan pencapaian secara konsisten.'
                      }
                    ].map((stepItem) => (
                      <div key={stepItem.title} className="relative pl-6 border-l-2 border-[#1b5dd7]/30">
                        <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-[#1b5dd7]" />
                        <h4 className="font-bold text-[#102449]">{stepItem.title}</h4>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{stepItem.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 rounded-2xl bg-[#f9fbff] p-5 border border-slate-200/80 flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#102449] text-white font-bold text-sm">
                      QS
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#102449]">Dukungan Sistem & Teacher</div>
                      <div className="text-xs text-slate-600 mt-0.5">Memastikan konsistensi dan arah belajar siswa tetap terjaga.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="programs" className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1b5dd7]">Choose Your Learning Program</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#102449] sm:text-4xl">
                Program belajar yang disesuaikan dengan kebutuhan Anda.
              </h2>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto">
              {programCards.map((program) => (
                <div
                  key={program.tag}
                  className="flex h-full flex-col rounded-3xl border border-slate-200/90 bg-[#f9fbff] p-8 sm:p-10 shadow-[0_10px_30px_rgba(16,36,73,0.04)] transition hover:shadow-md"
                >
                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full bg-[#edf4ff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#1b5dd7]">
                        {program.tag}
                      </span>
                      {program.tag === 'Semi-Private Class' && (
                        <span className="inline-flex items-center rounded-full border border-[#f5d779]/70 bg-[#f5d779]/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#102449]">
                          Paling Populer
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold leading-snug tracking-[-0.02em] text-[#102449] sm:text-[1.65rem]">
                      {program.title}
                    </h3>
                    <div className="mt-3 h-[2px] w-10 rounded-full bg-[#f5d779]" />

                    <ul className="mt-7 space-y-3.5 text-slate-700">
                      {program.items.map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#eaf2ff] text-[11px] font-bold text-[#1b5dd7]">
                            ✓
                          </span>
                          <span className="text-[0.95rem] font-medium leading-6">{item}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-7 rounded-2xl border border-[#dfe9ff] bg-[#edf4ff]/70 px-5 py-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1b5dd7]">
                        Biaya Pendaftaran
                      </div>
                      <div className="mt-1.5 text-2xl font-bold tracking-tight text-[#102449]">
                        {program.fee}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-6 border-t border-slate-200/80">
                    <Link
                      to="/register"
                      className="inline-flex w-full items-center justify-center rounded-full bg-[#102449] px-6 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-[#143562]"
                    >
                      Daftar {program.tag}
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-16 text-center">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-4 text-base font-bold text-slate-700 transition hover:bg-slate-50 shadow-sm"
              >
                Konsultasikan program yang sesuai dengan kebutuhan Anda.
              </a>
            </div>
          </div>
        </section>

        <section className="bg-[#f4f7ff] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1b5dd7]">What Our Students Say</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#102449] sm:text-4xl">
                Pengalaman siswa dalam perjalanan belajar bersama QuickSpeak.
              </h2>
            </div>

            <div
              ref={carouselRef}
              className="relative mt-12"
              onMouseEnter={handleCarouselMouseEnter}
              onMouseLeave={handleCarouselMouseLeave}
              onFocus={handleCarouselFocus}
              onBlur={handleCarouselBlur}
            >
              {/* Carousel Container */}
              <div className="overflow-hidden">
                <div
                  className="flex transition-transform duration-500 ease-out"
                  style={{
                    transform: `translateX(-${currentSlide * 100}%)`,
                  }}
                >
                  {Array.from({ length: totalSlides }).map((_, slideIdx) => (
                    <div
                      key={slideIdx}
                      className="w-full flex-shrink-0"
                    >
                      <div className="grid gap-4 sm:gap-6" style={{ gridTemplateColumns: `repeat(${cardsPerView}, 1fr)` }}>
                        {Array.from({ length: cardsPerView }).map((_, cardIdx) => {
                          const testimonialIdx = slideIdx * cardsPerView + cardIdx
                          if (testimonialIdx >= testimonials.length) return null
                          const testimonial = testimonials[testimonialIdx]
                          return (
                            <div
                              key={`${slideIdx}-${cardIdx}`}
                              className="flex flex-col rounded-3xl border border-slate-200/90 bg-white shadow-[0_10px_30px_rgba(16,36,73,0.04)] transition duration-300 hover:shadow-md overflow-hidden"
                            >
                              {/* Student Photo Section */}
<div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 p-3 sm:p-4">
  <img
    src={testimonial.image}
    alt={testimonial.name}
    className="h-full w-full object-contain"
  />
</div>

                              {/* Card Content */}
                              <div className="flex flex-1 flex-col p-6 sm:p-7">
                                {/* Student Info */}
                                <div className="mb-4">
                                  <h3 className="text-xl font-bold tracking-[-0.03em] text-[#102449]">
                                    {testimonial.name}
                                  </h3>
                                  <p className="mt-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#1b5dd7]">
                                    {testimonial.identity}
                                  </p>
                                </div>

                                {/* Testimonial Quote */}
                                <p className="flex-1 text-sm leading-8 text-slate-600">
                                  &quot;{testimonial.quote}&quot;
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Previous Arrow */}
              <button
                onClick={handlePrevious}
                type="button"
                aria-label="Previous testimonials"
                className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-[#102449] p-2 text-white shadow-lg transition hover:bg-[#143562] hover:shadow-xl active:scale-95 sm:p-3 md:-left-16 lg:-left-20 focus:outline-none focus:ring-2 focus:ring-[#1b5dd7] focus:ring-offset-2"
              >
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Next Arrow */}
              <button
                onClick={handleNext}
                type="button"
                aria-label="Next testimonials"
                className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-[#102449] p-2 text-white shadow-lg transition hover:bg-[#143562] hover:shadow-xl active:scale-95 sm:p-3 md:-right-16 lg:-right-20 focus:outline-none focus:ring-2 focus:ring-[#1b5dd7] focus:ring-offset-2"
              >
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Pagination Dots */}
              <div className="mt-8 flex justify-center gap-2">
                {Array.from({ length: totalSlides }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleDotClick(idx)}
                    type="button"
                    aria-label={`Go to slide ${idx + 1}`}
                    aria-current={idx === currentSlide ? 'true' : 'false'}
                    className={`rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#1b5dd7] focus:ring-offset-2 ${
                      idx === currentSlide
                        ? 'h-3 w-8 bg-[#1b5dd7]'
                        : 'h-2.5 w-2.5 bg-slate-300 hover:bg-slate-400'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>



        {/* CONSULTATION SECTION */}
        <section className="bg-gradient-to-r from-[#102449] to-[#1b3a6b] py-16 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Belum yakin memilih program yang tepat?
            </h2>
            <p className="mt-6 text-lg text-slate-200">
              Konsultasikan kebutuhan belajar Anda dengan Admin QuickSpeak.
            </p>
            <div className="mt-8">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-[#f5d779] px-8 py-4 text-base font-bold text-[#102449] transition hover:bg-[#f1cc59]"
              >
                Chat Admin via WhatsApp
              </a>
            </div>
          </div>
        </section>

        <section id="faq" className="bg-white py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1b5dd7]">FAQ</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#102449] sm:text-4xl">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="mt-10 space-y-4">
              {faqItems.map((item, index) => (
                <details
                  key={item.question}
                  open={index === 0}
                  className="group rounded-[24px] border border-slate-200 bg-[#f8fafc] p-5 shadow-sm"
                >
                  <summary className="cursor-pointer list-none text-left text-base font-bold text-[#102449] marker:content-none">
                    <span className="flex items-center justify-between gap-6">
                      <span>{item.question}</span>
                      <span className="text-xl font-bold text-[#1b5dd7] transition group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#0f172a] py-20 text-white sm:py-24">
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f5d779]">Ready to Start?</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Ready to Start Your English Journey?
            </h2>
            <p className="mt-4 text-base text-slate-300 sm:text-lg">
              Mulai perjalanan belajar Bahasa Inggris Anda bersama QuickSpeak.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full bg-[#f5d779] px-8 py-4 text-base font-bold text-[#102449] transition hover:bg-[#f1cc59]"
              >
                Daftar Sekarang
              </Link>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-4 text-base font-bold text-white transition hover:bg-white/10"
              >
                Chat Admin via WhatsApp
              </a>
            </div>
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
                {navItems.map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className="transition hover:text-white">
                      {item.label}
                    </a>
                  </li>
                ))}
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

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat Admin via WhatsApp"
        className={`fixed z-50 inline-flex items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_16px_35px_rgba(37,211,102,0.45)] transition-all duration-300 ease-out hover:scale-105 hover:bg-[#1ebe5a] ${
          showStickyCta
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-3 opacity-0'
        } bottom-4 right-4 h-14 w-14 sm:bottom-6 sm:right-6 sm:h-[48px] sm:w-[160px] sm:gap-2 sm:rounded-full sm:pr-5`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className="h-6 w-6 shrink-0"
        >
          <path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.5 0 .16 5.34.16 11.88c0 2.09.55 4.12 1.6 5.92L0 24l6.36-1.66a11.86 11.86 0 0 0 5.68 1.45h.01c6.54 0 11.88-5.34 11.88-11.88 0-3.17-1.23-6.16-3.41-8.43Z" />
          <path
            d="M17.47 14.38c-.3-.15-1.77-.87-2.04-.97-.27-.15-.47.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.21 5.09 4.5.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z"
            fill="#25D366"
          />
        </svg>
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">Chat Admin</span>
      </a>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat Admin via WhatsApp"
        className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_16px_35px_rgba(37,211,102,0.45)] transition hover:scale-105 md:hidden"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className="h-7 w-7"
        >
          <path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.5 0 .16 5.34.16 11.88c0 2.09.55 4.12 1.6 5.92L0 24l6.36-1.66a11.86 11.86 0 0 0 5.68 1.45h.01c6.54 0 11.88-5.34 11.88-11.88 0-3.17-1.23-6.16-3.41-8.43Z" />
          <path
            d="M17.47 14.38c-.3-.15-1.77-.87-2.04-.97-.27-.15-.47.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.21 5.09 4.5.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z"
            fill="#25D366"
          />
        </svg>
      </a>
    </div>
  )
}
