-- Reconcile Renewal enrollments that were approved before the Renewal state-machine
-- migration existed. Only renewals with a completed prior package, paid/approved
-- payment, exactly one valid existing Teacher/Teaching Group, matching level/package,
-- eligible teacher, and available capacity are activated.

DO $$
DECLARE
    v_enrollment_id uuid;
BEGIN
    FOR v_enrollment_id IN
        SELECT e.id
        FROM public.enrollments AS e
        JOIN public.students AS s
          ON s.id = e.student_id
        JOIN public.invoices AS i
          ON i.enrollment_id = e.id
         AND i.status = 'paid'
        JOIN public.payments AS p
          ON p.invoice_id = i.id
         AND p.status = 'approved'
        JOIN public.teaching_group_students AS tgs
          ON tgs.student_id = s.id
        JOIN public.teaching_groups AS tg
          ON tg.id = tgs.teaching_group_id
         AND tg.is_active
         AND tg.level_id = e.level_id
         AND tg.group_type = e.package_type
        JOIN public.teachers AS t
          ON t.id = tg.teacher_id
         AND t.is_active
        WHERE e.status = 'payment_approved'
          AND s.is_active
          AND e.level_id = s.level_id
          AND NOT EXISTS (
              SELECT 1
              FROM public.student_level_results AS slr
              WHERE slr.student_id = s.id
                AND slr.level_id = s.level_id
          )
          AND EXISTS (
              SELECT 1
              FROM public.enrollments AS prior
              WHERE prior.student_id = s.id
                AND prior.level_id = e.level_id
                AND prior.id <> e.id
                AND prior.status = 'completed'
          )
          AND (
              SELECT count(*)::integer
              FROM public.teaching_group_students AS membership
              WHERE membership.student_id = s.id
          ) = 1
          AND EXISTS (
              SELECT 1
              FROM public.teacher_levels AS tl
              WHERE tl.teacher_id = t.id
                AND tl.level_id = e.level_id
          )
          AND (
              SELECT count(*)::integer
              FROM public.teaching_group_students AS members
              WHERE members.teaching_group_id = tg.id
          ) <= CASE
              WHEN tg.group_type = 'private' THEN 1
              WHEN tg.group_type = 'semi_private' THEN 4
              ELSE 0
          )
    LOOP
        UPDATE public.enrollments
        SET status = 'active',
            updated_at = now()
        WHERE id = v_enrollment_id
          AND status = 'payment_approved';
    END LOOP;
END;
$$;