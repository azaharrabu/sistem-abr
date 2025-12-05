-- =====================================================================================
-- FIX: RECOVER MISSING USER PROFILE
-- =====================================================================================
-- PURPOSE: This script inserts the missing records for a user who was created in the
--          authentication system but not in the public application tables.
--
-- USER DETAILS (from error log):
-- User ID: 707764a0-35ac-4bca-9966-d09cea131928
-- Email:   testing55@gmail.com
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase project dashboard.
-- 2. Go to the "SQL Editor".
-- 3. Copy and paste the entire content of this script into the editor.
-- 4. Click "RUN" to execute the script.
-- =====================================================================================

BEGIN;

-- Step 1: Insert the missing record into the public.users table.
-- The ON CONFLICT clause ensures it doesn't fail if the record somehow already exists.
INSERT INTO public.users (user_id, email, role, payment_status, is_affiliate)
VALUES
    ('707764a0-35ac-4bca-9966-d09cea131928', 'testing55@gmail.com', 'user', 'pending', FALSE)
ON CONFLICT (user_id) DO NOTHING;

-- Step 2: Insert the missing record into the public.profiles table.
-- The ON CONFLICT clause ensures it doesn't fail if the profile already exists.
INSERT INTO public.profiles (user_id, email, is_promo_user)
VALUES
    ('707764a0-35ac-4bca-9966-d09cea131928', 'testing55@gmail.com', FALSE)
ON CONFLICT (user_id) DO NOTHING;

COMMIT;

-- =====================================================================================
-- COMPLETE. The profile for 'testing55@gmail.com' should now be recovered.
-- Login should now proceed successfully.
-- =====================================================================================
