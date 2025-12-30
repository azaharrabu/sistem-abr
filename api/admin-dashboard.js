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

    // 3. Jika pengguna adalah admin, laksanakan logik untuk mendapatkan data.
    // Daripada menggunakan satu query JOIN yang kompleks, kita akan pecahkannya kepada dua bahagian untuk keteguhan.

    // Bahagian 1: Dapatkan semua pembayaran yang belum selesai.
    const { data: pendingPayments, error: paymentsError } = await supabase
      .from('payments')
      .select('id, user_id, amount, payment_date, payment_time, reference_no')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (paymentsError) {
      throw new Error(`Gagal mendapatkan bayaran tertunda: ${paymentsError.message}`);
    }

    if (!pendingPayments.length) {
      console.log('Tiada bayaran tertunda ditemui.');
      return res.status(200).json([]); // Hantar array kosong jika tiada bayaran
    }

    // Bahagian 2: Dapatkan butiran pengguna untuk semua bayaran yang belum selesai dalam satu query.
    const userIds = pendingPayments.map(p => p.user_id);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('user_id, email, full_name, phone_number, subscription_plan')
      .in('user_id', userIds);

    if (usersError) {
        throw new Error(`Gagal mendapatkan butiran pengguna: ${usersError.message}`);
    }

    // Buat pemetaan pengguna dengan user_id sebagai kunci untuk akses mudah.
    const userMap = users.reduce((map, user) => {
        map[user.user_id] = user;
        return map;
    }, {});

    // 4. Format data untuk sepadan dengan jangkaan frontend
    const formattedData = pendingPayments.map(p => {
      const user = userMap[p.user_id] || {}; // Cari pengguna yang sepadan
      return {
        payment_id: p.id, // Guna 'id' dari jadual 'payments'
        user_id: p.user_id,
        email: user.email || 'N/A',
        full_name: user.full_name || 'N/A',
        phone_number: user.phone_number || 'N/A',
        subscription_plan: user.subscription_plan || 'N/A',
        reference_no: p.reference_no,
        payment_date: p.payment_date,
        payment_time: p.payment_time,
        amount: p.amount
      };
    });


    // 5. Hantar data pembayaran yang belum selesai sebagai tindak balas
    return res.status(200).json(formattedData);

  } catch (err) {
    // Tangani sebarang ralat lain (cth: token tidak sah, masalah server)
    console.error('Admin Dashboard Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
