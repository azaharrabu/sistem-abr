-- =====================================================================================
-- DATABASE FUNCTION: get_all_users_with_status (v10 - FILTERED)
-- =====================================================================================
-- TUJUAN: Versi ini mengemas kini fungsi untuk menapis senarai pengguna, hanya
--         menunjukkan pengguna yang telah membuat pembayaran yang berjaya.
--
-- PERUBAHAN:
--   1. Menambah klausa `WHERE` untuk menapis status.
--   2. Menggunakan `IN ('paid', 'approved')` untuk merangkumi rekod-rekod lama
--      yang mungkin masih menggunakan status 'approved'.
-- =====================================================================================

-- Langkah 1: Buang fungsi sedia ada.
DROP FUNCTION IF EXISTS public.get_all_users_with_status();

-- Langkah 2: Cipta semula fungsi dengan logik penapisan.
CREATE OR REPLACE FUNCTION public.get_all_users_with_status()
RETURNS TABLE(
    user_id uuid,
    full_name text,
    phone_number text,
    email text,
    created_at timestamptz,
    subscription_end_date text,
    subscription_plan text,
    payment_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.user_id,
        u.full_name,
        u.phone_number,
        u.email,
        u.created_at,
        u.subscription_end_date::text,
        u.subscription_plan,
        COALESCE(lp.status, u.payment_status) AS payment_status
    FROM
        public.users u
    LEFT JOIN LATERAL (
        SELECT p.status
        FROM public.payments p
        WHERE p.user_id = u.user_id
        ORDER BY p.created_at DESC
        LIMIT 1
    ) lp ON true
    -- TAPISAN: Hanya tunjukkan pengguna dengan bayaran yang berjaya.
    WHERE COALESCE(lp.status, u.payment_status) IN ('paid', 'approved')
    ORDER BY
        u.created_at DESC;
END;
$$;

-- Mesej pengesahan
SELECT 'Fungsi get_all_users_with_status() (v10 - FILTERED) berjaya dicipta.' AS status;