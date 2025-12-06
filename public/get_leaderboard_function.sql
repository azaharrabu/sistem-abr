-- public/get_leaderboard_function.sql
DROP FUNCTION IF EXISTS public.get_leaderboard_data();

-- Cipta fungsi baru untuk mendapatkan data papan pendahulu
-- Versi ini telah dipermudahkan untuk membaca terus dari lajur total_sales yang telah diagregat,
-- menjadikan ia lebih efisien dan tepat.
CREATE OR REPLACE FUNCTION public.get_leaderboard_data()
RETURNS TABLE(rank BIGINT, name TEXT, total_sales NUMERIC)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ROW_NUMBER() OVER (ORDER BY a.total_sales DESC) AS rank,
        COALESCE(NULLIF(TRIM(pu.full_name), ''), u.email, 'Pengguna Tidak Dikenali') AS name,
        a.total_sales
    FROM
        public.affiliates a
    -- Gunakan INNER JOIN untuk memastikan setiap affiliate mempunyai rekod pengguna yang sah.
    JOIN
        auth.users u ON a.user_id = u.id
    -- Gunakan LEFT JOIN untuk mendapatkan nama penuh dari public.users (jika ada).
    LEFT JOIN
        public.users pu ON u.id = pu.user_id
    ORDER BY
        a.total_sales DESC
    LIMIT 10;
END;
$$;

