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
        // Kaedah yang lebih baik dan cekap berbanding query yang asal.

        // 1. Dapatkan semua jualan affiliate yang telah dibayar.
        const { data: sales, error: salesError } = await supabase
            .from('affiliate_sales')
            .select('affiliate_code, amount')
            .eq('payment_status', 'paid');

        if (salesError) throw salesError;

        // 2. Agregat jumlah jualan untuk setiap kod affiliate.
        const salesByCode = sales.reduce((acc, sale) => {
            const code = sale.affiliate_code;
            const amount = parseFloat(sale.amount) || 0;
            acc[code] = (acc[code] || 0) + amount;
            return acc;
        }, {});

        // 3. Dapatkan semua affiliate dan join dengan maklumat pengguna untuk mendapatkan emel.
        const { data: affiliates, error: affiliatesError } = await supabase
            .from('affiliates')
            .select(`
                affiliate_code,
                user_id,
                users (
                    email
                )
            `);
        
        if (affiliatesError) throw affiliatesError;

        // 4. Bina data papan pendahulu (leaderboard)
        const leaderboard = affiliates.map(affiliate => {
            const userEmail = affiliate.users ? affiliate.users.email : 'Pengguna Tidak Dikenali';
            return {
                name: userEmail,
                total_sales: salesByCode[affiliate.affiliate_code] || 0
            };
        });

        // 5. Susun mengikut jumlah jualan dan hadkan kepada 10 teratas
        const sortedLeaderboard = leaderboard
            .sort((a, b) => b.total_sales - a.total_sales)
            .slice(0, 10)
            .map((entry, index) => ({
                rank: index + 1,
                name: entry.name,
                // Pastikan jumlah jualan dalam format dua titik perpuluhan
                total_sales: parseFloat(entry.total_sales.toFixed(2)) 
            }));

        // 6. Hantar data sebagai respons
        return res.status(200).json(sortedLeaderboard);

    } catch (error) {
        console.error('Leaderboard API Error:', error.message);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
