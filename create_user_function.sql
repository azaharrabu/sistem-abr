-- =====================================================================================
-- DATABASE FUNCTION: create_user_and_profile
-- =====================================================================================
-- PURPOSE: This function creates a new user record in the public.users table 
--          within a single, atomic transaction. It also incorporates the business 
--          logic for promotional pricing.
--
-- PARAMETERS:
--   - p_user_id: The user's ID from auth.users.
--   - p_email: The user's email.
--   - p_subscription_plan: The selected plan ('6-bulan' or '12-bulan').
--   - p_referred_by: (Optional) The user ID of the affiliate who referred this user.
--
-- SECURITY: Runs with the privileges of the user that defines it (creator), allowing
--           it to write to tables the calling user might not have direct access to.
-- =====================================================================================

CREATE OR REPLACE FUNCTION public.create_user_and_profile(
    p_user_id uuid,
    p_email text,
    p_subscription_plan text,
    p_referred_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    final_price numeric;
    is_promo_user boolean;
    user_count integer;
BEGIN
    -- Check the total number of users to determine promo eligibility
    SELECT count(*) INTO user_count FROM users;
    
    -- Users are eligible for promo if they are one of the first 100
    is_promo_user := user_count < 100;

    -- Set the price based on promo eligibility and the selected plan
    IF is_promo_user THEN
        IF p_subscription_plan = '6-bulan' THEN
            final_price := 50.00;
        ELSIF p_subscription_plan = '12-bulan' THEN
            final_price := 80.00;
        END IF;
    ELSE
        IF p_subscription_plan = '6-bulan' THEN
            final_price := 60.00;
        ELSIF p_subscription_plan = '12-bulan' THEN
            final_price := 100.00;
        END IF;
    END IF;

    -- Insert into public.users table
    INSERT INTO public.users (user_id, email, role, payment_status, subscription_plan, subscription_price, is_affiliate, referred_by, is_promo_user)
    VALUES (p_user_id, p_email, 'user', 'awaiting_payment', p_subscription_plan, final_price, FALSE, p_referred_by, is_promo_user);
END;
$$;

-- =====================================================================================
-- USAGE:
-- SELECT create_user_and_profile(
--   'new-user-uuid-from-auth',
--   'new.user@example.com',
--   '6-bulan'
-- );
-- =====================================================================================
