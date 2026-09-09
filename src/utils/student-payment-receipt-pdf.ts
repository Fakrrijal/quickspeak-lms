import { jsPDF } from 'jspdf'
import type { StudentPaymentHistoryItem } from '../services/student-payment.service'

export type StudentPaymentReceipt = StudentPaymentHistoryItem & {
  studentName: string
  studentEmail: string
  packageLabel: string
}

const left = 14
const right = 196

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function formatPaymentMethod(value: string | null) {
  if (!value) return 'Not recorded'
  return value === 'bank_transfer'
    ? 'Bank Transfer'
    : value.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function formatStatus(value: string) {
  return value.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function row(doc: jsPDF, label: string, value: string, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(label, left + 4, y)
  doc.setFont('helvetica', 'normal')
  doc.text(value, 70, y)
  doc.setDrawColor(226, 232, 240)
  doc.line(left + 4, y + 3, right - 4, y + 3)
  return y + 10
}

export function downloadStudentPaymentReceiptPdf(receipt: StudentPaymentReceipt) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text('QUICKSPEAK LMS', left, 17)
  doc.setFontSize(12)
  doc.text('PAYMENT RECEIPT', left, 25)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('Official student payment record', left, 31)
  doc.setTextColor(0, 0, 0)

  doc.setFillColor(248, 250, 252)
  doc.rect(left, 38, right - left, 17, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Student', left + 4, 45)
  doc.text('Email', 105, 45)
  doc.setFont('helvetica', 'normal')
  doc.text(doc.splitTextToSize(receipt.studentName, 75) as string[], left + 4, 50)
  doc.text(doc.splitTextToSize(receipt.studentEmail, 80) as string[], 105, 50)

  let y = 66
  doc.setFillColor(15, 23, 42)
  doc.rect(left, y, right - left, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PAYMENT DETAILS', left + 3, y + 5.3)
  doc.setTextColor(0, 0, 0)
  y += 15

  y = row(doc, 'Invoice Number', receipt.invoice_number, y)
  y = row(doc, 'Payment Date', formatDate(receipt.created_at), y)
  y = row(doc, 'Period', receipt.period, y)
  y = row(doc, 'Package', receipt.packageLabel, y)
  y = row(doc, 'Amount', `Rp${receipt.amount.toLocaleString('id-ID')}`, y)
  y = row(doc, 'Payment Method', formatPaymentMethod(receipt.payment_method), y)
  y = row(doc, 'Payment Status', formatStatus(receipt.status), y)
  y = row(doc, 'Invoice Status', formatStatus(receipt.invoice_status), y)

  if (receipt.rejection_reason) {
    y += 2
    doc.setFillColor(254, 242, 242)
    doc.rect(left, y, right - left, 18, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(153, 27, 27)
    doc.text('Rejection Reason', left + 4, y + 6)
    doc.setFont('helvetica', 'normal')
    doc.text(doc.splitTextToSize(receipt.rejection_reason, right - left - 8) as string[], left + 4, y + 12)
    doc.setTextColor(0, 0, 0)
  }

  doc.setDrawColor(226, 232, 240)
  doc.line(left, 276, right, 276)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text('QuickSpeak LMS - Payment Receipt', left, 281)
  doc.text('Page 1 of 1', right, 281, { align: 'right' })
  doc.setTextColor(0, 0, 0)

  doc.save(`QuickSpeak-Payment-Receipt-${receipt.invoice_number}.pdf`)
}
