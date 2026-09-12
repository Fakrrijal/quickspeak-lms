import { useMemo, useState } from 'react'
import type { PortalRole } from '../../layouts/portal/portal-navigation'

type SupportSection = 'help' | 'guides' | 'contact' | 'report'

type PortalFooterProps = {
  role: Extract<PortalRole, 'student' | 'teacher'>
}

function WhatsAppIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
      <path d="M20 11.6a8.1 8.1 0 0 1-12 7l-4 1.1 1.1-3.9A8.1 8.1 0 1 1 20 11.6Z" />
      <path d="M8.5 8.2c.2-.4.4-.4.7.4l.7 1.7c.1.2.1.4 0 .5l.6.7c.5.1.4.3.3.6-.2.8-.9 1.3-1.7 1.3-1.1 0-2.5-.6-3.8-1.8-1.1-1-2.1-2.3-2.4-3.3-.3-.8-.2-1.6.2-2.1Z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="m4.5 7 7.5 6 7.5-6" />
    </svg>
  )
}

const copy = {
  student: {
    help: [
      ['Bagaimana melihat progress?', 'Buka Dashboard atau My Learning untuk melihat progress chapter yang sudah dicatat oleh guru.'],
      ['Bagaimana melihat ebook?', 'Buka My Learning lalu pilih ebook yang tersedia untuk level Anda.'],
      ['Ada masalah pembayaran?', 'Buka Payment dan periksa status pembayaran atau hubungi admin melalui Kontak.'],
    ],
    guides: [
      'Dashboard & Learning Progress',
      'My Learning & Ebook',
      'Attendance',
      'Payment & Upload Bukti Pembayaran',
      'Profile & Account',
    ],
  },
  teacher: {
    help: [
      ['Bagaimana mencatat Learning Progress?', 'Buka Learning Progress, pilih siswa, buka level yang tersedia, lalu klik Save pada chapter yang selesai.'],
      ['Bagaimana mengelola Teaching Groups?', 'Buka Teaching Groups untuk melihat group yang ditugaskan, level, dan roster siswa.'],
      ['Bagaimana mencatat Attendance?', 'Buka Attendance lalu pilih group dan periode yang sesuai untuk mencatat kehadiran.'],
    ],
    guides: [
      'Dashboard & Teaching Activity',
      'Teaching Groups',
      'Learning Progress',
      'Books',
      'Attendance & Fee',
      'Profile & Account',
    ],
  },
} as const

export function PortalFooter({ role }: PortalFooterProps) {
  const [section, setSection] = useState<SupportSection | null>(null)
  const [reportCategory, setReportCategory] = useState('Technical Issue')
  const [reportDescription, setReportDescription] = useState('')

  const activeCopy = copy[role]
  const reportMailto = useMemo(() => {
    const subject = encodeURIComponent(`[QuickSpeak Report] ${reportCategory}`)
    const body = encodeURIComponent(`Role: ${role}\nCategory: ${reportCategory}\n\nDescription:\n${reportDescription || '(Please describe the issue.)'}`)
    return `mailto:quicspeaklms@gmail.com?subject=${subject}&body=${body}`
  }, [reportCategory, reportDescription, role])

  return (
    <>
      <footer className="border-t border-slate-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="text-slate-500">© 2026 QuickSpeak English Course</div>
          <nav aria-label="Help and support" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {([
              ['help', 'Bantuan'],
              ['guides', 'Panduan'],
              ['contact', 'Kontak'],
              ['report', 'Report'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSection(key)}
                className="font-semibold text-slate-600 transition hover:text-[#102449] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]"
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </footer>

      {section && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/35 p-4 sm:p-6" role="presentation">
          <button type="button" aria-label="Close" onClick={() => setSection(null)} className="absolute inset-0 h-full w-full cursor-default" />
          <section className="relative mx-auto my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="portal-support-title">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:px-7">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">QuickSpeak Support</p>
                <h2 id="portal-support-title" className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-[#102449]">
                  {section === 'help' ? 'Bantuan' : section === 'guides' ? 'Panduan' : section === 'contact' ? 'Kontak' : 'Report'}
                </h2>
              </div>
              <button type="button" onClick={() => setSection(null)} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">Tutup</button>
            </header>

            <div className="p-6 sm:p-7">
              {section === 'help' && (
                <div className="space-y-3">
                  {activeCopy.help.map(([question, answer]) => (
                    <article key={question} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <h3 className="font-bold text-[#102449]">{question}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-slate-600">{answer}</p>
                    </article>
                  ))}
                </div>
              )}

              {section === 'guides' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {activeCopy.guides.map((guide) => (
                    <article key={guide} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-sm font-bold text-[#102449]">{guide}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Panduan penggunaan QuickSpeak untuk {role}.</p>
                    </article>
                  ))}
                </div>
              )}

              {section === 'contact' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <a href="mailto:quicspeaklms@gmail.com" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                    <MailIcon />
                    Email Admin
                  </a>
                  <a href="https://wa.me/6282138138564?text=Halo%20QuickSpeak%20Admin%2C%20saya%20membutuhkan%20bantuan%20terkait%20portal." target="_blank" rel="noreferrer" aria-label="WhatsApp Admin" className="inline-flex items-center justify-center rounded-lg bg-[#102449] px-4 py-3 text-white transition hover:bg-[#17325f]">
                    <WhatsAppIcon />
                  </a>
                </div>
              )}

              {section === 'report' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="portal-report-category" className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Category</label>
                    <select id="portal-report-category" value={reportCategory} onChange={(event) => setReportCategory(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                      <option>Payment</option>
                      <option>Attendance</option>
                      <option>Learning Progress</option>
                      <option>Login / Account</option>
                      <option>Technical Issue</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="portal-report-description" className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Description</label>
                    <textarea id="portal-report-description" value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} rows={5} placeholder="Jelaskan masalah yang Anda alami..." className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                  </div>
                  <a href={reportMailto} className="inline-flex items-center justify-center rounded-lg bg-[#102449] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#17325f]">Send Report via Email</a>
                  <p className="text-xs leading-5 text-slate-500">Form ini menyiapkan email laporan ke QuickSpeak Admin. Untuk screenshot atau bukti, lampirkan file secara manual pada email sebelum dikirim.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
