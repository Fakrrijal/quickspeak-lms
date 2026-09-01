import { supabase } from '../lib/supabase'

export type PaymentRecord = {
  payment_id: string
  student_name: string
  student_email: string
  invoice_number: string
  package_type: string
  amount: number
  payment_status: string
  invoice_status: string
  created_at: string
  verified_at: string | null
  rejection_reason: string | null
}

function firstRelated<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function getPaymentRecords(): Promise<PaymentRecord[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('id, amount, status, created_at, verified_at, rejection_reason, invoices!inner (invoice_number, status, enrollments!inner (package_type, students!inner (profiles!inner (full_name, email))))')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).flatMap((payment) => {
    const invoice = firstRelated(payment.invoices)
    const enrollment = firstRelated(invoice?.enrollments ?? null)
    const student = firstRelated(enrollment?.students ?? null)
    const profile = firstRelated(student?.profiles ?? null)

    if (!invoice || !enrollment || !profile) return []

    return [{
      payment_id: payment.id,
      student_name: profile.full_name,
      student_email: profile.email,
      invoice_number: invoice.invoice_number,
      package_type: enrollment.package_type,
      amount: payment.amount,
      payment_status: payment.status,
      invoice_status: invoice.status,
      created_at: payment.created_at,
      verified_at: payment.verified_at,
      rejection_reason: payment.rejection_reason,
    }]
  }) as PaymentRecord[]
}
