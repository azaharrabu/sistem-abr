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

    // 3. Jika pengguna adalah admin, dapatkan semua data pengguna dari jadual 'users'
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('full_name, email, role, phone_number, subscription_plan, subscription_end_date, payment_status, created_at')
      .order('created_at', { ascending: false });

    if (usersError) {
      // Jika terdapat ralat semasa mengambil data, hantar ralat server
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    // 4. Hantar data semua pengguna sebagai tindak balas
    return res.status(200).json(allUsers);

  } catch (err) {
    // Tangani sebarang ralat lain (cth: token tidak sah, masalah server)
    console.error('Admin Dashboard Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
