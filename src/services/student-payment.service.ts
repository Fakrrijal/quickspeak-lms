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
  created_at: string
}

export type StudentPayment = {
  id: string
  amount: number
  status: string
  payment_method: string | null
  rejection_reason: string | null
  created_at: string
}

export type StudentPaymentDetails = {
  enrollment: StudentPaymentEnrollment
  invoice: StudentInvoice | null
  payment: StudentPayment | null
}

export type StudentPaymentHistoryItem = {
  id: string
  invoice_id: string
  invoice_number: string
  invoice_amount: number
  invoice_status: string
  amount: number
  status: string
  payment_method: string | null
  rejection_reason: string | null
  created_at: string
  period: string
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

export type PaymentRetryResult = {
  enrollment_id: string
  invoice_id: string
  invoice_number: string
  invoice_amount: number
  invoice_status: string
  payment_id: string
  payment_amount: number
  payment_status: string
}

const maximumProofFileSize = 5242880
const maximumSourceImageSize = 26214400
const paymentProofBucket = 'payment_proofs'
const acceptedProofExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'] as const

const relevantEnrollmentStatuses = [
  'pending',
  'payment_pending',
  'payment_submitted',
  'payment_rejected',
  'payment_approved',
  'teacher_assignment',
  'active',
]

function formatPeriod(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

export async function getCurrentStudentPaymentDetails(): Promise<StudentPaymentDetails | null> {
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('id, student_id, package_type, price, status')
    .in('status', relevantEnrollmentStatuses)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (enrollmentError) throw enrollmentError
  if (!enrollment) return null

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, invoice_number, amount, status, created_at')
    .eq('enrollment_id', enrollment.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (invoiceError) throw invoiceError
  if (!invoice) return { enrollment: enrollment as StudentPaymentEnrollment, invoice: null, payment: null }

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id, amount, status, payment_method, rejection_reason, created_at')
    .eq('invoice_id', invoice.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (paymentError) throw paymentError

  return {
    enrollment: enrollment as StudentPaymentEnrollment,
    invoice: invoice as StudentInvoice,
    payment: payment as StudentPayment | null,
  }
}

export async function getStudentPaymentHistory(enrollmentId: string): Promise<StudentPaymentHistoryItem[]> {
  const { data: invoices, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, invoice_number, amount, status, created_at')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false })

  if (invoiceError) throw invoiceError
  if (!invoices || invoices.length === 0) return []

  const invoiceIds = invoices.map((invoice) => invoice.id)
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]))

  const { data: payments, error: paymentError } = await supabase
    .from('payments')
    .select('id, invoice_id, amount, status, payment_method, rejection_reason, created_at')
    .in('invoice_id', invoiceIds)
    .order('created_at', { ascending: false })

  if (paymentError) throw paymentError

  return (payments ?? []).flatMap((payment) => {
    const invoice = invoiceById.get(payment.invoice_id)
    if (!invoice) return []

    return [{
      id: payment.id,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      invoice_amount: invoice.amount,
      invoice_status: invoice.status,
      amount: payment.amount,
      status: payment.status,
      payment_method: payment.payment_method,
      rejection_reason: payment.rejection_reason,
      created_at: payment.created_at,
      period: formatPeriod(invoice.created_at),
    }]
  })
}

export async function getMyStudentContinuationStatus(): Promise<StudentContinuationStatus | null> {
  const { data, error } = await supabase.rpc('get_my_student_continuation_status')
  if (error) throw error
  const status = Array.isArray(data) ? data[0] : data
  return (status as StudentContinuationStatus | null) ?? null
}

export async function requestNextLevelEnrollment(packageType: 'private' | 'semi_private'): Promise<NextLevelEnrollmentRequest> {
  const { data, error } = await supabase.rpc('request_next_level_enrollment', { p_package_type: packageType })
  if (error) throw error
  const enrollment = Array.isArray(data) ? data[0] : data
  if (!enrollment) throw new Error('Continuation enrollment did not return a result.')
  return enrollment as NextLevelEnrollmentRequest
}

export async function initializeEnrollmentPayment(enrollmentId: string) {
  const { data, error } = await supabase.rpc('initialize_enrollment_payment', { p_enrollment_id: enrollmentId })
  if (error) throw error
  const payment = Array.isArray(data) ? data[0] : data
  if (!payment) throw new Error('Payment initialization did not return payment details.')
  return payment
}

export async function retryStudentPayment(enrollmentId: string): Promise<PaymentRetryResult> {
  const { data, error } = await supabase.rpc('retry_student_payment', { p_enrollment_id: enrollmentId })
  if (error) throw error
  const payment = Array.isArray(data) ? data[0] : data
  if (!payment) throw new Error('Payment retry did not return a new payment attempt.')
  return payment as PaymentRetryResult
}

function getProofExtension(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension) throw new Error('Payment proof files must include an extension.')
  if (!acceptedProofExtensions.includes(extension as (typeof acceptedProofExtensions)[number])) {
    throw new Error('Upload a PDF or image file (JPG, PNG, WEBP, HEIC, or HEIF).')
  }
  return extension
}

function getProofMimeType(file: File, extension: string) {
  const suppliedType = file.type.toLowerCase()

  if (suppliedType === 'application/pdf' && extension === 'pdf') return 'application/pdf'
  if (suppliedType === 'image/jpeg' && ['jpg', 'jpeg'].includes(extension)) return 'image/jpeg'
  if (suppliedType === 'image/png' && extension === 'png') return 'image/png'
  if (suppliedType === 'image/webp' && extension === 'webp') return 'image/webp'
  if (suppliedType === 'image/heic' && extension === 'heic') return 'image/heic'
  if (suppliedType === 'image/heif' && extension === 'heif') return 'image/heif'
  if (suppliedType === 'image/jpg' && ['jpg', 'jpeg'].includes(extension)) return 'image/jpeg'

  if (!suppliedType) {
    if (extension === 'pdf') return 'application/pdf'
    if (['jpg', 'jpeg'].includes(extension)) return 'image/jpeg'
    if (extension === 'png') return 'image/png'
    if (extension === 'webp') return 'image/webp'
    if (extension === 'heic') return 'image/heic'
    if (extension === 'heif') return 'image/heif'
  }

  if (suppliedType.startsWith('image/') && acceptedProofExtensions.includes(extension as (typeof acceptedProofExtensions)[number])) {
    return suppliedType
  }

  throw new Error('Upload a PDF or image file (JPG, PNG, WEBP, HEIC, or HEIF).')
}

export function validatePaymentProofFile(file: File) {
  const extension = getProofExtension(file)
  const mimeType = getProofMimeType(file, extension)

  if (file.size <= 0 || file.size > (mimeType === 'application/pdf' ? maximumProofFileSize : maximumSourceImageSize)) {
    throw new Error(mimeType === 'application/pdf'
      ? 'PDF payment proof files must be between 1 byte and 5 MiB.'
      : 'Image payment proof files must be between 1 byte and 25 MiB. Large photos are compressed automatically before upload.')
  }

  return extension
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('This image format cannot be processed by this browser. Please choose a JPG or PNG image.'))
    }
    image.src = objectUrl
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('The selected image could not be prepared for upload.'))
        return
      }
      resolve(blob)
    }, 'image/jpeg', quality)
  })
}

