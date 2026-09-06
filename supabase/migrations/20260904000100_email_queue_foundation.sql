-- Email Queue Foundation Migration
-- Durable, deduplicated email queue for:
--   - Waiting Students
--   - Waiting Teachers
--   - Payment Verification
--
-- Writes are restricted to trusted server-side processes only. No
-- authenticated user (student, teacher, or admin) may INSERT, UPDATE, or
-- DELETE from this table. Email dispatch will be handled by a future
-- edge function running with the service role.

CREATE TABLE public.email_queue (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      text        NOT NULL CHECK (event_type IN ('WAITING_STUDENTS', 'WAITING_TEACHERS', 'PAYMENT_VERIFICATION')),
    target_id       uuid        NOT NULL,
    recipient_email text        NOT NULL,
    subject         text        NOT NULL,
    payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,
    status          text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
    attempts        integer     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    available_at    timestamptz NOT NULL DEFAULT now(),
    sent_at         timestamptz NULL,
    last_error      text        NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Deduplicating constraint: prevents duplicate emails for the same
-- logical event, target entity, and recipient.
CREATE UNIQUE INDEX email_queue_event_target_recipient_unique
    ON public.email_queue (event_type, target_id, recipient_email);

-- Index for the delivery worker: efficiently fetch rows that are ready
-- to be sent, ordered by availability and creation time.
CREATE INDEX idx_email_queue_pending_delivery
    ON public.email_queue (status, available_at, created_at);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- No authenticated user may write to the email queue.
-- No INSERT / UPDATE / DELETE policies are defined, so RLS denies all
-- write operations by default. Trusted server-side code (SECURITY DEFINER
-- functions or edge functions using the service_role connection) bypasses
-- RLS and is the only path to mutate this table.
REVOKE ALL ON TABLE public.email_queue FROM PUBLIC, anon, authenticated;
