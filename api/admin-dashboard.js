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

    // 3. Jika pengguna adalah admin, dapatkan data pembayaran yang belum selesai dari jadual 'payments'
    const { data: pendingPayments, error: paymentsError } = await supabase
      .from('payments')
      .select(`
        payment_id,
        amount,
        payment_date,
        payment_time,
        proof_url,
        reference_text,
        users (
          user_id,
          email,
          full_name,
          phone_number,
          subscription_plan
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (paymentsError) {
      // Jika terdapat ralat semasa mengambil data, hantar ralat server
      throw new Error(`Failed to fetch pending payments: ${paymentsError.message}`);
    }

    // 4. Format data untuk sepadan dengan jangkaan frontend
    const formattedData = pendingPayments.map(p => ({
      user_id: p.users ? p.users.user_id : null, // Penting untuk kelulusan/penolakan
      email: p.users ? p.users.email : 'N/A',
      full_name: p.users ? p.users.full_name : 'N/A',
      phone_number: p.users ? p.users.phone_number : 'N/A',
      subscription_plan: p.users ? p.users.subscription_plan : 'N/A',
      reference_text: p.reference_text,
      payment_date: p.payment_date,
      payment_time: p.payment_time,
      amount: p.amount,
      payment_id: p.payment_id
    }));


    // 5. Hantar data pembayaran yang belum selesai sebagai tindak balas
    return res.status(200).json(formattedData);

  } catch (err) {
    // Tangani sebarang ralat lain (cth: token tidak sah, masalah server)
    console.error('Admin Dashboard Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
