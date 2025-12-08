// api/competition-leaderboard.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { start_date, end_date } = req.query;

        // Simple validation
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Sila berikan tarikh mula dan tarikh tamat.' });
        }

        // Call the RPC function with parameters
        const { data: leaderboardData, error } = await supabase.rpc('get_competition_leaderboard', {
            p_start_date: start_date,
            p_end_date: end_date
        });

        if (error) {
            console.error('Error calling get_competition_leaderboard function:', error.message);
            throw error;
        }

        return res.status(200).json(leaderboardData);

    } catch (error) {
        console.error('Competition Leaderboard API Error:', error.message);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};
