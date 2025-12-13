const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
// Note: It's generally better to use the service key for admin-level operations
// if you need to bypass RLS, but for user-specific updates, the anon key is fine
// as long as your RLS policies are correctly configured.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Using anon key, RLS must be set up properly.
const supabase = createClient(supabaseUrl, supabaseKey);

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

        // 2. Verify the token using Supabase's own helper
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            // Log the actual error for debugging
            console.error('Token verification error:', userError?.message);
            // Return a generic error to the client
            return res.status(401).json({ error: 'Invalid or expired token.' });
        }
        
        // 3. At this point, the user is authenticated. Proceed with the update.
        const userId = user.id;
        const { full_name, phone_number } = req.body;

        if (!full_name || !phone_number) {
            return res.status(400).json({ error: 'Full name and phone number are required.' });
        }

        // 4. Update the user's profile in the 'users' table
        const { error: updateError } = await supabase
            .from('users')
            .update({
                full_name: full_name,
                phone_number: phone_number,
            })
            .eq('user_id', userId);

        if (updateError) {
            console.error('Supabase update error:', updateError.message);
            // Check for specific errors, e.g., RLS violation
            if (updateError.code === '42501') { // RLS violation
                 return res.status(403).json({ error: 'You do not have permission to update this profile.' });
            }
            throw new Error('Failed to update user profile.');
        }

        // 5. Send success response
        res.status(200).json({ message: 'Profile updated successfully.' });

    } catch (error) {
        // Generic error handler for unexpected issues
        console.error('Error in /api/update-profile:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
};
