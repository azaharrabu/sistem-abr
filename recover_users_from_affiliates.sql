-- =====================================================================================
-- SKRIP PEMULIHAN PENGGUNA (RECOVERY SCRIPT)
-- =====================================================================================
-- TUJUAN: Skrip ini akan memulihkan data dalam jadual `public.users` dengan mengambil
--         maklumat daripada `public.affiliates` dan `auth.users`.
--
-- ARAHAN:
-- 1. Pergi ke dashboard Supabase projek anda.
-- 2. Pergi ke "SQL Editor".
-- 3. Salin dan tampal SEMUA kandungan fail ini ke dalam editor.
-- 4. Klik "RUN" untuk melaksanakan skrip.
-- =====================================================================================

-- Mulakan transaksi untuk memastikan semua operasi berjaya atau tiada apa yang berubah.
BEGIN;

-- Masukkan data pengguna ke dalam jadual `public.users` daripada jadual `public.affiliates`
-- dan `auth.users`.
-- Ia hanya akan memasukkan pengguna yang belum wujud dalam `public.users`.
INSERT INTO public.users (user_id, email, role, payment_status, created_at)
SELECT
    aff.user_id,                         -- Ambil user_id daripada jadual affiliates.
    auth_user.email,                     -- Ambil email daripada jadual auth.users.
    'user' AS role,                      -- Tetapkan peranan lalai sebagai 'user'.
    'rejected' AS payment_status,        -- Tetapkan status pembayaran lalai.
    auth_user.created_at                 -- Gunakan tarikh pendaftaran asal.
FROM
    public.affiliates AS aff
JOIN
    auth.users AS auth_user ON aff.user_id = auth_user.id
WHERE
    -- Pastikan kita tidak memasukkan semula pengguna yang sudah ada dalam `public.users`.
    aff.user_id NOT IN (SELECT user_id FROM public.users);

-- Commit transaksi untuk menyimpan perubahan.
COMMIT;

-- =====================================================================================
-- SELESAI. Sila semak jadual `public.users` anda untuk mengesahkan data telah dipulihkan.
-- =====================================================================================
