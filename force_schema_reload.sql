-- TUJUAN: Memaksa penyegaran semula skema cache PostgREST untuk jadual 'payments'.
-- GUNAKAN JIKA: Ralat "Could not find column in schema cache" masih berlaku selepas mengemas kini skema.

BEGIN;

-- Langkah 1: Matikan RLS untuk sementara. Ini akan memaksa polisi dimuat semula.
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- Langkah 2: Berikan semula kebenaran secara eksplisit kepada peranan 'authenticated'.
-- Walaupun sudah ada, melaksanakannya semula boleh membantu menyegarkan cache kebenaran.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE payments_id_seq TO authenticated;

-- Langkah 3: Hidupkan semula RLS. Ini akan memaksa polisi dinilai semula.
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Langkah 4: Hantar notifikasi sekali lagi sebagai langkah terakhir.
NOTIFY pgrst, 'reload schema';

COMMIT;

-- SELESAI. Sila uji semula penghantaran borang pembayaran.
