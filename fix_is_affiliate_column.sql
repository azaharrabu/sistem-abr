-- =====================================================================================
-- FIX: ADD is_affiliate COLUMN TO users TABLE
-- =====================================================================================
-- PURPOSE: This script adds the missing 'is_affiliate' boolean column to the 'public.users'
--          table and updates it based on whether the user exists in the 'public.affiliates' table.
--          This resolves the "column users.is_affiliate does not exist" error.
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase project dashboard.
-- 2. Go to the "SQL Editor".
-- 3. Copy and paste the entire content of this file into the editor.
-- 4. Click "RUN" to execute the script.
-- =====================================================================================

BEGIN;

-- Step 1: Add the 'is_affiliate' column to the 'users' table if it doesn't exist.
-- It will default to FALSE for all users.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_affiliate BOOLEAN DEFAULT FALSE;

-- Step 2: Update the 'is_affiliate' flag to TRUE for all users who are also in the 'affiliates' table.
UPDATE public.users
SET is_affiliate = TRUE
WHERE
    user_id IN (SELECT user_id FROM public.affiliates);

COMMIT;

-- =====================================================================================
-- COMPLETE. The 'users' table now has the 'is_affiliate' column and it has been
-- populated. The profile loading error should now be resolved.
-- =====================================================================================
