-- Allow admins to correct the level/package attached to a paid enrollment.
-- The correction changes enrollment classification only; existing invoices/payments are preserved.

CREATE OR REPLACE FUNCTION public.admin_edit_paid_enrollment(
    p_enrollment_id uuid,
    p_level_id uuid,
    p_package_type text
)
RETURNS public.enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_enrollment public.enrollments%ROWTYPE;
    v_level public.levels%ROWTYPE;
    v_conflict public.enrollments%ROWTYPE;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only active administrators can edit paid enrollments' USING ERRCODE = '42501';
    END IF;

    IF p_package_type NOT IN ('private', 'semi_private') THEN
        RAISE EXCEPTION 'Invalid package type' USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_enrollment
    FROM public.enrollments
    WHERE id = p_enrollment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Enrollment not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_enrollment.status NOT IN ('payment_approved', 'teacher_assignment') THEN
        RAISE EXCEPTION 'Only payment-approved enrollments can be edited' USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_level
    FROM public.levels
    WHERE id = p_level_id
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected learning level was not found' USING ERRCODE = 'P0002';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.teaching_group_students AS tgs
        JOIN public.teaching_groups AS tg
          ON tg.id = tgs.teaching_group_id
        WHERE tgs.student_id = v_enrollment.student_id
          AND tg.is_active = true
    ) THEN
        RAISE EXCEPTION 'This student already has an active teaching-group membership. Resolve the current assignment before editing the enrollment.' USING ERRCODE = 'P0001';
    END IF;

    SELECT *
    INTO v_conflict
    FROM public.enrollments
    WHERE student_id = v_enrollment.student_id
      AND id <> v_enrollment.id
      AND level_id = p_level_id
      AND status IN (
          'pending',
          'payment_pending',
          'payment_submitted',
          'payment_rejected',
          'payment_approved',
          'teacher_assignment',
          'active'
      )
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        RAISE EXCEPTION 'Student already has another enrollment in progress for the selected level' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.enrollments
    SET level_id = p_level_id,
        package_type = p_package_type,
        updated_at = NOW()
    WHERE id = v_enrollment.id
    RETURNING * INTO v_enrollment;

    RETURN v_enrollment;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_edit_paid_enrollment(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_edit_paid_enrollment(uuid, uuid, text) TO authenticated;
