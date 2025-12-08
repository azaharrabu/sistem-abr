-- public/get_competition_leaderboard.sql
DROP FUNCTION IF EXISTS public.get_competition_leaderboard(DATE, DATE);

-- Fungsi baru untuk mendapatkan data papan pendahulu berdasarkan tempoh (untuk pertandingan)
-- Menerima tarikh mula dan tamat sebagai parameter.
CREATE OR REPLACE FUNCTION public.get_competition_leaderboard(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE(rank BIGINT, name TEXT, total_sales NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    -- CTE untuk mengira jumlah jualan dalam tempoh yang ditetapkan
    WITH affiliate_sales_period AS (
        SELECT
            s.affiliate_id,
            SUM(s.sale_amount) AS total_sales_amount
        FROM
            public.sales s
        WHERE
            s.created_at >= p_start_date AND s.created_at < (p_end_date + INTERVAL '1 day') -- Include whole end day
        GROUP BY
            s.affiliate_id
    )
    SELECT
        ROW_NUMBER() OVER (ORDER BY COALESCE(sa.total_sales_amount, 0) DESC) AS rank,
        COALESCE(NULLIF(TRIM(pu.full_name), ''), u.email, 'Pengguna Tidak Dikenali') AS name,
        COALESCE(sa.total_sales_amount, 0) AS total_sales
    FROM
        public.affiliates a
    JOIN
        auth.users u ON a.user_id = u.id
    JOIN
        public.users pu ON u.id = pu.user_id
    -- Sertai CTE jualan tempoh
    LEFT JOIN
        affiliate_sales_period sa ON a.id = sa.affiliate_id
    WHERE
        pu.subscription_end_date >= NOW() -- Hanya paparkan affiliate yang langganannya aktif
    ORDER BY
        total_sales DESC
    LIMIT 10; -- Hanya paparkan 10 terbaik untuk meningkatkan persaingan
END;
$$;
