import { useMemo, useState } from 'react'
import type { PortalRole } from '../../layouts/portal/portal-navigation'

type SupportSection = 'help' | 'guides' | 'contact' | 'report'

type PortalFooterProps = {
  role: Extract<PortalRole, 'student' | 'teacher'>
}

type HelpItem = { question: string; answer: string }
type GuideItem = { title: string; steps: string[] }

function WhatsAppIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="size-7" role="img">
      <circle cx="16" cy="16" r="15" fill="#25D366" />
      <path
        d="M11.1 22.7 12.3 19a7.9 7.9 0 1 1 3.2 3.1l-4.4 1.6Zm4.3-4.2c.8.4 1.7.6 2.7.6 2.8 0 5-2.2 5-5s-2.2-5-5-5-5 2.2-5 5c0 1 .3 2 .9 2.8l-.7 2.1 2.1-.5Zm-.4-6.1c.2-.4.4-.5.7-.1l.8.8c.2.2.2.4.1.6l-.4.6c-.1.2-.1.4 0 .6.5.9 1.2 1.6 2.1 2.1.2.1.4.1.6 0l.5-.4c.2-.2.4-.2.6 0l.8.8c.3.3.2.5-.1.7-.3.2-.7.4-1.1.4-.8 0-1.8-.5-2.8-1.3-1-.8-1.8-1.8-2.2-2.7-.3-.6-.2-1.3.4-2.1Z"
        fill="#fff"
      />
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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`size-5 transition-transform ${open ? 'rotate-180' : ''}`}>
      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const copy: Record<Extract<PortalRole, 'student' | 'teacher'>, { help: HelpItem[]; guides: GuideItem[] }> = {
  student: {
    help: [
      { question: 'Bagaimana melihat progress belajar?', answer: 'Buka Dashboard untuk ringkasan progress chapter. Untuk melihat seluruh detail progress dan ebook, buka My Learning.' },
      { question: 'Bagaimana melihat ebook saya?', answer: 'Buka My Learning. Ebook yang tersedia untuk level Anda akan tampil di bagian ebook dan dapat dibuka dari sana.' },
      { question: 'Bagaimana melihat attendance?', answer: 'Buka menu Attendance pada Student Portal untuk melihat catatan kehadiran yang sudah dicatat oleh teacher.' },
      { question: 'Bagaimana upload bukti pembayaran?', answer: 'Buka Payment, lihat pembayaran yang perlu diselesaikan, pilih file bukti pembayaran, lalu klik Submit Payment Proof. Setelah berhasil dikirim, pembayaran menunggu verifikasi admin.' },
      { question: 'Akun saya sudah aktif tetapi ada masalah.', answer: 'Periksa kembali halaman Profile dan fitur yang bermasalah. Bila masalah tetap terjadi, gunakan Kontak untuk menghubungi admin atau Report untuk mengirim laporan.' },
    ],
    guides: [
      { title: 'Dashboard & Learning Progress', steps: ['Login ke Student Portal.', 'Dashboard menampilkan Current Learning Stage, Attendance Summary, dan Learning Progress.', 'Pada Learning Progress, gunakan View chapters untuk membuka daftar chapter. Daftar chapter menggunakan scroll internal agar dashboard tetap ringkas.', 'Gunakan View details untuk membuka halaman My Learning.'] },
      { title: 'My Learning & Ebook', steps: ['Buka My Learning dari sidebar.', 'Bagian Current Learning Stage menampilkan level dan package yang sedang diikuti.', 'Learning Progress menampilkan chapter yang selesai dan yang belum selesai.', 'Ebook yang tersedia untuk level aktif dapat dibuka dengan Open Ebook.'] },
      { title: 'Attendance', steps: ['Buka Attendance dari sidebar.', 'Periksa daftar meeting dan status kehadiran yang sudah dicatat teacher.', 'Gunakan halaman ini sebagai riwayat kehadiran belajar Anda.'] },
      { title: 'Payment & Upload Bukti Pembayaran', steps: ['Buka Payment dari sidebar.', 'Periksa invoice, jumlah pembayaran, periode, dan rekening tujuan.', 'Pilih bukti pembayaran berformat PDF, JPG, JPEG, atau PNG sesuai batas ukuran yang ditampilkan.', 'Klik Submit Payment Proof dan tunggu verifikasi admin.'] },
      { title: 'Profile & Account', steps: ['Buka Profile dari sidebar.', 'Periksa informasi akun dan data profil Anda.', 'Gunakan Kontak atau Report pada footer bila membutuhkan bantuan admin.'] },
    ],
  },
  teacher: {
    help: [
      { question: 'Bagaimana mencatat Learning Progress siswa?', answer: 'Buka Learning Progress, cari dan pilih siswa, pilih level yang sudah diambil, lalu klik Save pada chapter yang selesai. Setelah tersimpan, status berubah menjadi Saved dan tersedia aksi Undo.' },
      { question: 'Bagaimana melihat siswa dalam Teaching Groups?', answer: 'Buka Teaching Groups untuk melihat teaching group yang ditugaskan kepada Anda, level group, serta roster siswa di setiap group.' },
      { question: 'Bagaimana mencatat Attendance?', answer: 'Buka Attendance, pilih teaching group dan periode yang sesuai, lalu catat status kehadiran siswa untuk setiap meeting.' },
      { question: 'Bagaimana melihat Fee?', answer: 'Buka Fee untuk melihat laporan fee teacher berdasarkan aktivitas teaching yang tersedia pada sistem.' },
      { question: 'Bagaimana membuka materi buku?', answer: 'Buka Books untuk melihat ebook yang sudah dipublikasikan. Pilih Open Book untuk membuka ebook terkait level.' },
    ],
    guides: [
      { title: 'Dashboard & Teaching Activity', steps: ['Buka Dashboard pada Teacher Portal.', 'Pilih From Date dan To Date untuk menentukan periode laporan.', 'Dashboard menampilkan Classes, Active Students, Fee (Unpaid), Attendance, dan Period Overview.', 'Gunakan data ini untuk memantau aktivitas teaching pada periode yang dipilih.'] },
      { title: 'Teaching Groups', steps: ['Buka Teaching Groups.', 'Lihat daftar teaching group yang sedang ditugaskan kepada Anda.', 'Periksa level, package, jumlah siswa, dan roster siswa pada setiap group.', 'Gunakan View Attendance untuk masuk ke pencatatan kehadiran group.'] },
      { title: 'Learning Progress', steps: ['Buka Learning Progress.', 'Gunakan pencarian siswa jika jumlah siswa banyak, lalu pilih siswa.', 'Pilih level yang sudah diambil siswa. Level masa depan tetap terkunci.', 'Pada daftar chapter, klik Save untuk chapter yang selesai dipelajari.', 'Setelah tersimpan, status menjadi Saved dan dapat dibatalkan menggunakan Undo.'] },
      { title: 'Books', steps: ['Buka Books.', 'Lihat ebook QuickSpeak yang sudah berstatus published untuk teacher.', 'Pilih Open Book untuk membuka ebook yang menjadi referensi pembelajaran.'] },
      { title: 'Attendance & Fee', steps: ['Buka Attendance untuk memilih group dan mencatat kehadiran setiap meeting.', 'Gunakan riwayat attendance untuk meninjau catatan kehadiran siswa.', 'Buka Fee untuk melihat ringkasan fee sesuai aktivitas teaching yang tersedia.'] },
      { title: 'Profile & Account', steps: ['Buka Profile pada Teacher Portal.', 'Periksa data profil dan informasi akun Anda.', 'Gunakan Kontak atau Report pada footer bila membutuhkan bantuan admin.'] },
    ],
  },
}

