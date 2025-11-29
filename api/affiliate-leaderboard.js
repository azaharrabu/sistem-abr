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
        // 1. Dapatkan semua jualan dari jadual 'sales' yang betul.
        const { data: sales, error: salesError } = await supabase
            .from('sales') // BETULKAN: Guna nama jadual 'sales'
            .select('affiliate_id, sale_amount'); // Guna lajur 'sale_amount'

        if (salesError) throw salesError;

        // 2. Agregat jumlah jualan untuk setiap affiliate_id
        const salesById = sales.reduce((acc, sale) => {
            const id = sale.affiliate_id;
            const amount = parseFloat(sale.sale_amount) || 0;
            acc[id] = (acc[id] || 0) + amount;
            return acc;
        }, {});

        // 3. Dapatkan semua affiliate
        const { data: affiliates, error: affiliatesError } = await supabase
            .from('affiliates')
            .select('id, user_id');
        
        if (affiliatesError) throw affiliatesError;

        // Dapatkan emel pengguna yang sepadan
        const userIds = affiliates.map(a => a.user_id);
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('user_id, email')
            .in('user_id', userIds);

        if (usersError) throw usersError;

        // Cipta pemetaan (map) dari user_id ke emel untuk carian pantas
        const emailMap = users.reduce((acc, user) => {
            acc[user.user_id] = user.email;
            return acc;
        }, {});

        // 4. Bina data papan pendahulu (leaderboard)
        const leaderboard = affiliates.map(affiliate => {
            const userEmail = emailMap[affiliate.user_id] || 'Pengguna Tidak Dikenali';
            return {
                name: userEmail,
                total_sales: salesById[affiliate.id] || 0 // Padankan dengan affiliate.id
            };
        });

        // 5. Susun mengikut jumlah jualan dan hadkan kepada 10 teratas
        const sortedLeaderboard = leaderboard
            .sort((a, b) => b.total_sales - a.total_sales)
            .slice(0, 10)
            .map((entry, index) => ({
                rank: index + 1,
                name: entry.name,
                total_sales: parseFloat(entry.total_sales.toFixed(2)) 
            }));

        // 6. Hantar data sebagai respons
        return res.status(200).json(sortedLeaderboard);

    } catch (error) {
        console.error('Leaderboard API Error:', error.message);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
