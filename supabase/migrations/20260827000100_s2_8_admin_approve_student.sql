create or replace function public.admin_approve_student(
    p_profile_id uuid,
    p_level_id uuid
)
returns public.students
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_profile public.profiles%rowtype;
    v_level public.levels%rowtype;
    v_existing_student public.students%rowtype;
    v_student public.students%rowtype;
    v_activation_year integer;
    v_yearly_number integer;
    v_student_code text;
begin
    -- 1. Admin authorization
    if not public.is_admin() then
        raise exception 'Admin access required';
    end if;

    -- 2. Lock target profile and validate registration state
    select *
    into v_profile
    from public.profiles
    where id = p_profile_id
    for update;

    if not found then
        raise exception 'Target profile does not exist';
    end if;

    if v_profile.role <> 'student'::public.user_role then
        raise exception 'Target profile must have the student role';
    end if;

    if v_profile.status <> 'waiting'::public.user_status then
        raise exception 'Target profile must have waiting status';
    end if;

    -- 3. Level must exist
    select *
    into v_level
    from public.levels
    where id = p_level_id;

    if not found then
        raise exception 'Selected level does not exist';
    end if;

    -- 4. Student record must not already exist
    select *
    into v_existing_student
    from public.students
    where profile_id = p_profile_id
    for key share;

    if found then
        raise exception 'Target profile already has a student record';
    end if;

    -- 5. Generate student code using the existing yearly counter
    v_activation_year := extract(year from current_date)::integer;

    insert into public.student_code_year_counters as counter (
        activation_year,
        last_number
    )
    values (
        v_activation_year,
        1
    )
    on conflict (activation_year) do update
    set last_number = counter.last_number + 1
    where counter.last_number < 9999
    returning last_number into v_yearly_number;

    if v_yearly_number is null then
        raise exception
            'Student code sequence is exhausted for activation year %',
            v_activation_year;
    end if;

    v_student_code := format(
        'QS-%s-%s',
        v_activation_year,
        lpad(v_yearly_number::text, 4, '0')
    );

    -- 6. Create Student with Admin-selected starting level
    insert into public.students (
        profile_id,
        level_id,
        student_code,
        is_active
    )
    values (
        p_profile_id,
        p_level_id,
        v_student_code,
        true
    )
    returning * into v_student;

    -- 7. Activate profile
    update public.profiles
    set status = 'active'::public.user_status,
        updated_at = now()
    where id = p_profile_id
      and status = 'waiting'::public.user_status;

    if not found then
        raise exception 'Target profile status changed before approval completed';
    end if;

    return v_student;
end;
$function$;

grant execute on function public.admin_approve_student(uuid, uuid)
to authenticated;