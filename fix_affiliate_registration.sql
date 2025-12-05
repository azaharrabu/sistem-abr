-- ALTER affiliates table to add new columns for affiliate details
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='affiliates' AND column_name='full_name') THEN
        ALTER TABLE public.affiliates ADD COLUMN full_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='affiliates' AND column_name='phone_number') THEN
        ALTER TABLE public.affiliates ADD COLUMN phone_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='affiliates' AND column_name='bank_name') THEN
        ALTER TABLE public.affiliates ADD COLUMN bank_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='affiliates' AND column_name='bank_account_number') THEN
        ALTER TABLE public.affiliates ADD COLUMN bank_account_number TEXT;
    END IF;
END $$;

COMMENT ON COLUMN public.affiliates.full_name IS 'Nama penuh affiliate seperti di dalam akaun bank.';
COMMENT ON COLUMN public.affiliates.phone_number IS 'Nombor telefon affiliate untuk dihubungi.';
COMMENT ON COLUMN public.affiliates.bank_name IS 'Nama bank yang digunakan oleh affiliate untuk penerimaan komisyen.';
COMMENT ON COLUMN public.affiliates.bank_account_number IS 'Nombor akaun bank affiliate.';
