-- Student and teacher self-service profile edits and private avatar storage.
-- This migration intentionally leaves direct updates to public.profiles denied.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    false,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own avatars"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND owner_id = auth.uid()::text
        AND split_part(name, '/', 1) = auth.uid()::text
        AND split_part(name, '/', 2) <> ''
        AND split_part(name, '/', 3) = ''
    );

CREATE POLICY "Users can read own avatars"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'avatars'
        AND owner_id = auth.uid()::text
        AND split_part(name, '/', 1) = auth.uid()::text
        AND split_part(name, '/', 2) <> ''
        AND split_part(name, '/', 3) = ''
    );

CREATE POLICY "Users can delete own avatars"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'avatars'
        AND owner_id = auth.uid()::text
        AND split_part(name, '/', 1) = auth.uid()::text
        AND split_part(name, '/', 2) <> ''
        AND split_part(name, '/', 3) = ''
    );

CREATE FUNCTION public.update_my_profile(
    p_full_name text,
    p_phone text,
    p_address text,
    p_avatar_url text
)
RETURNS TABLE (
    full_name text,
    phone text,
    address text,
    avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_auth_uid uuid := auth.uid();
    v_avatar_filename text;
BEGIN
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication is required' USING ERRCODE = '42501';
    END IF;

    IF nullif(btrim(p_full_name), '') IS NULL THEN
        RAISE EXCEPTION 'Full name is required' USING ERRCODE = '22023';
    END IF;

    IF p_avatar_url IS NOT NULL THEN
        v_avatar_filename := split_part(p_avatar_url, '/', 2);

        IF p_avatar_url <> format('%s/%s', v_auth_uid, v_avatar_filename)
           OR v_avatar_filename !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
           OR split_part(p_avatar_url, '/', 3) <> '' THEN
            RAISE EXCEPTION 'Avatar path is invalid' USING ERRCODE = '22023';
        END IF;

        PERFORM 1
        FROM storage.objects AS object
        WHERE object.bucket_id = 'avatars'
          AND object.name = p_avatar_url
          AND object.owner_id = v_auth_uid::text;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Avatar object was not found' USING ERRCODE = 'P0002';
        END IF;
    END IF;

    RETURN QUERY
    UPDATE public.profiles AS profile
    SET full_name = btrim(p_full_name),
        phone = nullif(btrim(coalesce(p_phone, '')), ''),
        address = nullif(btrim(coalesce(p_address, '')), ''),
        avatar_url = p_avatar_url
    WHERE profile.id = v_auth_uid
      AND profile.role IN ('student'::public.user_role, 'teacher'::public.user_role)
    RETURNING profile.full_name, profile.phone, profile.address, profile.avatar_url;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student or teacher profile was not found' USING ERRCODE = '42501';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile(text, text, text, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text, text)
TO authenticated;
