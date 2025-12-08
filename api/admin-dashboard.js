// api/admin-dashboard.js
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./_utils/auth');

// Inisialisasi Supabase client dengan Service Key untuk akses peringkat admin
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Fungsi bantuan untuk menyemak sama ada pengguna adalah admin
async function isAdmin(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('user_id', userId)
    .single(); // Menggunakan .single() kerana kita jangkakan satu pengguna unik

  if (error) {
    console.error('Error checking admin role:', error.message);
    return false;
  }

  return data && data.role === 'admin';
}

module.exports = async (req, res) => {
  // Hanya benarkan kaedah GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Sahkan token JWT dari header dan dapatkan ID pengguna
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // 2. Semak sama ada pengguna yang disahkan adalah seorang admin
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }

    // 3. If user is admin, get all user data with affiliate stats
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select(`
        full_name,
        email,
        role,
        subscription_plan,
        subscription_end_date,
        payment_status,
        created_at,
        affiliates (
          affiliate_code,
          sales (
            sale_amount,
            commission_amount
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    // Process the data to calculate totals and flatten the structure
    const processedUsers = allUsers.map(user => {
        let total_sales = 0;
        let total_commission = 0;
        
        // Supabase returns an array for one-to-one relationships, so we check the first element.
        const affiliate = user.affiliates && user.affiliates.length > 0 ? user.affiliates[0] : null;

        if (affiliate && affiliate.sales) {
            total_sales = affiliate.sales.reduce((sum, sale) => sum + (sale.sale_amount || 0), 0);
            total_commission = affiliate.sales.reduce((sum, sale) => sum + (sale.commission_amount || 0), 0);
        }

        // Create a new object without the nested 'affiliates' property
        const { affiliates, ...rest } = user;
        
        return {
            ...rest,
            total_sales,
            total_commission,
        };
    });

    // 4. Hantar data semua pengguna sebagai tindak balas
    return res.status(200).json(processedUsers);

  } catch (err) {
    // Tangani sebarang ralat lain (cth: token tidak sah, masalah server)
    console.error('Admin Dashboard Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
