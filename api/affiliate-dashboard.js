// api/affiliate-dashboard.js
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('../_utils/auth'); // Andaikan kita ada fungsi helper untuk pengesahan token

// Inisialisasi Supabase client menggunakan environment variables
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
    // Hanya benarkan permintaan GET
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 1. Sahkan token JWT pengguna
        const user = await verifyToken(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication failed.' });
        }

        // 2. Dapatkan ID affiliate dari jadual 'affiliates' menggunakan user_id
        const { data: affiliate, error: affiliateError } = await supabase
            .from('affiliates')
            .select('id, affiliate_code')
            .eq('user_id', user.id)
            .single();

        if (affiliateError || !affiliate) {
            return res.status(404).json({ error: 'Affiliate profile not found for this user.' });
        }

        // 3. Kira jumlah jualan dan komisyen dari jadual 'sales'
        const { data: salesData, error: salesError } = await supabase
            .from('sales')
            .select('sale_amount, commission_amount')
            .eq('affiliate_id', affiliate.id);

        if (salesError) {
            throw salesError;
        }

        // 4. Lakukan pengiraan jumlah
        const total_sales_value = salesData.reduce((sum, sale) => sum + sale.sale_amount, 0);
        const total_commission_earned = salesData.reduce((sum, sale) => sum + sale.commission_amount, 0);

        // 5. Bina objek data untuk dihantar kembali ke frontend
        const dashboardData = {
            affiliate_code: affiliate.affiliate_code,
            total_sales_value: total_sales_value,
            total_commission_earned: total_commission_earned,
            // Anda boleh tambah data lain di sini pada masa hadapan, contohnya:
            // total_clicks: 0,
            // conversion_rate: 0,
            // recent_sales: salesData.slice(0, 5) // 5 jualan terbaharu
        };

        // 6. Hantar data kembali sebagai respons JSON
        return res.status(200).json(dashboardData);

    } catch (error) {
        console.error('API Error:', error.message);
        // Jika ralat adalah kerana token tidak sah dari verifyToken
        if (error.message.includes('Authentication')) {
             return res.status(401).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
