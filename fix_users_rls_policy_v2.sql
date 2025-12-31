-- =====================================================================================
-- FIX RLS POLICIES FOR 'users' TABLE (V2)
-- =====================================================================================
-- TUJUAN: Skrip ini membersihkan semua polisi SELECT yang berpotensi konflik pada
--         jadual `public.users` dan mencipta semula polisi yang betul.
-- MASALAH: Siasatan menunjukkan penapis (filter) `(role = 'admin')` sedang digunakan
--          secara tidak sengaja, menyebabkan hanya pengguna admin yang dipaparkan,
--          bukannya membenarkan admin melihat semua pengguna.
-- PENYELESAIAN: Kita akan memadam semua polisi SELECT yang lama dan mencipta dua
--              polisi yang jelas:
--              1. Pengguna biasa boleh melihat data mereka sendiri.
--              2. Pengguna admin boleh melihat SEMUA data.
-- =====================================================================================

-- Langkah 1: Buang semua polisi SELECT yang diketahui pada jadual `public.users`.
-- Ini adalah untuk memastikan kita bermula dari keadaan yang bersih.
DROP POLICY IF EXISTS "Allow admin to view all users." ON public.users;
DROP POLICY IF EXISTS "Allow individual users to view their own data." ON public.users;
DROP POLICY IF EXISTS "Allow individual users to read their own user data" ON public.users;
DROP POLICY IF EXISTS "Admins have full access." ON public.users;
DROP POLICY IF EXISTS "Users can read their own profile." ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.users; -- Just in case
DROP POLICY IF EXISTS "1_UsersCanReadTheirOwnData" ON public.users; -- Drop new policies if they exist
DROP POLICY IF EXISTS "2_AdminsCanReadAllData" ON public.users; -- Drop new policies if they exist


-- Langkah 2: Pastikan fungsi pembantu `get_user_role` wujud.
-- Fungsi ini selamat daripada rekursi dan diperlukan untuk polisi admin.
-- We define it to return the role from the users table for a given user id.
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Important: This function runs with the privileges of the user who defined it.
  -- We select the role from the users table where the user_id matches.
  SELECT role INTO user_role FROM public.users WHERE user_id = p_user_id;
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Langkah 3: Cipta polisi yang betul.
-- Polisi 1: Benarkan pengguna untuk melihat (SELECT) data mereka sendiri.
-- The `USING` clause is evaluated for each row.
-- `auth.uid()` is the ID of the user making the request.
-- `user_id` is the value of the 'user_id' column in the row being checked.
-- This policy will be true only for the user's own row.
CREATE POLICY "1_UsersCanReadTheirOwnData"
  ON public.users
  FOR SELECT
  USING (auth.uid() = user_id);

-- Polisi 2: Benarkan pengguna dengan peranan 'admin' untuk melihat (SELECT) SEMUA data.
-- This policy uses the helper function to check the role of the user making the request.
-- If the user is an admin, `get_user_role(auth.uid())` returns 'admin'.
-- The expression `'admin' = 'admin'` is true, so the policy passes for ALL rows.
CREATE POLICY "2_AdminsCanReadAllData"
  ON public.users
  FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');

SELECT 'Skrip pembaikan polisi RLS untuk jadual "users" telah selesai.' AS status;
