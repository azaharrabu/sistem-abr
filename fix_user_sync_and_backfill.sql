-- fix_user_sync_and_backfill.sql
-- =====================================================================================
-- DATABASE SCRIPT: Backfill Missing User Profiles
-- =====================================================================================
-- PURPOSE: This script identifies users that exist in the `auth.users` table but are
--          missing a corresponding profile in the `public.users` table. It then inserts
--          the missing records into `public.users` to resolve data inconsistencies.
--
-- CONTEXT: Users were being created in the authentication system, but the function
--          responsible for creating their public profile (`create_user_and_profile`)
--          was failing silently or due to errors. This left the system in a state
--          where users could authenticate but not access their profiles, causing
--          login failures and downstream issues with affiliate tracking and leaderboards.
--
-- HOW TO RUN: Execute this script directly against the Supabase database. It is
--             idempotent, meaning it can be run multiple times without causing
--             harm, as it only inserts records that are confirmed to be missing.
-- =====================================================================================

DO $$
DECLARE
    -- Declare a variable to hold each user record from the auth table
    auth_user RECORD;
    -- Declare a counter to track how many profiles were backfilled
    inserted_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Memulakan proses pemulihan profil pengguna...';

    -- Loop through each user in `auth.users` that does not have a matching `user_id` in `public.users`
    FOR auth_user IN
        SELECT id, email, created_at FROM auth.users u
        WHERE NOT EXISTS (
            SELECT 1 FROM public.users pu WHERE pu.user_id = u.id
        )
    LOOP
        RAISE NOTICE 'Profil hilang untuk pengguna ID: %. Mencipta rekod...', auth_user.id;

        -- Insert the missing profile into `public.users` with default values.
        -- We assume a default subscription plan and price. These can be adjusted by the user later.
        -- 'payment_status' is set to 'awaiting_payment' as a safe default.
        INSERT INTO public.users (
            user_id,
            email,
            role,
            payment_status,
            subscription_plan,
            subscription_price,
            is_affiliate,
            created_at,
            is_promo_user
        )
        VALUES (
            auth_user.id,
            auth_user.email,
            'user',                         -- Default role
            'awaiting_payment',             -- Default payment status
            '6-bulan',                      -- Default plan
            60.00,                          -- Default price for the plan (non-promo)
            FALSE,                          -- Default affiliate status
            auth_user.created_at,           -- Use the original creation time
            FALSE                           -- Assume not a promo user for safety
        );

        inserted_count := inserted_count + 1;
        RAISE NOTICE 'Berjaya mencipta profil untuk e-mel: %', auth_user.email;
    END LOOP;

    RAISE NOTICE 'Proses pemulihan selesai. Jumlah profil yang dicipta: %', inserted_count;
END;
$$;