-- =====================================================================================
-- FIX: PERBETULKAN ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================================
-- TUJUAN: Skrip ini membetulkan ralat "Forbidden" dengan mengemas kini polisi keselamatan
--         (RLS) pada jadual `public.users`. Ia melakukan perkara berikut:
--         1. Mengaktifkan RLS pada jadual `users`.
--         2. Membenarkan admin untuk melihat SEMUA rekod pengguna.
--         3. Membenarkan pengguna individu untuk melihat rekod MEREKA SENDIRI sahaja.
--         4. Memadam polisi lama yang mungkin masih wujud pada jadual `profiles` lama.
--
-- ARAHAN:
-- 1. Pergi ke dashboard Supabase projek anda.
-- 2. Pergi ke "SQL Editor".
-- 3. Salin dan tampal SEMUA kandungan fail ini ke dalam editor.
-- 4. Klik "RUN" untuk melaksanakan skrip.
-- =====================================================================================

BEGIN;

-- Langkah 1: Aktifkan Row Level Security pada jadual 'users' jika belum aktif.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Langkah 2: Padam polisi sedia ada pada 'users' untuk mengelakkan konflik.
DROP POLICY IF EXISTS "Allow admin to view all users." ON public.users;
DROP POLICY IF EXISTS "Allow individual users to view their own data." ON public.users;

-- Langkah 3: Cipta polisi untuk ADMIN.
-- Polisi ini membenarkan pengguna dengan peranan 'admin' untuk melaksanakan operasi SELECT.
CREATE POLICY "Allow admin to view all users."
ON public.users
FOR SELECT
USING (
  (SELECT role FROM public.users WHERE user_id = auth.uid()) = 'admin'
);

-- Langkah 4: Cipta polisi untuk PENGGUNA BIASA.
-- Polisi ini membenarkan pengguna untuk melihat data mereka sendiri sahaja.
CREATE POLICY "Allow individual users to view their own data."
ON public.users
FOR SELECT
USING (
  auth.uid() = user_id
);

-- Langkah 5: (Pembersihan) Padam polisi lama pada jadual 'profiles' yang sudah tidak wujud.
-- Ini untuk memastikan tiada lagi rujukan kepada jadual lama.
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;


COMMIT;

-- =====================================================================================
-- SELESAI. Polisi RLS telah dikemas kini. Sila cuba log masuk semula dan akses
-- panel admin. Ralat "Forbidden" sepatutnya telah selesai.
-- =====================================================================================