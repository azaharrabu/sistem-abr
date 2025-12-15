const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { token, password } = req.body;

    if (!token || !password) {
        return res.status(400).json({ error: 'Token and new password are required.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    try {
        // 1. Verify the token and get the user associated with it
        const { data: { user }, error: sessionError } = await supabase.auth.getUser(token);

        if (sessionError || !user) {
            console.error('Password reset token is invalid or expired:', sessionError?.message);
            return res.status(401).json({ error: 'Invalid or expired token. Please request a new password reset link.' });
        }

        // 2. Update the user's password
        const { error: updateError } = await supabase.auth.updateUser({ password: password });

        if (updateError) {
            console.error('Supabase password update error:', updateError.message);
            return res.status(500).json({ error: 'Failed to update password.' });
        }

        res.status(200).json({ message: 'Password updated successfully. You can now log in with your new password.' });

    } catch (error) {
        console.error('Error in /api/reset-password:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
};
