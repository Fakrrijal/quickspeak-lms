import { supabase } from '../lib/supabase'

export type StudentPaymentEnrollment = {
  id: string
  student_id: string
  package_type: 'private' | 'semi_private'
  price: number
  status: string
}

export type StudentInvoice = {
  id: string
  invoice_number: string
  amount: number
  status: string
}

export type StudentPayment = {
  id: string
  amount: number
  status: string
  rejection_reason: string | null
}

export type StudentPaymentDetails = {
  enrollment: StudentPaymentEnrollment
  invoice: StudentInvoice | null
  payment: StudentPayment | null
}

export type StudentContinuationStatus = {
  enrollment_id: string
  level_id: string
  level_name: string
  level_number: number
  package_type: 'private' | 'semi_private'
  session_limit: number
  valid_present_count: number
  is_completed: boolean
  next_level_id: string | null
  next_level_name: string | null
  next_level_number: number | null
  continuation_available: boolean
}

export type NextLevelEnrollmentRequest = {
  enrollment_id: string
  level_id: string
  package_type: 'private' | 'semi_private'
  price: number
  session_limit: number
  enrollment_status: string
}

export type PaymentProofSubmission = {
  payment_proof_id: string
  payment_status: string
  enrollment_status: string
  uploaded_at: string
}

const maximumProofFileSize = 5242880
const paymentProofBucket = 'payment_proofs'
const acceptedProofTypes = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
} as const

const relevantEnrollmentStatuses = [
  'pending',
  'payment_pending',
  'payment_submitted',
  'payment_rejected',
  'payment_approved',
  'teacher_assignment',
  'active',
]

export async function getCurrentStudentPaymentDetails(): Promise<StudentPaymentDetails | null> {
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('id, student_id, package_type, price, status')
    .in('status', relevantEnrollmentStatuses)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (enrollmentError) {
    throw enrollmentError
  }

  if (!enrollment) {
    return null
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, invoice_number, amount, status')
    .eq('enrollment_id', enrollment.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (invoiceError) {
    throw invoiceError
  }

  if (!invoice) {
    return {
      enrollment: enrollment as StudentPaymentEnrollment,
      invoice: null,
      payment: null,
    }
  }

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id, amount, status, rejection_reason')
    .eq('invoice_id', invoice.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (paymentError) {
    throw paymentError
  }

  return {
    enrollment: enrollment as StudentPaymentEnrollment,
    invoice: invoice as StudentInvoice,
    payment: payment as StudentPayment | null,
  }
}

export async function getMyStudentContinuationStatus(): Promise<StudentContinuationStatus | null> {
  const { data, error } = await supabase.rpc('get_my_student_continuation_status')

  if (error) {
    throw error
  }

  const status = Array.isArray(data) ? data[0] : data
  return (status as StudentContinuationStatus | null) ?? null
}

export async function requestNextLevelEnrollment(
  packageType: 'private' | 'semi_private',
): Promise<NextLevelEnrollmentRequest> {
  const { data, error } = await supabase.rpc('request_next_level_enrollment', {
    p_package_type: packageType,
  })

  if (error) {
    throw error
  }

  const enrollment = Array.isArray(data) ? data[0] : data
  if (!enrollment) {
    throw new Error('Continuation enrollment did not return a result.')
  }

  return enrollment as NextLevelEnrollmentRequest
}

export async function initializeEnrollmentPayment(enrollmentId: string) {
  const { data, error } = await supabase.rpc('initialize_enrollment_payment', {
    p_enrollment_id: enrollmentId,
  })

  if (error) {
    throw error
  }

  const payment = Array.isArray(data) ? data[0] : data
  if (!payment) {
    throw new Error('Payment initialization did not return payment details.')
  }

  return payment
}

function getProofExtension(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (!extension) {
    throw new Error('Payment proof files must include an extension.')
  }

  return extension
}

export function validatePaymentProofFile(file: File) {
  const extension = getProofExtension(file)
  const allowedExtensions = acceptedProofTypes[
    file.type as keyof typeof acceptedProofTypes
  ]

  if (!allowedExtensions || !allowedExtensions.includes(extension as never)) {
    throw new Error('Upload a PDF, JPG, JPEG, or PNG file whose extension matches its file type.')
  }

  if (file.size <= 0 || file.size > maximumProofFileSize) {
    throw new Error('Payment proof files must be between 1 byte and 5 MiB.')
  }

  return extension
}

export async function submitStudentPaymentProof(
  studentId: string,
  paymentId: string,
  file: File,
) {
  const extension = validatePaymentProofFile(file)
  const storagePath = `${studentId}/${paymentId}/${crypto.randomUUID()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(paymentProofBucket)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    throw uploadError
  }

  try {
    const { data, error } = await supabase.rpc('submit_payment_proof', {
      p_payment_id: paymentId,
      p_storage_path: storagePath,
      p_original_filename: file.name,
      p_mime_type: file.type,
      p_file_size: file.size,
    })

    if (error) {
      throw error
    }

    const submission = Array.isArray(data) ? data[0] : data

    if (!submission) {
      throw new Error('Payment proof submission did not return a result.')
    }

    return submission as PaymentProofSubmission
  } catch (error) {
    const { error: cleanupError } = await supabase.storage
      .from(paymentProofBucket)
      .remove([storagePath])

    if (cleanupError) {
      console.error('Unable to clean up payment proof upload:', cleanupError)
    }

    throw error
  }
}
