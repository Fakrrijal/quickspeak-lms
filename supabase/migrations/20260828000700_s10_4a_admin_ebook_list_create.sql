-- S10.4A Admin Ebook Management: list and create draft only.

CREATE FUNCTION public.admin_list_ebooks()
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
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Active administrator access is required'
            USING ERRCODE = '42501';
    END IF;

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
    ORDER BY l.level_number ASC, eb.updated_at DESC;
END;
$$;

CREATE FUNCTION public.admin_create_ebook(
    p_level_id uuid,
    p_title text,
    p_heyzine_url text
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
    v_title text := btrim(p_title);
    v_heyzine_url text := btrim(p_heyzine_url);
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Active administrator access is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_level_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.levels AS l
        WHERE l.id = p_level_id
    ) THEN
        RAISE EXCEPTION 'Level does not exist'
            USING ERRCODE = '22023';
    END IF;

    IF v_title IS NULL OR v_title = '' THEN
        RAISE EXCEPTION 'Ebook title is required'
            USING ERRCODE = '22023';
    END IF;

    IF char_length(v_title) > 200 THEN
        RAISE EXCEPTION 'Ebook title must be 200 characters or fewer'
            USING ERRCODE = '22023';
    END IF;

    IF v_heyzine_url IS NULL OR v_heyzine_url = ''
       OR v_heyzine_url !~ '^https://heyzine[.]com(/[A-Za-z0-9._~!$&''()*+,;=:@%/?-]*)?$' THEN
        RAISE EXCEPTION 'Heyzine URL must be an HTTPS URL for heyzine.com without credentials, ports, or fragments'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    WITH inserted_ebook AS (
        INSERT INTO public.ebooks (
            level_id,
            title,
            heyzine_url,
            status
        )
        VALUES (
            p_level_id,
            v_title,
            v_heyzine_url,
            'draft'
        )
        RETURNING *
    )
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
    FROM inserted_ebook AS eb
    JOIN public.levels AS l
        ON l.id = eb.level_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_ebooks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_ebook(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_list_ebooks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_ebook(uuid, text, text) TO authenticated;
