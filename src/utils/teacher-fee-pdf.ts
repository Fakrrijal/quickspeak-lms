import { jsPDF } from 'jspdf'
import type { TeacherFeeDetailEntry, TeacherFeeStudentSummary } from '../services/teacher-fee.service'

export type TeacherFeePdfReport = {
  teacherName: string
  teacherCode: string
  period: string
  status: string
  earned: number
  paid: number | null
  outstanding: number | null
  detailEntries: TeacherFeeDetailEntry[]
  studentSummaries: TeacherFeeStudentSummary[]
  totalStudentAttendances: number
  detailReconcilesPeriod: boolean
  settlementNote?: string
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

function detailTableHeader(doc: jsPDF, y: number) {
  doc.setFillColor(241, 245, 249)
  doc.rect(left, y, right - left, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.text('Date', 16, y + 5)
  doc.text('Time', 40, y + 5)
  doc.text('Group / Level', 56, y + 5)
  doc.text('Student / Code', 99, y + 5)
  doc.text('Attendance', 143, y + 5)
  doc.text('Fee', 168, y + 5)
  doc.text('Settlement', 193, y + 5, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  return y + 8
}

function studentTableHeader(doc: jsPDF, y: number) {
  doc.setFillColor(241, 245, 249)
  doc.rect(left, y, right - left, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  ;[['Student', 17], ['Code', 55], ['Teaching Group', 82], ['Present', 128], ['Rate', 150], ['Total', 193]].forEach(([label, x]) => doc.text(String(label), Number(x), y + 4.6, Number(x) > 180 ? { align: 'right' } : undefined))
  doc.setFont('helvetica', 'normal')
  return y + 7
}

function formatSettlementStatus(value: string) {
  return value === 'paid' ? 'Paid' : 'Unpaid'
}

function detailRowHeight(entry: TeacherFeeDetailEntry) {
  const groupLines = docSplit(entry.teaching_group_name + ' / ' + entry.level_name, 38).length
  const studentLines = docSplit(entry.student_name + ' / ' + entry.student_code, 42).length
  return Math.max(8, Math.max(groupLines, studentLines) * 4 + 3)
}

function docSplit(value: string, width: number) {
  return new jsPDF().splitTextToSize(value, width) as string[]
}

function drawDetailRow(doc: jsPDF, entry: TeacherFeeDetailEntry, y: number, rowHeight: number) {
  doc.setDrawColor(226, 232, 240)
  doc.line(left, y + rowHeight, right, y + rowHeight)
  doc.setFontSize(6.5)

  const groupLines = doc.splitTextToSize(entry.teaching_group_name + ' / ' + entry.level_name, 38) as string[]
  const studentLines = doc.splitTextToSize(entry.student_name + ' / ' + entry.student_code, 42) as string[]
  const lineY = y + 4.2

  doc.text(date(entry.session_date), 16, lineY)
  doc.text(time(entry.attendance_recorded_at), 40, lineY)
  doc.text(groupLines, 56, lineY)
  doc.text(studentLines, 99, lineY)
  doc.text(entry.attendance_status === 'present' ? 'Present' : 'Absent', 143, lineY)
  doc.text(amount(entry.student_fee), 168, lineY)
  doc.text(formatSettlementStatus(entry.period_status), 193, lineY, { align: 'right' })
}

function settlementBreakdown(entries: TeacherFeeDetailEntry[]) {
  const periods = new Map<string, 'paid' | 'unpaid'>()
  entries.forEach((entry) => {
    const periodStart = entry.session_date.slice(0, 7) + '-01'
    if (!periods.has(periodStart)) periods.set(periodStart, entry.period_status)
  })
  return {
    total: periods.size,
    paid: [...periods.values()].filter((status) => status === 'paid').length,
    unpaid: [...periods.values()].filter((status) => status === 'unpaid').length,
  }
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

  const settlements = settlementBreakdown(report.detailEntries)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('QUICKSPEAK LMS', left, y)
  doc.setFontSize(11)
  doc.text('TEACHER FEE REPORT', left, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Teacher: ' + report.teacherName + ' (' + report.teacherCode + ')', left, y + 16)
  doc.text('Period: ' + report.period, left, y + 21)
  doc.text('Status Filter: ' + report.status, 120, y + 21)
  doc.text('Generated: ' + generatedAt, left, y + 26)
  y += 34

  y = heading(doc, 'A. FEE SUMMARY', y)
  doc.setFillColor(248, 250, 252)
  doc.rect(left, y, right - left, 25, 'F')
  doc.setFontSize(8)
  doc.text('Total Attendances: ' + report.totalStudentAttendances, left + 4, y + 7)
  doc.text('Total Earned: ' + amount(report.earned), 75, y + 7)
  doc.text('Settlement Periods: ' + settlements.total, 145, y + 7)
  doc.text('Paid: ' + settlements.paid + '   Unpaid: ' + settlements.unpaid, left + 4, y + 14)
  doc.text('Settlement status is shown for each fee record below.', left + 4, y + 21)
  y += 31

  y = heading(doc, 'B. FEE DETAIL', y)
  y = detailTableHeader(doc, y)
  if (report.detailEntries.length === 0) {
    doc.setFontSize(8)
    doc.text('No fee detail available for this teacher and period.', left, y + 5)
    y += 10
  } else {
    report.detailEntries.forEach((entry) => {
      const rowHeight = detailRowHeight(entry)
      if (ensure(rowHeight + 2)) {
        y = heading(doc, 'B. FEE DETAIL (CONTINUED)', y)
        y = detailTableHeader(doc, y)
      }
      drawDetailRow(doc, entry, y, rowHeight)
      y += rowHeight
    })
  }

  if (ensure(22)) y = page(doc)
  y += 4
  y = heading(doc, 'C. STUDENT FEE SUMMARY', y)
  y = studentTableHeader(doc, y)
  report.studentSummaries.forEach((summary) => {
    if (ensure(8)) {
      y = heading(doc, 'C. STUDENT FEE SUMMARY (CONTINUED)', 14)
      y = studentTableHeader(doc, y)
    }
    doc.setDrawColor(226, 232, 240)
    doc.line(left, y + 8, right, y + 8)
    doc.setFontSize(6.5)
    doc.text(doc.splitTextToSize(summary.student_name, 34) as string[], 17, y + 4.7)
    doc.text(summary.student_code, 55, y + 4.7)
    doc.text(doc.splitTextToSize(summary.teaching_group_name, 40) as string[], 82, y + 4.7)
    doc.text(summary.present_attendance_count + ' x', 132, y + 4.7)
    doc.text(amount(summary.fee_rate), 151, y + 4.7)
    doc.text(amount(summary.student_total), 193, y + 4.7, { align: 'right' })
    y += 8
  })

  if (ensure(20)) y = page(doc)
  doc.setFontSize(8)
  const message = report.settlementNote
    ?? (report.detailReconcilesPeriod
      ? '[OK] Fee detail reconciles with the reported total.'
      : '[!] Fee detail requires review against the settlement amount.')
  doc.text(doc.splitTextToSize(message, right - left) as string[], left, y + 4)
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
  if (period === 'All Time') return `teacher-fee-${safeCode}-all-time.pdf`
  if (period.includes(' – ')) {
    const range = period.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
    return `teacher-fee-${safeCode}-${range}.pdf`
  }
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
