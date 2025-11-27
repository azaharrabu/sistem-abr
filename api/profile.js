// api/profile.js
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./_utils/auth');

// Inisialisasi Supabase client
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
    // 1. Sahkan token pengguna dari header
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed: Invalid token.' });
    }

    // 2. Dapatkan profil utama dari jadual 'users'
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      if (profileError && profileError.code === 'PGRST116') { // Tiada baris ditemui
        return res.status(404).json({ error: 'User profile not found.' });
      }
      throw profileError || new Error('User profile not found.');
    }

    // 3. Dapatkan maklumat affiliate (termasuk ID dan kadar komisyen)
    const { data: affiliateInfo, error: affiliateError } = await supabase
      .from('affiliates')
      .select('id, affiliate_code, commission_rate') // Dapatkan juga 'id'
      .eq('user_id', user.id)
      .single();

    if (affiliateError && affiliateError.code !== 'PGRST116') {
        throw affiliateError;
    }
    
    // 4. Gabungkan data dan kira jualan jika pengguna adalah affiliate
    profile.is_affiliate = !!affiliateInfo;
    if (affiliateInfo) {
      profile.affiliate_code = affiliateInfo.affiliate_code;
      
      // Kira statistik jualan menggunakan 'affiliate_id'
      const { data: sales, error: salesError } = await supabase
        .from('affiliate_sales')
        .select('amount')
        .eq('affiliate_id', affiliateInfo.id) // Guna 'affiliate_id' yang betul
        .eq('payment_status', 'paid');
      
      if (salesError) {
          // Jangan hentikan proses jika hanya query jualan gagal, cuma log ralat
          console.error('Sales query error:', salesError.message);
      }
      
      const salesData = sales || [];
      const totalSalesAmount = salesData.reduce((sum, sale) => sum + (parseFloat(sale.amount) || 0), 0);
      
      const commissionRate = parseFloat(affiliateInfo.commission_rate) || 0;
      const totalCommission = totalSalesAmount * (commissionRate / 100);

      // Tambah statistik pada profil untuk dihantar ke frontend
      profile.totalSalesAmount = totalSalesAmount.toFixed(2);
      profile.totalCommission = totalCommission.toFixed(2);
    }

    // 5. Hantar data profil yang telah digabungkan
    return res.status(200).json(profile);

  } catch (err) {
    console.error('Profile API Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
