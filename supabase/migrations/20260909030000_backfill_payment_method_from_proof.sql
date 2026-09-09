-- Backfill the payment method for historical proof submissions.
-- The student payment flow accepts payment proof only for bank-transfer payments,
-- and the proof-submission RPC records bank_transfer for new submissions.

UPDATE public.payments AS p
SET payment_method = 'bank_transfer'
WHERE p.payment_method IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.payment_proofs AS pp
    WHERE pp.payment_id = p.id
  );
