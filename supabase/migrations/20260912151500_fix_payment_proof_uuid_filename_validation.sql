create or replace function public.submit_payment_proof(
  p_payment_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size integer
)
returns table(
  payment_proof_id uuid,
  payment_status text,
  enrollment_status text,
  uploaded_at timestamptz
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_auth_uid uuid := auth.uid();
  v_student public.students%rowtype;
  v_payment public.payments%rowtype;
  v_invoice public.invoices%rowtype;
  v_enrollment public.enrollments%rowtype;
  v_existing_proof public.payment_proofs%rowtype;
  v_proof public.payment_proofs%rowtype;
  v_filename text;
  v_extension text;
  v_filename_uuid text;
begin
  if v_auth_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into v_student from public.students where profile_id = v_auth_uid for key share;
  if not found then
    raise exception 'Student record not found' using errcode = 'P0002';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;

  select * into v_invoice from public.invoices where id = v_payment.invoice_id;
  if not found then
    raise exception 'Payment invoice not found' using errcode = 'P0002';
  end if;

  select * into v_enrollment from public.enrollments where id = v_invoice.enrollment_id for update;
  if not found then
    raise exception 'Payment enrollment not found' using errcode = 'P0002';
  end if;

  if v_enrollment.student_id <> v_student.id then
    raise exception 'Not authorized to submit proof for this payment' using errcode = '42501';
  end if;

  if v_payment.status = 'proof_submitted' then
    select * into v_existing_proof
    from public.payment_proofs
    where payment_id = v_payment.id and storage_path = p_storage_path
    order by uploaded_at desc, id desc
    limit 1;
    if found then
      return query select v_existing_proof.id, v_payment.status, v_enrollment.status, v_existing_proof.uploaded_at;
      return;
    end if;
    raise exception 'Payment proof has already been submitted' using errcode = 'P0001';
  end if;

  if v_payment.status = 'approved' then
    raise exception 'Payment has already been approved' using errcode = 'P0001';
  end if;

  if v_payment.status not in ('unpaid', 'rejected') then
    raise exception 'Payment is not eligible for proof submission' using errcode = 'P0001';
  end if;

  if v_enrollment.status not in ('payment_pending', 'payment_rejected') then
    raise exception 'Enrollment is not eligible for proof submission' using errcode = 'P0001';
  end if;

  v_filename := split_part(p_storage_path, '/', 3);

  if p_storage_path <> format('%s/%s/%s', v_student.id, v_payment.id, v_filename)
     or v_filename = ''
     or split_part(p_storage_path, '/', 4) <> '' then
    raise exception 'Invalid payment proof storage path' using errcode = '22023';
  end if;

  v_extension := lower(split_part(v_filename, '.', array_length(string_to_array(v_filename, '.'), 1)));
  v_filename_uuid := left(v_filename, length(v_filename) - length(v_extension) - 1);

  if v_filename_uuid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Payment proof filename must use a UUID' using errcode = '22023';
  end if;

  if (v_extension = 'pdf' and p_mime_type <> 'application/pdf')
     or (v_extension in ('jpg', 'jpeg') and p_mime_type <> 'image/jpeg')
     or (v_extension = 'png' and p_mime_type <> 'image/png')
     or v_extension not in ('pdf', 'jpg', 'jpeg', 'png') then
    raise exception 'Payment proof file type is not allowed' using errcode = '22023';
  end if;

  if p_file_size is null or p_file_size <= 0 or p_file_size > 5242880 then
    raise exception 'Payment proof file size must be between 1 byte and 5 MiB' using errcode = '22023';
  end if;

  perform 1 from storage.objects where bucket_id = 'payment_proofs' and name = p_storage_path for key share;
  if not found then
    raise exception 'Payment proof storage object was not found' using errcode = 'P0002';
  end if;

  insert into public.payment_proofs (payment_id, storage_path, original_filename, mime_type, file_size)
  values (v_payment.id, p_storage_path, p_original_filename, p_mime_type, p_file_size)
  returning * into v_proof;

  update public.payments
  set status = 'proof_submitted', payment_method = coalesce(payment_method, 'bank_transfer')
  where id = v_payment.id;

  update public.enrollments
  set status = 'payment_submitted'
  where id = v_enrollment.id;

  return query select v_proof.id, 'proof_submitted'::text, 'payment_submitted'::text, v_proof.uploaded_at;
end;
$function$;
