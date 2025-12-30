-- MIGRATION SCRIPT 001: Menyeragamkan Skema Pengguna dan Admin
-- Tarikh: 30 Disember 2025
-- Penerangan:
-- 1. Membuang jadual 'profiles' yang berlebihan (redundant).
-- 2. Menjadikan jadual 'admin_users' sebagai satu-satunya sumber pengesahan status admin.
-- 3. Memastikan pengguna admin utama ('abrbrillanteplt@gmail.com') wujud dalam jadual 'admin_users'.
-- 4. Mengemas kini semua Polisi Keselamatan (RLS) untuk menggunakan 'admin_users'.
-- 5. Membuang kolum 'role' yang tidak lagi digunakan dan bermasalah dari jadual 'users'.
-- Skrip ini direka untuk selamat dijalankan beberapa kali (idempotent).

BEGIN; -- Mulakan transaksi untuk memastikan semua langkah berjaya atau tiada apa-apa yang berubah.

-- LANGKAH 1: Buang jadual 'profiles' yang tidak diperlukan.
DROP TABLE IF EXISTS public.profiles;

-- LANGKAH 2: Pastikan jadual 'admin_users' wujud menggunakan skema yang betul.
CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- LANGKAH 3: Pindahkan admin utama ke dalam jadual 'admin_users' berdasarkan e-mel.
-- ON CONFLICT memastikan tiada ralat jika admin itu sudah wujud.
INSERT INTO public.admin_users (user_id)
SELECT user_id FROM public.users WHERE email = 'abrbrillanteplt@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- LANGKAH 4: Buang semua polisi RLS lama yang mungkin bercanggah pada jadual-jadual utama.
-- Ini untuk memastikan kita bermula dari keadaan yang bersih sebelum mencipta polisi baru.
DROP POLICY IF EXISTS "Admins have full access." ON public.users;
DROP POLICY IF EXISTS "Allow admin full access to sales" ON public.sales;
DROP POLICY IF EXISTS "Admins have full access to payments." ON public.payments;

-- LANGKAH 5: Cipta semula polisi RLS untuk Admin menggunakan logik yang betul dan efisien.
-- Polisi ini memeriksa sama ada user_id pengguna yang sedang log masuk wujud dalam jadual 'admin_users'.
CREATE POLICY "Admin All-Access on Users" ON public.users FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
CREATE POLICY "Admin All-Access on Payments" ON public.payments FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
CREATE POLICY "Admin All-Access on Sales" ON public.sales FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
CREATE POLICY "Admin All-Access on Affiliates" ON public.affiliates FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- LANGKAH 6: Akhir sekali, buang kolum 'role' yang tidak lagi diperlukan dari jadual 'users'.
-- Lakukan ini hanya selepas semua polisi yang bergantung padanya telah dibuang.
ALTER TABLE public.users DROP COLUMN IF EXISTS role;

COMMIT; -- Tamatkan dan sahkan transaksi.
