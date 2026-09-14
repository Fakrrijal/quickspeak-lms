import { useState } from 'react'
import { Link } from '@tanstack/react-router'

const navItems = [
  { label: 'Beranda', href: '#top' },
  { label: 'Program', href: '#programs' },
  { label: 'Kontak', href: '#contact' },
]

export function PublicHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md">
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
