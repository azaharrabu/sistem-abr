-- This policy allows users to update their own profiles in the 'users' table.
-- It checks that the user ID of the person making the request (auth.uid())
-- matches the user_id of the row they are trying to update.
CREATE POLICY "Allow users to update their own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
