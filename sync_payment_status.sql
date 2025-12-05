-- =====================================================================================
-- SCRIPT PENYELARASAN STATUS PEMBAYARAN (SYNC PAYMENT STATUS SCRIPT)
-- =====================================================================================
-- TUJUAN: Skrip ini akan mengemas kini lajur 'payment_status' dalam jadual 'public.users'
--         berdasarkan rekod pembayaran TERKINI bagi setiap pengguna dari jadual 'public.payments'.
--         Ini akan membetulkan status yang tidak selaras selepas pemulihan data.
--
-- ARAHAN:
-- 1. Pergi ke dashboard Supabase projek anda.
-- 2. Pergi ke "SQL Editor".
-- 3. Salin dan tampal kandungan fail ini ke dalam editor.
-- 4. Klik "RUN" untuk melaksanakan skrip.
-- =====================================================================================

BEGIN;

-- Gunakan Common Table Expression (CTE) untuk mencari status pembayaran terkini bagi setiap pengguna.
WITH latest_payment_status AS (
    SELECT DISTINCT ON (user_id)
        user_id,
        status AS latest_status
    FROM
        public.payments
    -- Urutkan mengikut tarikh dan masa untuk memastikan rekod yang paling baru diambil.
    ORDER BY
        user_id, payment_date DESC, payment_time DESC
)
-- Kemas kini jadual 'users' dengan status yang ditemui.
UPDATE
    public.users u
SET
    payment_status = lps.latest_status
FROM
    latest_payment_status lps
WHERE
    u.user_id = lps.user_id
    -- Hanya kemas kini jika statusnya berbeza untuk mengelakkan penulisan yang tidak perlu.
    AND u.payment_status IS DISTINCT FROM lps.latest_status;

COMMIT;

-- =====================================================================================
-- SELESAI. Sila semak jadual `public.users` anda. Status pembayaran kini sepatutnya
-- selaras dengan rekod pembayaran terkini.
-- =====================================================================================
