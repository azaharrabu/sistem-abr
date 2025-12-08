-- =====================================================================================
-- FIX: MEMBETULKAN POLISI KESELAMATAN (RLS) YANG MENYEBABKAN REKURSI INFINIT
-- =====================================================================================
-- TUJUAN: Skrip ini membetulkan ralat "infinite recursion detected in policy for relation 'users'".
--         Ia berlaku kerana polisi admin cuba membaca jadual 'users' untuk mengesahkan
--         peranan admin, yang mencetuskan polisi itu sendiri.
--
-- TINDAKAN:
-- 1. Mencipta satu fungsi helper (`get_my_role`) yang selamat (SECURITY DEFINER) untuk mendapatkan
--    peranan pengguna tanpa mencetuskan RLS.
-- 2. Memadam polisi admin yang rosak pada jadual `users`.
-- 3. Mencipta semula polisi admin menggunakan fungsi helper yang baru.
-- =====================================================================================

BEGIN;

-- Langkah 1: Cipta fungsi helper `get_my_role()`
-- SECURITY DEFINER memastikan fungsi ini berjalan dengan kebenaran pemiliknya (admin),
-- jadi ia tidak akan mencetuskan semula polisi RLS pada jadual 'users'.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE user_id = auth.uid();
$$;

-- Langkah 2: Padam polisi-polisi admin yang lama dan mungkin rosak pada jadual 'users'.
-- Kita padamkan polisi untuk SELECT dan ALL untuk memastikan kebersihan.
DROP POLICY IF EXISTS "Allow admin to view all users." ON public.users;
DROP POLICY IF EXISTS "Admins have full access." ON public.users;


-- Langkah 3: Cipta semula polisi admin yang betul menggunakan fungsi helper.
-- Polisi ini kini selamat dan tidak akan menyebabkan rekursi.
CREATE POLICY "Admins have full access."
ON public.users
FOR ALL
USING (
  public.get_my_role() = 'admin'
);


COMMIT;

-- =====================================================================================
-- SELESAI. Ralat rekursi sepatutnya telah selesai.
-- Sila cuba semula proses pendaftaran (signup).
-- =====================================================================================
