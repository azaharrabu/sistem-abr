-- =====================================================================================
-- SKRIP PEMULIHAN SEMUA PENGGUNA (RECOVERY SCRIPT)
-- =====================================================================================
-- TUJUAN: Skrip ini akan memulihkan data dalam jadual `public.users` dengan mengambil
--         maklumat daripada `auth.users` untuk SEMUA pengguna yang berdaftar.
--         Ia direka untuk dijalankan selepas `recover_users_from_affiliates.sql`
--         atau secara berasingan.
--
-- ARAHAN:
-- 1. Pergi ke dashboard Supabase projek anda.
-- 2. Pergi ke "SQL Editor".
-- 3. Salin dan tampal SEMUA kandungan fail ini ke dalam editor.
-- 4. Klik "RUN" untuk melaksanakan skrip.
-- =====================================================================================

-- Mulakan transaksi untuk memastikan semua operasi berjaya atau tiada apa yang berubah.
BEGIN;

-- Masukkan data pengguna yang hilang ke dalam jadual `public.users` daripada `auth.users`.
-- Ia hanya akan memasukkan pengguna yang belum wujud dalam `public.users`.
INSERT INTO public.users (user_id, email, role, payment_status, created_at)
SELECT
    u.id,                                -- Ambil id pengguna daripada jadual auth.users.
    u.email,                             -- Ambil email daripada jadual auth.users.
    'user' AS role,                      -- Tetapkan peranan lalai sebagai 'user'.
    'pending' AS payment_status,         -- Tetapkan status pembayaran lalai sebagai 'pending'.
    u.created_at                         -- Gunakan tarikh pendaftaran asal.
FROM
    auth.users AS u
WHERE
    -- Pastikan kita tidak memasukkan semula pengguna yang sudah ada dalam `public.users`.
    u.id NOT IN (SELECT user_id FROM public.users);

-- Commit transaksi untuk menyimpan perubahan.
COMMIT;

-- =====================================================================================
-- SELESAI. Sila semak jadual `public.users` anda untuk mengesahkan SEMUA data pengguna
-- telah dipulihkan.
-- =====================================================================================