async function compressImageForUpload(file: File): Promise<File> {
  const image = await loadImage(file)
  const maxDimension = 2400
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not prepare the image for upload.')

  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  let quality = 0.82
  let blob = await canvasToBlob(canvas, quality)

  while (blob.size > maximumProofFileSize && quality > 0.5) {
    quality -= 0.08
    blob = await canvasToBlob(canvas, quality)
  }

  if (blob.size > maximumProofFileSize) {
    throw new Error('This photo is still larger than 5 MiB after compression. Please choose a smaller photo.')
  }

  return new File([blob], `payment-proof-${crypto.randomUUID()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}

async function preparePaymentProofFile(file: File) {
  const extension = validatePaymentProofFile(file)
  const mimeType = getProofMimeType(file, extension)

  if (mimeType === 'application/pdf') return { file, extension: 'pdf', mimeType }

  const compressedFile = await compressImageForUpload(file)
  return { file: compressedFile, extension: 'jpg', mimeType: 'image/jpeg' }
}

export async function submitStudentPaymentProof(studentId: string, paymentId: string, file: File) {
  const prepared = await preparePaymentProofFile(file)
  const storagePath = `${studentId}/${paymentId}/${crypto.randomUUID()}.${prepared.extension}`

  const { error: uploadError } = await supabase.storage.from(paymentProofBucket).upload(storagePath, prepared.file, {
    contentType: prepared.mimeType,
    upsert: false,
  })

  if (uploadError) throw uploadError

  try {
    const { data, error } = await supabase.rpc('submit_payment_proof', {
      p_payment_id: paymentId,
      p_storage_path: storagePath,
      p_original_filename: file.name,
      p_mime_type: prepared.mimeType,
      p_file_size: prepared.file.size,
    })

    if (error) throw error
    const submission = Array.isArray(data) ? data[0] : data
    if (!submission) throw new Error('Payment proof submission did not return a result.')
    return submission as PaymentProofSubmission
  } catch (error) {
    const { error: cleanupError } = await supabase.storage.from(paymentProofBucket).remove([storagePath])
    if (cleanupError) console.error('Unable to clean up payment proof upload:', cleanupError)
    throw error
  }
}
