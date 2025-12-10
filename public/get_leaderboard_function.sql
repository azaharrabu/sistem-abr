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
        -- Kira jumlah bayaran yang diluluskan untuk setiap e-mel affiliate
        SELECT
            p.reference_no AS affiliate_email,
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
        -- Dapatkan nama affiliate dari jadual public.users menggunakan e-mel
        COALESCE(NULLIF(TRIM(pu.full_name), ''), sa.affiliate_email, 'Pengguna Tidak Dikenali') AS name,
        sa.calculated_total_sales AS total_sales
    FROM
        affiliate_sales sa
    JOIN
        -- Padankan e-mel dari bayaran kepada e-mel dalam jadual auth.users
        auth.users u_auth ON sa.affiliate_email = u_auth.email
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
