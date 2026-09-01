import { jsPDF } from 'jspdf'
import type { TeacherFeeDetailEntry, TeacherFeeStudentSummary } from '../services/teacher-fee.service'

export type TeacherFeePdfReport = {
  teacherName: string
  teacherCode: string
  period: string
  status: string
  earned: number
  paid: number
  outstanding: number
  detailEntries: TeacherFeeDetailEntry[]
  studentSummaries: TeacherFeeStudentSummary[]
  totalStudentAttendances: number
  detailReconcilesPeriod: boolean
}

export type TeacherFeePdfArchive = {
  reports: TeacherFeePdfReport[]
  generatedAt: string
  filename: string
}

const left = 14
const right = 196

function amount(value: number) {
  return `Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)}`
}

function date(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

function time(value: string) {
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

function packageType(value: TeacherFeeDetailEntry['package_type']) {
  return value === 'semi_private' ? 'Semi-private' : 'Private'
}

function heading(doc: jsPDF, title: string, y: number) {
  doc.setFillColor(15, 23, 42)
  doc.rect(left, y, right - left, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(title, left + 3, y + 5.3)
  doc.setTextColor(0, 0, 0)
  return y + 12
}

function studentTableHeader(doc: jsPDF, y: number) {
  doc.setFillColor(241, 245, 249)
  doc.rect(left, y, right - left, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('Student', 17, y + 4.6)
  doc.text('Code', 77, y + 4.6)
  doc.text('Status', 112, y + 4.6)
  doc.text('Fee', 193, y + 4.6, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  return y + 7
}

function summaryTableHeader(doc: jsPDF, y: number) {
  doc.setFillColor(241, 245, 249)
  doc.rect(left, y, right - left, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  ;[['Student', 17], ['Code', 52], ['Teaching Group', 75], ['Present', 119], ['Fee / attendance', 140], ['Total fee', 193]].forEach(([label, x]) => doc.text(String(label), Number(x), y + 4.6, Number(x) > 180 ? { align: 'right' } : undefined))
  doc.setFont('helvetica', 'normal')
  return y + 7
}

function groupedMeetings(entries: TeacherFeeDetailEntry[]) {
  const groups = new Map<string, TeacherFeeDetailEntry[]>()
  entries.forEach((entry) => groups.set(entry.meeting_id, [...(groups.get(entry.meeting_id) ?? []), entry]))
  return [...groups.values()]
    .map((meeting) => meeting.sort((a, b) => a.attendance_recorded_at.localeCompare(b.attendance_recorded_at)))
    .sort((a, b) => a[0].session_date.localeCompare(b[0].session_date) || a[0].attendance_recorded_at.localeCompare(b[0].attendance_recorded_at))
}

function page(doc: jsPDF) {
  doc.addPage()
  return 14
}

function drawReport(doc: jsPDF, report: TeacherFeePdfReport, generatedAt: string, startOnNewPage: boolean) {
  const bottom = 280
  let y = startOnNewPage ? page(doc) : 14
  const ensure = (height: number) => {
    if (y + height <= bottom) return false
    y = page(doc)
    return true
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('QUICKSPEAK LMS', left, y)
  doc.setFontSize(12)
  doc.text('TEACHER FEE REPORT', left, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Teacher: ${report.teacherName}`, left, y + 17)
  doc.text(`Teacher Code: ${report.teacherCode}`, left, y + 22)
  doc.text(`Period: ${report.period}`, 110, y + 17)
  doc.text(`Status: ${report.status.toUpperCase()}`, 110, y + 22)
  doc.text(`Generated: ${generatedAt}`, left, y + 27)
  y += 35

  y = heading(doc, 'A. MEETING & ATTENDANCE DETAIL', y)
  const meetings = groupedMeetings(report.detailEntries)
  if (meetings.length === 0) {
    doc.setFontSize(9)
    doc.text('No fee detail available for this teacher and period.', left, y)
    y += 8
  }

  meetings.forEach((entries) => {
    const meeting = entries[0]
    const headerHeight = 20
    const firstRowHeight = 7
    if (ensure(headerHeight + firstRowHeight)) y = heading(doc, 'A. MEETING & ATTENDANCE DETAIL (CONTINUED)', y)
    doc.setFillColor(248, 250, 252)
    doc.rect(left, y, right - left, headerHeight, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(`${date(meeting.session_date)} - ${time(meeting.attendance_recorded_at)}`, left + 3, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(`Teaching Group: ${meeting.teaching_group_name}`, left + 3, y + 10)
    doc.text(`Package: ${packageType(meeting.package_type)}`, 90, y + 10)
    doc.text(`Level: ${meeting.level_name}`, left + 3, y + 15)
    y = studentTableHeader(doc, y + headerHeight)
    entries.forEach((entry) => {
      if (ensure(7)) y = studentTableHeader(doc, 14)
      doc.setDrawColor(226, 232, 240)
      doc.line(left, y + 7, right, y + 7)
      doc.setFontSize(7)
      doc.text(doc.splitTextToSize(entry.student_name, 56) as string[], 17, y + 4.5)
      doc.text(entry.student_code, 77, y + 4.5)
      doc.text(entry.attendance_status === 'present' ? 'Present' : 'Absent', 112, y + 4.5)
      doc.text(amount(entry.student_fee), 193, y + 4.5, { align: 'right' })
      y += 7
    })
    if (ensure(8)) y = 14
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(`Meeting Fee: ${amount(meeting.meeting_fee)}`, 193, y + 5, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    y += 10
  })

  if (ensure(26)) y = page(doc)
  y = heading(doc, 'B. STUDENT FEE SUMMARY', y)
  y = summaryTableHeader(doc, y)
  report.studentSummaries.forEach((summary) => {
    if (ensure(8)) { y = heading(doc, 'B. STUDENT FEE SUMMARY (CONTINUED)', 14); y = summaryTableHeader(doc, y) }
    doc.setDrawColor(226, 232, 240)
    doc.line(left, y + 8, right, y + 8)
    doc.setFontSize(6.5)
    doc.text(doc.splitTextToSize(summary.student_name, 32) as string[], 17, y + 4.7)
    doc.text(summary.student_code, 52, y + 4.7)
    doc.text(doc.splitTextToSize(summary.teaching_group_name, 40) as string[], 75, y + 4.7)
    doc.text(`${summary.present_attendance_count} x`, 122, y + 4.7)
    doc.text(amount(summary.fee_rate), 140, y + 4.7)
    doc.text(amount(summary.student_total), 193, y + 4.7, { align: 'right' })
    y += 8
  })

  if (ensure(45)) y = page(doc)
  y = heading(doc, 'C. TEACHER FEE SUMMARY', y)
  doc.setFillColor(248, 250, 252)
  doc.rect(left, y, right - left, 30, 'F')
  doc.setFontSize(8)
  doc.text(`Total Student Attendances: ${report.totalStudentAttendances}`, left + 4, y + 7)
  doc.text(`Earned: ${amount(report.earned)}`, left + 4, y + 13)
  doc.text(`Paid: ${amount(report.paid)}`, 80, y + 13)
  doc.text(`Outstanding: ${amount(report.outstanding)}`, 135, y + 13)
  doc.text(`Status: ${report.status.toUpperCase()}`, left + 4, y + 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`TOTAL TEACHER FEE  ${amount(report.earned)}`, left + 4, y + 27)
  doc.setFont('helvetica', 'normal')
  y += 35
  doc.setFontSize(8)
  const message = report.detailReconcilesPeriod
    ? '[OK] Detail reconciles with Teacher Fee total.'
    : report.status === 'paid'
      ? '[!] Historical detail does not currently reconcile with the frozen settlement amount.'
      : '[!] Detail does not currently reconcile with the Teacher Fee total.'
  doc.text(doc.splitTextToSize(message, right - left) as string[], left, y)
}

function addFooter(doc: jsPDF, generatedAt: string) {
  const pages = doc.getNumberOfPages()
  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    doc.setPage(pageNumber)
    doc.setDrawColor(226, 232, 240)
    doc.line(left, 286, right, 286)
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(`QuickSpeak LMS - Teacher Fee Report - Generated ${generatedAt}`, left, 290)
    doc.text(`Page ${pageNumber} of ${pages}`, right, 290, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }
}

function safeFilename(teacherCode: string, period: string) {
  const safeCode = teacherCode.replace(/[^a-zA-Z0-9_-]/g, '') || 'teacher'
  const [, year] = period.split(' ')
  const monthName = period.split(' ')[0]
  const month = new Date(`${monthName} 1, ${year}`).getMonth() + 1
  return `teacher-fee-${safeCode}-${year ?? 'report'}-${Number.isNaN(month) ? '00' : String(month).padStart(2, '0')}.pdf`
}

export function downloadTeacherFeePdf(report: TeacherFeePdfReport, generatedAt: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  drawReport(doc, report, generatedAt, false)
  addFooter(doc, generatedAt)
  doc.save(safeFilename(report.teacherCode, report.period))
}

export function downloadAdminTeacherFeePdf({ reports, generatedAt, filename }: TeacherFeePdfArchive) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  reports.forEach((report, index) => drawReport(doc, report, generatedAt, index > 0))
  addFooter(doc, generatedAt)
  doc.save(filename)
}
