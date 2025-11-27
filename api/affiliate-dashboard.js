const { createClient } = require('@supabase/supabase-js');
const { decode } = require('jsonwebtoken');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper untuk mengesahkan token dan mendapatkan ID pengguna
const getUserIdFromToken = (authHeader) => {
    if (!authHeader) {
        throw new Error('Authorization header is missing');
    }
    const token = authHeader.split(' ')[1];
    const decodedToken = decode(token);
    if (!decodedToken || !decodedToken.sub) {
        throw new Error('Invalid token');
    }
    return decodedToken.sub; // `sub` biasanya adalah user ID
};

module.exports = async (req, res) => {
    try {
        const userId = getUserIdFromToken(req.headers.authorization);

        // 1. Dapatkan maklumat affiliate
        const { data: affiliate, error: affiliateError } = await supabase
            .from('affiliates')
            .select('affiliate_code, commission_rate')
            .eq('user_id', userId)
            .single();

        if (affiliateError || !affiliate) {
            return res.status(404).json({ error: 'Affiliate profile not found.' });
        }

        // 2. Kira jumlah jualan yang berjaya
        const { data: sales, error: salesError } = await supabase
            .from('affiliate_sales')
            .select('amount', { count: 'exact' })
            .eq('affiliate_code', affiliate.affiliate_code)
            .eq('payment_status', 'paid'); // Hanya kira jualan yang sudah disahkan 'paid'

        if (salesError) {
            console.error('Error fetching affiliate sales:', salesError);
            throw new Error('Failed to fetch sales data.');
        }

        // Defensively handle sales data
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
        console.error('Affiliate Dashboard Error:', error);
        res.status(500).json({ error: error.message });
    }
};