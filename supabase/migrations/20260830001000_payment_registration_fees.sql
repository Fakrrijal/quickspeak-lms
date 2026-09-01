ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS private_registration_fee numeric NOT NULL DEFAULT 180000 CHECK (private_registration_fee >= 0),
  ADD COLUMN IF NOT EXISTS semi_private_registration_fee numeric NOT NULL DEFAULT 150000 CHECK (semi_private_registration_fee >= 0);
