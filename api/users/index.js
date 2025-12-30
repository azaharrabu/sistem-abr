// /api/users/index.js
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('../_utils/auth');

// Inisialisasi Supabase client dengan Service Key untuk akses peringkat admin
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Fungsi bantuan untuk menyemak sama ada pengguna adalah admin
async function isAdmin(userId) {
  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is 'No rows found', which is expected for non-admins.
    console.error('Error checking admin role:', error.message);
    return false;
  }
  
  return !!data; // Returns true if a record is found, false otherwise.
}
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Sahkan token JWT dari header
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // 2. Semak sama ada pengguna adalah admin
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }

    // 3. Dapatkan semua pengguna menggunakan fungsi pangkalan data untuk memastikan data konsisten
    const { data: users, error: usersError } = await supabase
      .rpc('get_all_users_with_status');

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    // 4. Hantar senarai pengguna
    res.setHeader('X-Api-Version', '2'); // Diagnostic header
    return res.status(200).json(users);

  } catch (err) {
    console.error('Fetch Users Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
