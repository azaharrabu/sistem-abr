const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./_utils/auth'); // Use the project's standard auth utility

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
    try {
        // Use the verified user object from the project's standard auth utility
        console.log('DEBUG: Verifying user and getting ID...');
        const user = await verifyToken(req);
        const userId = user.id;
        console.log('DEBUG: User verified. UserID:', userId);

        // 1. Dapatkan maklumat affiliate (termasuk ID)
        console.log('DEBUG: Fetching affiliate info for userId:', userId);
        const { data: affiliate, error: affiliateError } = await supabase
            .from('affiliates')
            .select('id, commission_rate') // Ambil ID untuk query jualan
            .eq('user_id', userId)
            .single();

        if (affiliateError || !affiliate) {
            console.warn(`Affiliate profile not found for verified userId: ${userId}`);
            return res.status(404).json({ error: 'Affiliate profile not found.' });
        }
        console.log('DEBUG: Affiliate info found:', affiliate);

        // 2. Dapatkan semua jualan yang berkaitan dari jadual 'sales'
        console.log('DEBUG: Fetching sales for affiliate_id:', affiliate.id);
        const { data: sales, error: salesError, count: salesCount } = await supabase
            .from('sales')
            .select('sale_amount, commission_amount', { count: 'exact' })
            .eq('affiliate_id', affiliate.id); // Padankan menggunakan affiliate_id

        if (salesError) {
            console.error('Error fetching affiliate sales:', salesError);
            throw new Error('Failed to fetch sales data.');
        }
        console.log('DEBUG: Sales data from DB:', { sales, salesCount });

        const salesData = sales || [];

        // 3. Jumlahkan jualan dan komisyen dari data yang diterima
        const totalSalesAmount = salesData.reduce((sum, record) => sum + (record.sale_amount || 0), 0);
        const totalCommission = salesData.reduce((sum, record) => sum + (record.commission_amount || 0), 0);
        const totalSalesCount = salesCount || 0;
        console.log('DEBUG: Calculated totals:', { totalSalesAmount, totalCommission, totalSalesCount });

        // 4. Hantar data dashboard
        const commissionRate = parseFloat(affiliate.commission_rate);
        const validCommissionRate = isNaN(commissionRate) ? 0 : commissionRate;

        console.log('DEBUG: Sending final JSON response.');
        res.status(200).json({
            totalSalesAmount: totalSalesAmount.toFixed(2),
            totalCommission: totalCommission.toFixed(2),
            totalSalesCount: totalSalesCount,
            commissionRate: validCommissionRate
        });

    } catch (error) {
        console.error('Affiliate Dashboard Error:', error.message);
        // If verifyToken fails, it will throw an error with a specific message
        if (error.message.includes('Authentication failed')) {
            return res.status(401).json({ error: error.message });
        }
        // For other errors, return a generic 500
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
};
