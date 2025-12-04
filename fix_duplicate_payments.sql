-- SQL to create a database function that atomically handles new payments.
-- This prevents race conditions by checking for existing payments and inserting a new one
-- within a single, uninterruptible transaction.

CREATE OR REPLACE FUNCTION handle_new_payment(
    p_user_id uuid,
    p_user_email text,
    p_payment_date date,
    p_payment_time time,
    p_amount numeric,
    p_full_name text,
    p_phone_number text
)
RETURNS text AS $$
DECLARE
    payment_count int;
BEGIN
    -- First, check for existing 'pending' or 'paid' payments for the given user.
    -- This entire block runs as a transaction, so it's safe from race conditions.
    SELECT count(*)
    INTO payment_count
    FROM public.payments
    WHERE user_id = p_user_id AND status IN ('pending', 'paid');

    -- If a payment is found (count > 0), return 'conflict' to stop the process.
    IF payment_count > 0 THEN
        RETURN 'conflict';
    END IF;

    -- If no conflicting payment is found, insert the new payment record.
    INSERT INTO public.payments (user_id, reference_no, payment_date, payment_time, amount, status)
    VALUES (p_user_id, p_user_email, p_payment_date, p_payment_time, p_amount, 'pending');

    -- Also, update the user's profile with their details and set their status to 'pending'.
    UPDATE public.customers
    SET 
        payment_status = 'pending',
        full_name = p_full_name,
        phone_number = p_phone_number
    WHERE user_id = p_user_id;

    -- Return 'success' if all operations complete without errors.
    RETURN 'success';

EXCEPTION
    WHEN OTHERS THEN
        -- If any error occurs during the transaction (e.g., a constraint violation),
        -- return 'error'. The transaction will be automatically rolled back.
        RETURN 'error';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;