export function PortalFooter({ role }: PortalFooterProps) {
  const [section, setSection] = useState<SupportSection | null>(null)
  const [openHelp, setOpenHelp] = useState<number | null>(null)
  const [openGuide, setOpenGuide] = useState<number | null>(null)
  const [reportCategory, setReportCategory] = useState('Technical Issue')
  const [reportDescription, setReportDescription] = useState('')

  const activeCopy = copy[role]
  const reportMailto = useMemo(() => {
    const subject = encodeURIComponent(`[QuickSpeak Report] ${reportCategory}`)
    const body = encodeURIComponent(`Role: ${role}\nCategory: ${reportCategory}\n\nDescription:\n${reportDescription || '(Please describe the issue.)'}`)
    return `mailto:quickspeaklms@gmail.com?subject=${subject}&body=${body}`
  }, [reportCategory, reportDescription, role])

  const openSection = (nextSection: SupportSection) => {
    setSection(nextSection)
    setOpenHelp(null)
    setOpenGuide(null)
  }

  const closeSection = () => {
    setSection(null)
    setOpenHelp(null)
    setOpenGuide(null)
  }

  return (
    <>
      <footer className="border-t border-slate-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="text-slate-500">© 2026 QuickSpeak English Course</div>
          <nav aria-label="Help and support" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {([['help', 'Bantuan'], ['guides', 'Panduan'], ['contact', 'Kontak'], ['report', 'Report']] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => openSection(key)} className="font-semibold text-slate-600 transition hover:text-[#102449] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102449]">{label}</button>
            ))}
          </nav>
        </div>
      </footer>

      {section && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/35 p-4 sm:p-6" role="presentation">
          <button type="button" aria-label="Close" onClick={closeSection} className="absolute inset-0 h-full w-full cursor-default" />
          <section className="relative mx-auto my-8 w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="portal-support-title">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:px-7">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">QuickSpeak Support</p>
                <h2 id="portal-support-title" className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-[#102449]">{section === 'help' ? 'Bantuan' : section === 'guides' ? 'Panduan' : section === 'contact' ? 'Kontak' : 'Report'}</h2>
              </div>
              <button type="button" onClick={closeSection} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">Tutup</button>
            </header>

            <div className="p-6 sm:p-7">
              {section === 'help' && (
                <div className="space-y-2">
                  {activeCopy.help.map((item, index) => {
                    const open = openHelp === index
                    return (
                      <div key={item.question} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <button type="button" onClick={() => setOpenHelp(open ? null : index)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5">
                          <span className="font-bold text-[#102449]">{item.question}</span>
                          <span className="shrink-0 text-slate-500"><Chevron open={open} /></span>
                        </button>
                        {open && <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-4 sm:px-5"><p className="text-sm leading-6 text-slate-600">{item.answer}</p></div>}
                      </div>
                    )
                  })}
                </div>
              )}

              {section === 'guides' && (
                <div className="space-y-2">
                  {activeCopy.guides.map((guide, index) => {
                    const open = openGuide === index
                    return (
                      <div key={guide.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <button type="button" onClick={() => setOpenGuide(open ? null : index)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5">
                          <span className="font-bold text-[#102449]">{guide.title}</span>
                          <span className="shrink-0 text-slate-500"><Chevron open={open} /></span>
                        </button>
                        {open && (
                          <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-4 sm:px-5">
                            <ol className="space-y-3">
                              {guide.steps.map((step, stepIndex) => (
                                <li key={step} className="flex gap-3 text-sm leading-6 text-slate-600"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{stepIndex + 1}</span><span>{step}</span></li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {section === 'contact' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <a href="mailto:quickspeaklms@gmail.com" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><MailIcon />Email Admin</a>
                  <a href="https://wa.me/6282138138564?text=Halo%20QuickSpeak%20Admin%2C%20saya%20membutuhkan%20bantuan%20terkait%20portal." target="_blank" rel="noreferrer" aria-label="WhatsApp Admin" title="WhatsApp Admin — 082138138564" className="inline-flex items-center justify-center rounded-lg border border-[#25D366] bg-white px-4 py-3 transition hover:bg-emerald-50"><WhatsAppIcon /></a>
                </div>
              )}

              {section === 'report' && (
                <div className="space-y-4">
                  <div><label htmlFor="portal-report-category" className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Category</label><select id="portal-report-category" value={reportCategory} onChange={(event) => setReportCategory(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option>Payment</option><option>Attendance</option><option>Learning Progress</option><option>Login / Account</option><option>Technical Issue</option><option>Other</option></select></div>
                  <div><label htmlFor="portal-report-description" className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Description</label><textarea id="portal-report-description" value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} rows={5} placeholder="Jelaskan masalah yang Anda alami..." className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></div>
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
