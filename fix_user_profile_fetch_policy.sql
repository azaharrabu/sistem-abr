-- fix_user_profile_fetch_policy.sql

-- LANGKAH 1: Cipta polisi untuk membenarkan pengguna membaca data mereka sendiri
-- Polisi ini membenarkan pengguna yang log masuk untuk mendapatkan butiran mereka dari jadual 'users'.
-- Ia penting untuk fungsi log masuk yang betul.

-- Padam polisi lama jika ia wujud untuk mengelakkan ralat
DROP POLICY IF EXISTS "Allow individual users to read their own user data" ON public.users;

-- Cipta polisi SELECT
CREATE POLICY "Allow individual users to read their own user data"
ON public.users FOR SELECT
USING (auth.uid() = user_id);

-- Nota Tambahan:
-- Polisi sedia ada "Admins have full access." akan terus berfungsi.
-- Pengguna biasa kini boleh log masuk dan mendapatkan profil mereka, manakala admin
-- boleh terus mengakses semua data pengguna.
-- Sila jalankan skrip ini di Supabase SQL Editor anda.
