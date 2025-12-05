-- This script removes the faulty trigger and function that were causing issues with user profile creation.
-- The trigger `on_auth_user_created` and its function `handle_new_user` are being replaced by a direct RPC call
-- to the `create_user_and_profile` function from the `api/signup.js` endpoint.

DROP TRIGGER on_auth_user_created ON auth.users;
DROP FUNCTION public.handle_new_user;
