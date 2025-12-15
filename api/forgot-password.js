const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://sistemubbl.abrbrillante.com/reset-password.html',
        });

        if (error) {
            console.error('Supabase password reset error:', error.message);
            // Temporarily expose the error for debugging
            return res.status(500).json({ error: `Supabase error: ${error.message}` });
        }

        res.status(200).json({ message: 'If an account with this email exists, a password reset link has been sent.' });

    } catch (error) {
        console.error('Error in /api/forgot-password:', error.message);
        // Generic error handler
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
};
