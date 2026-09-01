-- S10.3 Secure Student Core Ebook Read Path

CREATE FUNCTION public.get_my_active_level_ebooks()
RETURNS TABLE (
    ebook_id uuid,
    level_id uuid,
    level_name text,
    level_number integer,
    title text,
    heyzine_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
    SELECT DISTINCT
        eb.id AS ebook_id,
        e.level_id,
        l.name AS level_name,
        l.level_number,
        eb.title,
        eb.heyzine_url
    FROM public.students AS s
    JOIN public.enrollments AS e
        ON e.student_id = s.id
       AND e.status = 'active'
    JOIN public.ebooks AS eb
        ON eb.level_id = e.level_id
       AND eb.status = 'published'
    JOIN public.levels AS l
        ON l.id = e.level_id
    WHERE s.profile_id = auth.uid()
    ORDER BY l.level_number, eb.title, eb.id;
$$;

REVOKE ALL ON FUNCTION public.get_my_active_level_ebooks() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_my_active_level_ebooks() TO authenticated;
