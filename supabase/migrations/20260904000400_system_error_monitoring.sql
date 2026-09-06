-- System Error Monitoring Foundation
-- Adds the system_error_events table and extends email_queue event types
-- to support SYSTEM_ERROR without altering any existing data or RLS/policies.

-- Extend email_queue event_type to include SYSTEM_ERROR
ALTER TABLE public.email_queue
    DROP CONSTRAINT IF EXISTS email_queue_event_type_check;

ALTER TABLE public.email_queue
    ADD CONSTRAINT email_queue_event_type_check
        CHECK (event_type IN (
            'WAITING_STUDENTS',
            'WAITING_TEACHERS',
            'PAYMENT_VERIFICATION',
            'SYSTEM_ERROR'
        ));

-- System error events table
CREATE TABLE public.system_error_events (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint      text        NOT NULL,
    feature          text        NOT NULL,
    action           text        NOT NULL,
    message          text        NOT NULL,
    path             text        NULL,
    user_id          uuid        NULL,
    metadata         jsonb       NOT NULL DEFAULT '{}'::jsonb,
    first_seen_at    timestamptz NOT NULL DEFAULT now(),
    last_seen_at     timestamptz NOT NULL DEFAULT now(),
    occurrence_count integer     NOT NULL DEFAULT 1,
    status           text        NOT NULL DEFAULT 'open',
    created_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT system_error_events_status_check CHECK (status IN ('open', 'resolved'))
);

ALTER TABLE public.system_error_events
    ADD CONSTRAINT system_error_events_fingerprint_key UNIQUE (fingerprint);

ALTER TABLE public.system_error_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_system_error_events_fingerprint_last_seen
    ON public.system_error_events (fingerprint, last_seen_at DESC);

CREATE INDEX idx_system_error_events_status_last_seen
    ON public.system_error_events (status, last_seen_at DESC);

CREATE INDEX idx_system_error_events_feature_last_seen
    ON public.system_error_events (feature, last_seen_at DESC);
