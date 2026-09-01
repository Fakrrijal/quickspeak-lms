-- S2.10 Payment Foundation Migration
-- QuickSpeak LMS Database Schema
-- Creates payment tables, storage bucket, and RLS policies

-- Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    enrollment_id UUID NOT NULL
        REFERENCES public.enrollments(id)
        ON DELETE RESTRICT,
    
    invoice_number TEXT NOT NULL UNIQUE,
    
    amount INTEGER NOT NULL
        CHECK (amount > 0),
    
    status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK (status IN ('unpaid', 'partial', 'paid', 'cancelled')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_enrollment_id
    ON public.invoices(enrollment_id);

CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number
    ON public.invoices(invoice_number);

CREATE INDEX IF NOT EXISTS idx_invoices_status
    ON public.invoices(status);

-- Create updated_at trigger for invoices
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'invoices_updated_at'
          AND tgrelid = 'public.invoices'::regclass
    ) THEN
        CREATE TRIGGER invoices_updated_at
            BEFORE UPDATE ON public.invoices
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END;
$$;

-- Enable RLS on invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
-- Students can read invoices for their own enrollments
CREATE POLICY "Students can view own enrollment invoices"
    ON public.invoices FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.students
            WHERE students.profile_id = auth.uid()
              AND students.id = (
                  SELECT student_id
                  FROM public.enrollments
                  WHERE enrollments.id = invoices.enrollment_id
              )
        )
    );

-- Admins can read all invoices
CREATE POLICY "Admins can view all invoices"
    ON public.invoices FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    invoice_id UUID NOT NULL
        REFERENCES public.invoices(id)
        ON DELETE RESTRICT,
    
    amount INTEGER NOT NULL
        CHECK (amount > 0),
    
    status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK (status IN ('unpaid', 'proof_submitted', 'approved', 'rejected')),
    
    verified_by UUID NULL
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,
    
    verified_at TIMESTAMPTZ NULL,
    
    rejection_reason TEXT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id
    ON public.payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
    ON public.payments(status);

CREATE INDEX IF NOT EXISTS idx_payments_verified_by
    ON public.payments(verified_by);

-- Create updated_at trigger for payments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'payments_updated_at'
          AND tgrelid = 'public.payments'::regclass
    ) THEN
        CREATE TRIGGER payments_updated_at
            BEFORE UPDATE ON public.payments
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END;
$$;

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payments
-- Students can read payments for their own enrollment invoices
CREATE POLICY "Students can view own enrollment payments"
    ON public.payments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.students AS students
            JOIN public.enrollments AS enrollments
                ON enrollments.student_id = students.id
            JOIN public.invoices AS invoices
                ON invoices.enrollment_id = enrollments.id
            WHERE students.profile_id = auth.uid()
              AND invoices.id = payments.invoice_id
        )
    );

-- Admins can read all payments
CREATE POLICY "Admins can view all payments"
    ON public.payments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );

-- Create payment_proofs table
CREATE TABLE IF NOT EXISTS public.payment_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    payment_id UUID NOT NULL
        REFERENCES public.payments(id)
        ON DELETE CASCADE,
    
    storage_path TEXT NOT NULL,
    -- Storage path format: {student_id}/{payment_id}/{filename}
    -- This path convention enables RLS ownership validation in storage.objects policies
    
    original_filename TEXT NULL,
    
    mime_type TEXT NULL,
    
    file_size INTEGER NULL
        CHECK (file_size IS NULL OR file_size > 0),
    
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for payment_proofs
CREATE INDEX IF NOT EXISTS idx_payment_proofs_payment_id
    ON public.payment_proofs(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_proofs_storage_path
    ON public.payment_proofs(storage_path);

-- Enable RLS on payment_proofs
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_proofs
-- Students can read payment proofs for their own enrollment payments
CREATE POLICY "Students can view own payment proofs"
    ON public.payment_proofs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.students AS students
            JOIN public.enrollments AS enrollments
                ON enrollments.student_id = students.id
            JOIN public.invoices AS invoices
                ON invoices.enrollment_id = enrollments.id
            JOIN public.payments AS payments
                ON payments.invoice_id = invoices.id
            WHERE students.profile_id = auth.uid()
              AND payments.id = payment_proofs.payment_id
        )
    );

-- Students can insert payment proofs for their own enrollment payments
CREATE POLICY "Students can insert own payment proofs"
    ON public.payment_proofs FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.students AS students
            JOIN public.enrollments AS enrollments
                ON enrollments.student_id = students.id
            JOIN public.invoices AS invoices
                ON invoices.enrollment_id = enrollments.id
            JOIN public.payments AS payments
                ON payments.invoice_id = invoices.id
            WHERE students.profile_id = auth.uid()
              AND payments.id = payment_proofs.payment_id
        )
    );

-- Admins can read all payment proofs
CREATE POLICY "Admins can view all payment proofs"
    ON public.payment_proofs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );

-- Create private storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment_proofs', 'payment_proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for payment_proofs bucket
-- storage.objects.name / payment_proofs.storage_path convention:
-- {student_id}/{payment_id}/{filename}. The bucket id is not part of name.
-- This allows the storage policy to validate both the path and payment ownership.

-- Students can upload only to their own student_id directories
CREATE POLICY "Students can upload own payment proofs"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'payment_proofs'
        AND SPLIT_PART(name, '/', 1) <> ''
        AND SPLIT_PART(name, '/', 2) <> ''
        AND SPLIT_PART(name, '/', 3) <> ''
        AND SPLIT_PART(name, '/', 4) = ''
        AND EXISTS (
            SELECT 1
            FROM public.students AS students
            JOIN public.enrollments AS enrollments
                ON enrollments.student_id = students.id
            JOIN public.invoices AS invoices
                ON invoices.enrollment_id = enrollments.id
            JOIN public.payments AS payments
                ON payments.invoice_id = invoices.id
            WHERE students.profile_id = auth.uid()
              AND students.id::text = SPLIT_PART(name, '/', 1)
              AND payments.id::text = SPLIT_PART(name, '/', 2)
        )
    );

-- Students can read only their own payment proofs
CREATE POLICY "Students can read own payment proofs"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'payment_proofs'
        AND EXISTS (
            SELECT 1
            FROM public.payment_proofs AS payment_proofs
            JOIN public.payments AS payments
                ON payments.id = payment_proofs.payment_id
            JOIN public.invoices AS invoices
                ON invoices.id = payments.invoice_id
            JOIN public.enrollments AS enrollments
                ON enrollments.id = invoices.enrollment_id
            JOIN public.students AS students
                ON students.id = enrollments.student_id
            WHERE students.profile_id = auth.uid()
              AND payment_proofs.storage_path = name
              AND students.id::text = SPLIT_PART(name, '/', 1)
              AND payments.id::text = SPLIT_PART(name, '/', 2)
              AND SPLIT_PART(name, '/', 3) <> ''
              AND SPLIT_PART(name, '/', 4) = ''
        )
    );

-- Admins can read all payment proofs
CREATE POLICY "Admins can read all payment proofs"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'payment_proofs'
        AND EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );

-- Grant necessary permissions
GRANT SELECT ON public.invoices TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT, INSERT ON public.payment_proofs TO authenticated;
