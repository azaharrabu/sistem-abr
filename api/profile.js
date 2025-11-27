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

    // 2. Dapatkan profil dari jadual 'users' menggunakan user_id yang disahkan
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') { // Kod ralat Supabase jika tiada baris ditemui
        return res.status(404).json({ error: 'User profile not found.' });
      }
      throw profileError;
    }

    // 3. Semak status affiliate: Dapatkan data affiliate jika wujud
    const { data: affiliateData, error: affiliateError } = await supabase
      .from('affiliates')
      .select('affiliate_code')
      .eq('user_id', user.id)
      .single();

    // Jika tiada ralat dan data affiliate ditemui, tambahkan pada profil
    if (!affiliateError && affiliateData) {
      profile.affiliate_code = affiliateData.affiliate_code;
    }

    // 4. Hantar data profil (yang kini mungkin mengandungi affiliate_code)
    return res.status(200).json(profile);

  } catch (err) {
    // Tangani ralat dari verifyToken atau pangkalan data
    console.error('Profile API Error:', err.message);
    // Hantar ralat pengesahan atau ralat server
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
