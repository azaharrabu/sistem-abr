-- =====================================================================================
-- SKRIP KEMAS KINI PERANAN PENGGUNA (UPDATE USER ROLE SCRIPT)
-- =====================================================================================
-- TUJUAN: Skrip ini akan mengemas kini peranan (role) untuk pengguna tertentu
--         kepada 'admin'. Ia selamat untuk dijalankan semula.
--
-- ARAHAN:
-- 1. Pergi ke dashboard Supabase projek anda.
-- 2. Pergi ke "SQL Editor".
-- 3. Salin dan tampal kandungan fail ini ke dalam editor.
-- 4. Klik "RUN" untuk melaksanakan skrip.
-- =====================================================================================

BEGIN;

-- Kemas kini peranan untuk pengguna 'abrbrillanteplt@gmail.com' kepada 'admin'.
-- Ini akan memberikan mereka akses penuh berdasarkan polisi RLS yang sedia ada.
UPDATE public.users
SET
    role = 'admin'
WHERE
    email = 'abrbrillanteplt@gmail.com';

COMMIT;

-- =====================================================================================
-- SELESAI. Sila semak jadual `public.users` untuk mengesahkan peranan pengguna
-- telah dikemas kini.
-- =====================================================================================
