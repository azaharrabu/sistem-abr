// api/users/index.js
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('../_utils/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Fungsi untuk menyemak peranan admin
async function isAdmin(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    console.error('Error checking admin role:', error.message);
    return false;
  }
  
  return data && data.role === 'admin';
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Sahkan token dan dapatkan pengguna
    const user = await verifyToken(req);

    // 2. Semak jika pengguna adalah admin
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin) {
      return res.status(403).json({ error: 'Forbidden: You do not have admin privileges.' });
    }

    // 3. Dapatkan semua bayaran yang berstatus 'pending' beserta maklumat pengguna
    // Rujuk dokumentasi Supabase untuk 'foreign table relationship': table(column1, column2)
    const { data: pendingPayments, error: fetchError } = await supabase
      .from('payments')
      .select(`
        *,
        users (
          user_id,
          email,
          subscription_plan
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Fetch Pending Payments Error:', fetchError.message);
      return res.status(500).json({ error: 'Failed to fetch pending payments.' });
    }

    // 4. Hantar data
    return res.status(200).json(pendingPayments);

  } catch (err) {
    console.error('Get Users API Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
