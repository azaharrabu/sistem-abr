const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const jwtSecret = process.env.JWT_SECRET;

// Helper to verify JWT token and get user
const verifyToken = (req) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        throw new Error('Authentication token not provided.');
    }
    try {
        const decoded = jwt.verify(token, jwtSecret);
        return decoded;
    } catch (error) {
        throw new Error('Invalid or expired token.');
    }
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const decodedToken = verifyToken(req);
        const userId = decodedToken.sub; // 'sub' is the standard claim for user ID in JWT

        if (!userId) {
            return res.status(401).json({ error: 'User ID not found in token.' });
        }

        const { full_name, phone_number } = req.body;

        if (!full_name || !phone_number) {
            return res.status(400).json({ error: 'Full name and phone number are required.' });
        }

        const { data, error } = await supabase
            .from('users')
            .update({
                full_name: full_name,
                phone_number: phone_number,
                // We can also mark the profile as 'complete' if there was such a flag
            })
            .eq('user_id', userId);

        if (error) {
            console.error('Supabase update error:', error);
            throw new Error('Failed to update user profile.');
        }

        res.status(200).json({ message: 'Profile updated successfully.' });

    } catch (error) {
        // Log the detailed error on the server
        console.error('Error updating profile:', error.message);
        // Send a more generic error message to the client
        res.status(401).json({ error: 'An error occurred during profile update. ' + error.message });
    }
};
