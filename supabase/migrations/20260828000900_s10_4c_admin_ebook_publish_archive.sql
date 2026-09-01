-- S10.4C Admin Ebook Management: publish, archive, and atomic replacement.

CREATE FUNCTION public.admin_publish_ebook(
    p_ebook_id uuid
)
RETURNS TABLE (
    ebook_id uuid,
    level_id uuid,
    level_name text,
    level_number integer,
    title text,
    heyzine_url text,
    status text,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_target public.ebooks%ROWTYPE;
    v_locked_level_id uuid;
    v_current_published_id uuid;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Active administrator access is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_target
    FROM public.ebooks AS eb
    WHERE eb.id = p_ebook_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ebook does not exist'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_target.status <> 'draft' THEN
        RAISE EXCEPTION 'Only draft ebooks can be published'
            USING ERRCODE = '22023';
    END IF;

    BEGIN
        SELECT l.id
        INTO v_locked_level_id
        FROM public.levels AS l
        WHERE l.id = v_target.level_id
        FOR UPDATE NOWAIT;
    EXCEPTION
        WHEN lock_not_available THEN
            RAISE EXCEPTION 'Another ebook publication is in progress for this level. Refresh and retry.'
                USING ERRCODE = '55P03';
    END;

    IF v_locked_level_id IS NULL THEN
        RAISE EXCEPTION 'Level does not exist'
            USING ERRCODE = '22023';
    END IF;

    SELECT eb.id
    INTO v_current_published_id
    FROM public.ebooks AS eb
    WHERE eb.level_id = v_locked_level_id
      AND eb.status = 'published'
    FOR UPDATE;

    IF FOUND THEN
        UPDATE public.ebooks AS eb
        SET status = 'archived'
        WHERE eb.id = v_current_published_id;
    END IF;

    UPDATE public.ebooks AS eb
    SET status = 'published'
    WHERE eb.id = v_target.id;

    RETURN QUERY
    SELECT
        eb.id,
        eb.level_id,
        l.name,
        l.level_number,
        eb.title,
        eb.heyzine_url,
        eb.status,
        eb.created_at,
        eb.updated_at
    FROM public.ebooks AS eb
    JOIN public.levels AS l
        ON l.id = eb.level_id
    WHERE eb.id = v_target.id;
END;
$$;

CREATE FUNCTION public.admin_archive_ebook(
    p_ebook_id uuid
)
RETURNS TABLE (
    ebook_id uuid,
    level_id uuid,
    level_name text,
    level_number integer,
    title text,
    heyzine_url text,
    status text,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_target public.ebooks%ROWTYPE;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Active administrator access is required'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_target
    FROM public.ebooks AS eb
    WHERE eb.id = p_ebook_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ebook does not exist'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_target.status <> 'published' THEN
        RAISE EXCEPTION 'Only published ebooks can be archived'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.ebooks AS eb
    SET status = 'archived'
    WHERE eb.id = v_target.id;

    RETURN QUERY
    SELECT
        eb.id,
        eb.level_id,
        l.name,
        l.level_number,
        eb.title,
        eb.heyzine_url,
        eb.status,
        eb.created_at,
        eb.updated_at
    FROM public.ebooks AS eb
    JOIN public.levels AS l
        ON l.id = eb.level_id
    WHERE eb.id = v_target.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_publish_ebook(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_archive_ebook(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_publish_ebook(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_archive_ebook(uuid) TO authenticated;
