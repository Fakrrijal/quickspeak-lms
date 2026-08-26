-- S2.6D2 Admin Set Teaching Group Status RPC
-- QuickSpeak LMS Database Schema
-- RPC for Admin to activate/deactivate Teaching Groups

-- Drop existing Admin active-only SELECT policy
DROP POLICY IF EXISTS "Admins can view active teaching groups" ON public.teaching_groups;

-- Create new Admin SELECT policy that allows viewing all groups
CREATE POLICY "Admins can view teaching groups"
    ON public.teaching_groups
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
    );

-- Create RPC for setting teaching group status
CREATE OR REPLACE FUNCTION public.admin_set_teaching_group_status(
    p_teaching_group_id uuid,
    p_is_active boolean
)
RETURNS public.teaching_groups
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    v_teaching_group public.teaching_groups%ROWTYPE;
BEGIN
    -- 1. Verify active Admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    -- 2. Verify teaching group exists
    SELECT * INTO v_teaching_group
    FROM public.teaching_groups
    WHERE id = p_teaching_group_id;

    IF v_teaching_group IS NULL THEN
        RAISE EXCEPTION 'Teaching group not found';
    END IF;

    -- 3. Update ONLY is_active (existing trigger will update updated_at)
    UPDATE public.teaching_groups
    SET is_active = p_is_active
    WHERE id = p_teaching_group_id;

    -- 4. Return the updated row
    SELECT * INTO v_teaching_group
    FROM public.teaching_groups
    WHERE id = p_teaching_group_id;

    RETURN v_teaching_group;
END;
$$;
