-- This script removes the old version of the create_user_and_profile function
-- that was incorrectly expecting a UUID for the referral parameter.
-- This resolves the function overloading error during signup.
DROP FUNCTION IF EXISTS public.create_user_and_profile(uuid, text, text, uuid);
