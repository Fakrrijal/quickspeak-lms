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
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-sm">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <img src="/branding/quickspeak-logo.png" alt="QuickSpeak Logo" className="h-10 w-auto" />
        </div>

        <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="transition hover:text-[#102449]"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
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
          aria-label="Open navigation menu"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
        >
          <span className="space-y-1.5">
            <span className={`block h-0.5 w-5 rounded bg-slate-700 transition ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block h-0.5 w-5 rounded bg-slate-700 transition ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-5 rounded bg-slate-700 transition ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </span>
        </button>
      </nav>

      {/* Mobile Menu */}
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
