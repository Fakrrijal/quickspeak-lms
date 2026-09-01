-- S2.10 Configurable manual-payment instructions.
CREATE TABLE public.payment_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name text NOT NULL CHECK (btrim(bank_name) <> ''),
    account_number text NOT NULL CHECK (btrim(account_number) <> ''),
    account_name text NOT NULL CHECK (btrim(account_name) <> ''),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX payment_settings_one_active_row
    ON public.payment_settings (is_active)
    WHERE is_active;

CREATE TRIGGER payment_settings_updated_at
    BEFORE UPDATE ON public.payment_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.payment_settings (
    bank_name,
    account_number,
    account_name,
    is_active
)
VALUES (
    'BCA',
    '4371993554',
    'Rijalul Fakar',
    true
);

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view active payment settings"
    ON public.payment_settings
    FOR SELECT
    TO authenticated
    USING (
        is_active
        AND EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'student'::public.user_role
        )
    );

CREATE POLICY "Admins can view all payment settings"
    ON public.payment_settings
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Admins can update payment settings"
    ON public.payment_settings
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

GRANT SELECT, UPDATE ON public.payment_settings TO authenticated;
