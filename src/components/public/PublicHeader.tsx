import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'

const navItems = [
  { label: 'Beranda', href: '#top' },
  { label: 'Program', href: '#programs' },
  { label: 'Kontak', href: '#contact' },
]

export function PublicHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleQuickSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchQuery.trim().toLowerCase()
    if (!query) return

    if (query.includes('program') || query.includes('kelas') || query.includes('private')) {
      window.location.hash = '#programs'
    } else if (query.includes('kontak') || query.includes('whatsapp') || query.includes('hubung')) {
      window.location.hash = '#contact'
    } else {
      window.location.hash = '#programs'
    }

    setSearchQuery('')
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200/80 bg-white shadow-sm">
      {/* Utility strip: follows the two-tier structure of institutional websites while keeping QuickSpeak styling. */}
      <div className="border-b border-slate-200/80 bg-[#f4f8ff]">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-5 px-4 sm:px-6 lg:px-8">
          <Link
            to="/register"
            className="hidden shrink-0 items-center gap-2 text-sm font-semibold text-[#102449] transition hover:text-[#1b5dd7] lg:flex"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1b5dd7] text-white" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-2" focusable="false">
                <path d="M4 5.5h16v10H8l-4 3V5.5Z" />
                <path d="M8 9h8M8 12h5" />
              </svg>
            </span>
            Pendaftaran Siswa Baru
          </Link>

          <form onSubmit={handleQuickSearch} className="min-w-0 flex-1 lg:mx-auto lg:max-w-[380px]">
            <label className="sr-only" htmlFor="quickspeak-search">Cari di QuickSpeak</label>
            <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-white shadow-sm">
              <span className="flex h-full w-10 shrink-0 items-center justify-center text-slate-400" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" focusable="false">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m16 16 4 4" />
                </svg>
              </span>
              <input
                id="quickspeak-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari"
                className="min-w-0 flex-1 bg-transparent pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
          </form>

          <div className="hidden items-center gap-2 lg:flex" aria-label="QuickSpeak social media">
            <a href="#" onClick={(event) => event.preventDefault()} aria-label="YouTube" title="YouTube" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#102449] ring-1 ring-slate-200 transition hover:text-[#1b5dd7]">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true"><path d="M21.6 7.2a2.9 2.9 0 0 0-2-2C17.8 4.7 12 4.7 12 4.7s-5.8 0-7.6.5a2.9 2.9 0 0 0-2 2C1.9 9 1.9 12 1.9 12s0 3 .5 4.8a2.9 2.9 0 0 0 2 2c1.8.5 7.6.5 7.6.5s5.8 0 7.6-.5a2.9 2.9 0 0 0 2-2c.5-1.8.5-4.8.5-4.8s0-3-.5-4.8ZM10 15.2V8.8l5.4 3.2L10 15.2Z" /></svg>
            </a>
            <a href="#" onClick={(event) => event.preventDefault()} aria-label="Instagram" title="Instagram" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#102449] ring-1 ring-slate-200 transition hover:text-[#1b5dd7]">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="12" cy="12" r="3.5" /><circle cx="17.2" cy="6.8" r="0.8" className="fill-current stroke-none" /></svg>
            </a>
            <a href="#" onClick={(event) => event.preventDefault()} aria-label="Facebook" title="Facebook" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#102449] ring-1 ring-slate-200 transition hover:text-[#1b5dd7]">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true"><path d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.6 1.7-1.6h1.8V3.8c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.3H8.2v3h2.6v8h2.7Z" /></svg>
            </a>
            <a href="#" onClick={(event) => event.preventDefault()} aria-label="LinkedIn" title="LinkedIn" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#102449] ring-1 ring-slate-200 transition hover:text-[#1b5dd7]">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true"><path d="M6.3 8.8H3.4V21h2.9V8.8ZM4.8 3A1.8 1.8 0 1 0 4.8 6.6 1.8 1.8 0 0 0 4.8 3ZM20.6 13.9c0-3.4-1.8-5.3-4.4-5.3-2.1 0-3 1.2-3.5 2v-1.8H9.8V21h2.9v-6.1c0-1.6.3-3.2 2.3-3.2 2 0 2.1 1.9 2.1 3.3V21H20.6v-7.1Z" /></svg>
            </a>
          </div>

          <button type="button" title="Pilih bahasa" className="hidden items-center gap-1.5 text-sm font-bold text-[#102449] transition hover:text-[#1b5dd7] lg:flex">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.7 5.5 3.7 9S14.5 18.5 12 21c-2.5-2.5-3.7-5.5-3.7-9S9.5 5.5 12 3Z" /></svg>
            EN
            <span className="text-[10px]">▾</span>
          </button>

          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 lg:hidden">
            <Link to="/register" className="truncate text-xs font-bold text-[#102449]">
              Pendaftaran Siswa Baru
            </Link>
            <button type="button" title="Pilih bahasa" className="flex shrink-0 items-center gap-1 text-xs font-bold text-[#102449]">
              EN <span className="text-[9px]">▾</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary navigation */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="QuickSpeak English home">
          <img src="/favicon.svg" alt="" aria-hidden="true" className="h-10 w-10 shrink-0 object-contain" />
          <span className="leading-none">
            <span className="block text-[18px] font-extrabold tracking-[-0.03em] text-[#102449]">QuickSpeak</span>
            <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[0.34em] text-[#1b5dd7]">English</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 lg:flex">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} className="transition hover:text-[#102449]">
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-4 lg:flex">
          <Link to="/login" className="font-semibold text-slate-700 transition hover:text-[#102449]">
            Masuk
          </Link>
          <Link
            to="/register"
            className="rounded-full bg-[#102449] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-200 transition hover:bg-[#143562]"
          >
            Daftar Sekarang
          </Link>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          type="button"
          aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMobileMenuOpen}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
        >
          <span className="space-y-1.5">
            <span className={`block h-0.5 w-5 rounded bg-slate-700 transition ${isMobileMenuOpen ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`block h-0.5 w-5 rounded bg-slate-700 transition ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-5 rounded bg-slate-700 transition ${isMobileMenuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
          </span>
        </button>
      </nav>

      {isMobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white/95 backdrop-blur-sm lg:hidden">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-[#102449]"
                >
                  {item.label}
                </a>
              ))}
              <div className="my-2 border-t border-slate-200" />
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-lg px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-[#102449]"
              >
                Masuk
              </Link>
              <Link
                to="/register"
                onClick={() => setIsMobileMenuOpen(false)}
                className="mt-1 rounded-full bg-[#102449] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#143562]"
              >
                Daftar Sekarang
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
