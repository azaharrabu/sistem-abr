-- Skrip 6: Pembetulan Muktamad (V2) untuk Ralat Log Masuk
-- Sila jalankan keseluruhan skrip ini di Supabase SQL Editor anda.

-- LANGKAH 1: Padam fungsi dan semua polisi admin yang bergantung padanya secara automatik
-- Menggunakan CASCADE seperti yang disarankan oleh mesej ralat untuk menyelesaikan isu pergantungan.
DROP FUNCTION IF EXISTS get_my_role() CASCADE;


-- LANGKAH 2: Cipta jadual baru untuk menjejak admin sahaja (jika belum wujud)
CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- Aktifkan RLS pada jadual baru ini
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Cipta polisi untuk jadual admin (padam jika wujud untuk membolehkan skrip dijalankan semula)
DROP POLICY IF EXISTS "Allow public read access on admin_users" ON public.admin_users;
CREATE POLICY "Allow public read access on admin_users" ON public.admin_users FOR SELECT USING (true);


-- LANGKAH 3: Pindahkan semua admin sedia ada dari jadual 'users' ke jadual 'admin_users'
-- Ini hanya perlu dijalankan sekali untuk memindahkan data sedia ada.
INSERT INTO public.admin_users (user_id)
SELECT user_id FROM public.users WHERE role = 'admin'
ON CONFLICT (user_id) DO NOTHING;


-- LANGKAH 4: Cipta semula polisi admin yang betul pada semua jadual berkaitan
-- Polisi-polisi ini kini merujuk kepada 'admin_users', memecahkan gelung rekursi.

-- Polisi untuk jadual 'users'
CREATE POLICY "Admins have full access."
ON public.users FOR ALL
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- Polisi untuk jadual 'sales'
CREATE POLICY "Allow admin full access to sales"
ON public.sales FOR ALL
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- Polisi untuk jadual 'payments'
CREATE POLICY "Admins have full access to payments."
ON public.payments FOR ALL
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
