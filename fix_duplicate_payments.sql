-- SQL to create a database function that atomically handles new payments.
-- This prevents race conditions by checking for existing payments and inserting a new one
-- within a single, uninterruptible transaction.

CREATE OR REPLACE FUNCTION handle_new_payment(
    p_user_id uuid,
    p_user_email text,
    p_payment_date date,
    p_payment_time time,
    p_full_name text,
    p_phone_number text
)
RETURNS text AS $$
DECLARE
    payment_count int;
    subscription_amount numeric;
BEGIN
    -- This entire block runs as a transaction, safe from race conditions.

    -- 1. Check for existing 'pending' or 'paid' payments for the given user.
    SELECT count(*)
    INTO payment_count
    FROM public.payments
    WHERE user_id = p_user_id AND status IN ('pending', 'paid');

    -- If a payment is found, return 'conflict'.
    IF payment_count > 0 THEN
        RETURN 'conflict';
    END IF;

    -- 2. Get the authoritative subscription price from the user's profile.
    SELECT subscription_price
    INTO subscription_amount
    FROM public.users
    WHERE user_id = p_user_id;

    -- If no price is found, something is wrong.
    IF subscription_amount IS NULL THEN
        RETURN 'error';
    END IF;

    -- 3. Insert the new payment record using the price from the database.
    INSERT INTO public.payments (user_id, reference_no, payment_date, payment_time, amount, status)
    VALUES (p_user_id, p_user_email, p_payment_date, p_payment_time, subscription_amount, 'pending');

    -- 4. Update the user's profile with their details and set payment status.
    UPDATE public.users
    SET 
        payment_status = 'pending',
        full_name = p_full_name,
        phone_number = p_phone_number
    WHERE user_id = p_user_id;

    -- Return 'success' if all operations complete.
    RETURN 'success';

EXCEPTION
    WHEN OTHERS THEN
        -- On any error, the transaction will be rolled back automatically.
        RETURN 'error';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;