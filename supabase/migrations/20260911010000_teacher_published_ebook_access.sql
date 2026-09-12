create or replace function public.get_published_ebooks_for_teacher()
returns table (
  ebook_id uuid,
  level_id uuid,
  level_name text,
  level_number integer,
  title text,
  heyzine_url text
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.teachers t
    join public.profiles p on p.id = t.profile_id
    where t.profile_id = auth.uid()
      and t.is_active
      and p.role = 'teacher'::public.user_role
      and p.status = 'active'::public.user_status
  ) then
    raise exception 'Active teacher access is required' using errcode = '42501';
  end if;

  return query
  select
    eb.id,
    eb.level_id,
    l.name,
    l.level_number,
    eb.title,
    eb.heyzine_url
  from public.ebooks eb
  join public.levels l on l.id = eb.level_id
  where eb.status = 'published'
  order by l.level_number asc, eb.created_at asc, eb.id asc;
end;
$function$;

grant execute on function public.get_published_ebooks_for_teacher() to authenticated;
