const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 1. Extract token from the Authorization header
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Authentication token not provided.' });
        }

        // 2. Create a new Supabase client FOR THIS REQUEST, authenticated with the user's token.
        // This is the correct way to handle user-specific operations in a serverless environment.
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            }
        );

        // 3. Verify the token and get the user.
        // Since the client is now authenticated, we can just call getUser().
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error('Token verification error:', userError?.message);
            return res.status(401).json({ error: 'Invalid or expired token.' });
        }
        
        // 4. The user is authenticated. Proceed with the update.
        const { full_name, phone_number } = req.body;

        if (!full_name || !phone_number) {
            return res.status(400).json({ error: 'Full name and phone number are required.' });
        }

        // 5. Upsert the user's profile.
        // The RLS policies we created will now work because auth.uid() is correctly identified.
        const { error: upsertError } = await supabase
            .from('users')
            .upsert({
                user_id: user.id, // Match the user's own ID
                full_name: full_name,
                phone_number: phone_number,
                email: user.email // Keep email in sync
            }, {
                onConflict: 'user_id'
            });

        if (upsertError) {
            console.error('Supabase upsert error:', upsertError.message);
            // Check for RLS violation, though it shouldn't happen now
            if (upsertError.code === '42501') { 
                 return res.status(403).json({ error: 'You do not have permission to update this profile.' });
            }
            // Use a more generic message for other database errors
            throw new Error('An error occurred during profile update.');
        }

        // 6. Send success response
        res.status(200).json({ message: 'Profile updated successfully.' });

    } catch (error) {
        console.error('Error in /api/update-profile:', error.message);
        // Avoid leaking detailed error messages to the client
        res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
};
