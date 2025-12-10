-- public/get_leaderboard_function.sql
DROP FUNCTION IF EXISTS public.get_leaderboard_data();

-- Cipta fungsi baharu untuk mendapatkan data papan pendahulu
-- Fungsi ini mengagregat jumlah jualan dari jadual 'payments' di mana statusnya 'approved'.
CREATE OR REPLACE FUNCTION public.get_leaderboard_data()
RETURNS TABLE(rank BIGINT, name TEXT, total_sales NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH affiliate_sales AS (
        -- Kira jumlah bayaran yang diluluskan untuk setiap kod rujukan (affiliate)
        SELECT
            p.reference_no,
            SUM(p.amount) AS calculated_total_sales
        FROM
            public.payments p
        WHERE
            p.status = 'approved' AND p.reference_no IS NOT NULL
        GROUP BY
            p.reference_no
    )
    SELECT
        ROW_NUMBER() OVER (ORDER BY sa.calculated_total_sales DESC) AS rank,
        -- Dapatkan nama affiliate dari jadual users
        COALESCE(NULLIF(TRIM(pu.full_name), ''), u_auth.email, 'Pengguna Tidak Dikenali') AS name,
        sa.calculated_total_sales AS total_sales
    FROM
        affiliate_sales sa
    JOIN
        -- Padankan kod rujukan dari bayaran kepada kod rujukan affiliate
        public.affiliates a ON sa.reference_no = a.referral_code
    JOIN
        auth.users u_auth ON a.user_id = u_auth.id
    JOIN
        public.users pu ON u_auth.id = pu.user_id
    WHERE
        -- Pastikan hanya affiliate yang aktif (status 'paid') dipaparkan di papan pendahulu
        pu.payment_status = 'paid'
    ORDER BY
        total_sales DESC
    LIMIT 100;
END;
$$;
