-- =====================================================================================
-- DATABASE FUNCTION: get_all_users_with_status
-- =====================================================================================
-- TUJUAN: Fungsi ini direka untuk menyelesaikan masalah data tidak konsisten di
--         papan pemuka admin. Ia mendapatkan semua pengguna dan menggabungkannya
--         dengan status pembayaran TERKINI dari jadual `payments`.
--
--         Ini lebih mantap daripada bergantung pada lajur `payment_status` yang
--         didenormalisasi pada jadual `users`, yang boleh menjadi lapuk.
--
-- CARA PENGGUNAAN:
--   1. Laksanakan skrip SQL ini dalam Editor SQL Supabase anda untuk mencipta fungsi.
--   2. Kemas kini endpoint API (`/api/users`) untuk memanggil fungsi ini
--      menggunakan `supabase.rpc('get_all_users_with_status')`.
-- =====================================================================================

CREATE OR REPLACE FUNCTION public.get_all_users_with_status()
RETURNS TABLE(
    -- Lajur terus dari jadual 'users'
    user_id uuid,
    full_name text,
    phone_number text,
    email text,
    created_at timestamptz,
    subscription_end_date timestamptz,
    subscription_plan text,

    -- Status pembayaran yang diperoleh secara dinamik
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
        u.subscription_end_date,
        u.subscription_plan,

        -- Jika terdapat rekod pembayaran terkini, gunakan statusnya.
        -- Jika tidak, kembali kepada status yang disimpan pada pengguna (cth: 'awaiting_payment').
        -- Ini memberikan status yang paling tepat pada masanya.
        COALESCE(lp.status, u.payment_status) AS payment_status
    FROM
        public.users u
    LEFT JOIN LATERAL (
        -- Cari rekod pembayaran terbaru untuk pengguna
        SELECT
            p.status
        FROM
            public.payments p
        WHERE
            p.user_id = u.user_id
        ORDER BY
            -- Isih mengikut tarikh dicipta untuk mencari yang terkini
            p.created_at DESC
        LIMIT 1
    ) lp ON true
    ORDER BY
        u.created_at DESC;
END;
$$;

-- Mesej pengesahan
SELECT 'Fungsi get_all_users_with_status() berjaya dicipta.' AS status;
