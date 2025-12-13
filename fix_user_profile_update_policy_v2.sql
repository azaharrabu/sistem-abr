-- Drop the existing update policy if it exists
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.users;

-- Create a new, simplified policy for updating user profiles
-- This policy allows a user to update their own row in the 'users' table.
-- The check ensures that the 'user_id' of the row being updated
-- matches the ID of the currently authenticated user.
CREATE POLICY "Allow individual users to update their own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
