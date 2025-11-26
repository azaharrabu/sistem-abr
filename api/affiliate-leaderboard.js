// api/affiliate-leaderboard.js
const { createClient } = require('@supabase/supabase-js');

// Inisialisasi Supabase client menggunakan environment variables
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
        // Ini adalah query yang lebih kompleks untuk mendapatkan data leaderboard.
        // Kita perlu menggunakan rpc() untuk memanggil fungsi pangkalan data,
        // kerana JOIN antara jadual tidak disokong secara terus oleh RLS dengan mudah.
        // Kita akan cipta fungsi 'get_leaderboard' di Supabase.
        
        // Untuk sekarang, kita akan guna query yang lebih mudah.
        // AMARAN: Ini mungkin perlahan jika anda mempunyai banyak jualan.
        // Penyelesaian yang lebih baik adalah dengan mencipta fungsi Postgres (rpc).

        // 1. Dapatkan semua affiliate
        const { data: affiliates, error: affiliatesError } = await supabase
            .from('affiliates')
            .select('id, user_id');
        
        if (affiliatesError) throw affiliatesError;

        // 2. Dapatkan semua jualan
        const { data: sales, error: salesError } = await supabase
            .from('sales')
            .select('affiliate_id, sale_amount');

        if (salesError) throw salesError;
        
        // 3. Dapatkan semua profil pengguna untuk mendapatkan emel
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('user_id, email');
        
        if (usersError) throw usersError;

        // 4. Proses data di backend
        const affiliateSales = {};

        sales.forEach(sale => {
            if (!affiliateSales[sale.affiliate_id]) {
                affiliateSales[sale.affiliate_id] = 0;
            }
            affiliateSales[sale.affiliate_id] += sale.sale_amount;
        });

        const leaderboard = affiliates.map(affiliate => {
            const userProfile = users.find(u => u.user_id === affiliate.user_id);
            return {
                name: userProfile ? userProfile.email : 'Pengguna Tidak Dikenali', // Guna emel sebagai nama
                total_sales: affiliateSales[affiliate.id] || 0
            };
        });

        // 5. Susun dan hadkan kepada 10 teratas
        const sortedLeaderboard = leaderboard
            .sort((a, b) => b.total_sales - a.total_sales)
            .slice(0, 10)
            .map((entry, index) => ({
                rank: index + 1,
                ...entry
            }));

        // 6. Hantar data sebagai respons
        return res.status(200).json(sortedLeaderboard);

    } catch (error) {
        console.error('Leaderboard API Error:', error.message);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
