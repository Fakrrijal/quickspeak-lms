import { supabase } from '../lib/supabase'

export type PendingPaymentVerification = {
  payment_id: string
  student_name: string
  student_email: string
  invoice_number: string
  package_type: string
  amount: number
  proof_uploaded_at: string
  proof_storage_path: string
  proof_original_filename: string | null
  proof_mime_type: string | null
  proof_file_size: number | null
  payment_status: string
  enrollment_status: string
}

export type PaymentReviewDecision = 'approve' | 'reject'

type ReviewPaymentResult = {
  payment_id: string
  payment_status: string
  invoice_id: string
  invoice_status: string
  enrollment_id: string
  enrollment_status: string
  verified_by: string
  verified_at: string
}

function firstRelated<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function getPendingPaymentVerifications(): Promise<PendingPaymentVerification[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(
      'id, amount, status, invoices!inner (invoice_number, enrollments!inner (package_type, status, students!inner (profiles!inner (full_name, email)))), payment_proofs!inner (uploaded_at, storage_path, original_filename, mime_type, file_size)',
    )
    .eq('status', 'proof_submitted')

  if (error) {
    throw error
  }

  return (data ?? []).flatMap((payment) => {
    const invoice = firstRelated(payment.invoices)
    const enrollment = firstRelated(invoice?.enrollments ?? null)
    const student = firstRelated(enrollment?.students ?? null)
    const profile = firstRelated(student?.profiles ?? null)

    if (!invoice || !enrollment || !profile) {
      return []
    }

    return (payment.payment_proofs ?? [])
      .slice()
      .sort((left, right) => right.uploaded_at.localeCompare(left.uploaded_at))
      .slice(0, 1)
      .map((proof) => ({
        payment_id: payment.id,
        student_name: profile.full_name,
        student_email: profile.email,
        invoice_number: invoice.invoice_number,
        package_type: enrollment.package_type,
        amount: payment.amount,
        proof_uploaded_at: proof.uploaded_at,
        proof_storage_path: proof.storage_path,
        proof_original_filename: proof.original_filename,
        proof_mime_type: proof.mime_type,
        proof_file_size: proof.file_size,
        payment_status: payment.status,
        enrollment_status: enrollment.status,
      }))
  }) as PendingPaymentVerification[]
}

export async function createPaymentProofReviewUrl(storagePath: string) {
  const { data, error } = await supabase.storage
    .from('payment_proofs')
    .createSignedUrl(storagePath, 60)

  if (error) {
    throw error
  }

  return data.signedUrl
}

export async function reviewPayment(
  paymentId: string,
  decision: PaymentReviewDecision,
  rejectionReason?: string,
) {
  const { data, error } = await supabase.rpc('admin_review_payment', {
    p_payment_id: paymentId,
    p_decision: decision,
    p_rejection_reason: rejectionReason ?? null,
  })

  if (error) {
    throw error
  }

  const result = Array.isArray(data) ? data[0] : data

  if (!result) {
    throw new Error('Payment review did not return a result.')
  }

  return result as ReviewPaymentResult
}
