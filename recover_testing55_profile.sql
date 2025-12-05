-- =====================================================================================
-- FIX: RECOVER MISSING PROFILE FOR testing55@gmail.com
-- =====================================================================================
-- PURPOSE: This script inserts the missing public.users and public.profiles records
--          for a user who was created in the authentication system but whose
--          application records were not created due to a previous bug.
--
-- USER DETAILS:
-- User ID: 707764a0-35ac-4bca-9966-d09cea131928
-- Email:   testing55@gmail.com
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase project dashboard.
-- 2. Go to the "SQL Editor".
-- 3. Copy and paste the entire content of this script into the editor.
-- 4. Click "RUN" to execute the script.
-- =====================================================================================

-- Step 1: Insert the missing record into the public.users table.
-- The ON CONFLICT clause ensures it doesn't fail if the record somehow already exists.
-- We are setting default values for subscription plan and price as they are unknown.
-- These can be updated later if needed.
INSERT INTO public.users (user_id, email, role, payment_status, subscription_plan, subscription_price, is_affiliate)
VALUES
    ('707764a0-35ac-4bca-9966-d09cea131928', 'testing55@gmail.com', 'user', 'pending', '6-bulan', 50.00, FALSE)
ON CONFLICT (user_id) DO NOTHING;

-- Step 2: Insert the missing record into the public.profiles table.
-- The ON CONFLICT clause ensures it doesn't fail if the profile already exists.
INSERT INTO public.profiles (user_id, email, is_promo_user)
VALUES
    ('707764a0-35ac-4bca-9966-d09cea131928', 'testing55@gmail.com', TRUE)
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================================================
-- COMPLETE. The profile for 'testing55@gmail.com' should now be recovered.
-- After running this, the user should be visible in the admin panel for payment approval.
-- =====================================================================================
