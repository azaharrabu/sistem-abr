// api/affiliate-leaderboard.js
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
        // Panggil fungsi RPC `get_leaderboard_data` untuk mendapatkan data papan pendahulu
        const { data: leaderboardData, error } = await supabase.rpc('get_leaderboard_data');

        if (error) {
            console.error('Error calling get_leaderboard_data function:', error.message);
            throw error;
        }

        // Hantar data yang telah diproses sebagai respons
        return res.status(200).json(leaderboardData);

    } catch (error) {
        console.error('Leaderboard API Error:', error.message);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};
