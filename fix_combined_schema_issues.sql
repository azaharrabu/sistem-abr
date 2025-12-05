-- =====================================================================================
-- FIX: ADD is_affiliate and is_promo_user COLUMNS
-- =====================================================================================
-- PURPOSE: This script addresses two separate schema errors:
--          1. Adds the 'is_affiliate' column to the 'users' table to fix profile loading.
--          2. Adds the 'is_promo_user' column to the 'profiles' table to fix new user signups.
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase project dashboard.
-- 2. Go to the "SQL Editor".
-- 3. Copy and paste the entire content of this script into the editor.
-- 4. Click "RUN" to execute the script.
-- =====================================================================================

BEGIN;

-- Step 1: Add the 'is_affiliate' column to the 'users' table if it doesn't exist.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_affiliate BOOLEAN DEFAULT FALSE;

-- Step 2: Update the 'is_affiliate' flag for existing affiliates.
UPDATE public.users
SET is_affiliate = TRUE
WHERE
    user_id IN (SELECT user_id FROM public.affiliates);

-- Step 3: Add the 'is_promo_user' column to the 'profiles' table if it doesn't exist.
-- This is needed to fix the signup error.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_promo_user BOOLEAN DEFAULT FALSE;

COMMIT;

-- =====================================================================================
-- COMPLETE. The 'users' and 'profiles' tables have been updated.
-- Both the profile loading and signup errors should now be resolved.
-- =====================================================================================
