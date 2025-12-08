-- SQL function to get all users with their affiliate sales and commission stats.
-- This function correctly joins the necessary tables and calculates the totals.

CREATE OR REPLACE FUNCTION get_users_with_affiliate_stats()
RETURNS TABLE (
    full_name text,
    email text,
    role text,
    subscription_plan text,
    subscription_end_date date,
    payment_status text,
    created_at timestamptz,
    total_sales numeric,
    total_commission numeric
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.full_name,
        u.email,
        u.role,
        u.subscription_plan,
        u.subscription_end_date,
        u.payment_status,
        u.created_at,
        COALESCE(s.total_sales, 0) as total_sales,
        COALESCE(s.total_commission, 0) as total_commission
    FROM
        public.users u
    LEFT JOIN
        public.affiliates a ON u.user_id = a.user_id
    LEFT JOIN (
        SELECT
            sales.affiliate_id,
            SUM(sales.sale_amount) as total_sales,
            SUM(sales.commission_amount) as total_commission
        FROM
            public.sales
        GROUP BY
            sales.affiliate_id
    ) s ON a.id = s.affiliate_id
    ORDER BY
        u.created_at DESC;
END;
$$ LANGUAGE plpgsql;


-- Function to get a summary of unpaid sales with affiliate details.
-- This resolves the nested query issue in the process-payouts API.
CREATE OR REPLACE FUNCTION get_unpaid_sales_summary()
RETURNS TABLE (
    sale_id bigint,
    commission_amount numeric,
    affiliate_id bigint,
    affiliate_name text,
    affiliate_email text
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id as sale_id,
        s.commission_amount,
        a.id as affiliate_id,
        u.full_name as affiliate_name,
        u.email as affiliate_email
    FROM
        public.sales s
    JOIN
        public.affiliates a ON s.affiliate_id = a.id
    JOIN
        public.users u ON a.user_id = u.user_id
    WHERE
        s.payout_status = 'unpaid';
END;
$$ LANGUAGE plpgsql;

