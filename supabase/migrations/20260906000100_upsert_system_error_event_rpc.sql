CREATE OR REPLACE FUNCTION public.upsert_system_error_event(
    p_fingerprint text,
    p_feature text,
    p_action text,
    p_message text,
    p_path text,
    p_user_id uuid,
    p_metadata jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    INSERT INTO public.system_error_events (
        fingerprint,
        feature,
        action,
        message,
        path,
        user_id,
        metadata,
        occurrence_count,
        last_seen_at
    ) VALUES (
        p_fingerprint,
        p_feature,
        p_action,
        p_message,
        p_path,
        p_user_id,
        p_metadata,
        1,
        now()
    )
    ON CONFLICT (fingerprint) DO UPDATE
    SET
        last_seen_at = now(),
        occurrence_count = system_error_events.occurrence_count + 1,
        user_id = COALESCE(
            EXCLUDED.user_id,
            system_error_events.user_id
        ),
        metadata = EXCLUDED.metadata;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_system_error_event(text, text, text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_system_error_event(text, text, text, text, text, uuid, jsonb) TO service_role;
