-- Skrip 4: Pembetulan Polisi Keselamatan Admin
-- Sila jalankan keseluruhan skrip ini di Supabase SQL Editor anda.

-- LANGKAH 1: Cipta fungsi untuk mendapatkan peranan pengguna dengan selamat
-- Fungsi ini mengelakkan gelung 'infinite recursion'.
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE user_id = auth.uid();
$$;

-- LANGKAH 2: Padam polisi admin yang rosak dari jadual 'users'
DROP POLICY IF EXISTS "Admins have full access." ON public.users;

-- LANGKAH 3: Cipta semula polisi admin yang betul menggunakan fungsi baru
CREATE POLICY "Admins have full access."
ON public.users FOR ALL
USING (get_my_role() = 'admin');


-- LANGKAH 4: Padam polisi admin yang mungkin rosak pada jadual lain & cipta semula

-- Untuk Jadual 'sales'
DROP POLICY IF EXISTS "Allow admin full access to sales" ON public.sales;
CREATE POLICY "Allow admin full access to sales"
ON public.sales FOR ALL
USING (get_my_role() = 'admin');

-- Untuk Jadual 'payments'
DROP POLICY IF EXISTS "Admins have full access to payments." ON public.payments;
CREATE POLICY "Admins have full access to payments."
ON public.payments FOR ALL
USING (get_my_role() = 'admin');
