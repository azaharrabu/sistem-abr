const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('../_utils/auth'); // Use the project's standard auth utility

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
    try {
        // Use the verified user object from the project's standard auth utility
        const user = await verifyToken(req);
        const userId = user.id;

        // 1. Dapatkan maklumat affiliate
        const { data: affiliate, error: affiliateError } = await supabase
            .from('affiliates')
            .select('affiliate_code, commission_rate')
            .eq('user_id', userId)
            .single();

        if (affiliateError || !affiliate) {
            // This can happen if a user is an affiliate but their record is faulty.
            console.warn(`Affiliate profile not found for verified userId: ${userId}`);
            return res.status(404).json({ error: 'Affiliate profile not found.' });
        }

        // 2. Kira jumlah jualan yang berjaya
        const { data: sales, error: salesError } = await supabase
            .from('affiliate_sales')
            .select('amount', { count: 'exact' })
            .eq('affiliate_code', affiliate.affiliate_code)
            .eq('payment_status', 'paid');

        if (salesError) {
            console.error('Error fetching affiliate sales:', salesError);
            throw new Error('Failed to fetch sales data.');
        }

        // Defensively handle sales data being null or not an array
        const salesData = sales || [];

        const totalSalesAmount = salesData.reduce((sum, sale) => {
            const amount = parseFloat(sale.amount);
            return sum + (isNaN(amount) ? 0 : amount);
        }, 0);
        const totalSalesCount = salesData.length;

        // 3. Defensively calculate commission
        const commissionRate = parseFloat(affiliate.commission_rate);
        const validCommissionRate = isNaN(commissionRate) ? 0 : commissionRate;
        const totalCommission = totalSalesAmount * (validCommissionRate / 100);

        // 4. Hantar data dashboard
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
