-- public/get_leaderboard_function.sql
DROP FUNCTION IF EXISTS public.get_leaderboard_data();

-- Cipta fungsi baharu untuk mendapatkan data papan pendahulu
-- Fungsi ini kini mengagregat jualan terus dari jadual 'sales' untuk memastikan data adalah selaras dengan dashboard affiliate.
CREATE OR REPLACE FUNCTION public.get_leaderboard_data()
RETURNS TABLE(rank BIGINT, name TEXT, total_sales NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH affiliate_sales AS (
        -- Agregat jualan untuk setiap affiliate
        SELECT
            a.id,
            COALESCE(SUM(s.sale_amount), 0) AS calculated_total_sales
        FROM
            public.affiliates a
        LEFT JOIN
            public.sales s ON a.id = s.affiliate_id
        GROUP BY
            a.id
    )
    SELECT
        ROW_NUMBER() OVER (ORDER BY sa.calculated_total_sales DESC) AS rank,
        COALESCE(NULLIF(TRIM(pu.full_name), ''), u.email, 'Pengguna Tidak Dikenali') AS name,
        sa.calculated_total_sales AS total_sales
    FROM
        affiliate_sales sa
    JOIN
        public.affiliates a ON sa.id = a.id
    JOIN
        auth.users u ON a.user_id = u.id
    JOIN
        public.users pu ON u.id = pu.user_id
    WHERE
        -- Hanya paparkan affiliate dengan langganan aktif
        pu.payment_status = 'paid'
    ORDER BY
        total_sales DESC
    LIMIT 100;
END;
$$;
