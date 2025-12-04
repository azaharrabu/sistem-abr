// api/users/index.js
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('../_utils/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Fungsi untuk menyemak peranan admin
async function isAdmin(userId) {
  // Menggunakan .maybeSingle() untuk mengelakkan ralat jika tiada rekod ditemui.
  // Ia akan mengembalikan `null` jika tiada baris, dan bukannya error.
  const { data, error } = await supabase
    .from('customers')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    // Ralat ini kini hanya akan berlaku untuk masalah pangkalan data sebenar, bukan baris sifar.
    console.error('Error checking admin role:', error.message);
    return false;
  }

  // Jika data adalah null (tiada pengguna ditemui) atau peranan bukan 'admin', kembalikan false.
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

    // 3. Dapatkan semua bayaran yang berstatus 'pending'
    const { data: pendingPayments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (paymentsError) {
      throw new Error(`Failed to fetch pending payments: ${paymentsError.message}`);
    }

    if (!pendingPayments || pendingPayments.length === 0) {
      return res.status(200).json([]);
    }

    // 4. Dapatkan user_id yang unik dari semua bayaran tertunda
    const userIds = [...new Set(pendingPayments.map(p => p.user_id))];

    // 5. Dapatkan semua profil pengguna yang sepadan dalam satu panggilan
    const { data: users, error: usersError } = await supabase
      .from('customers')
      .select('user_id, email')
      .in('user_id', userIds);

    if (usersError) {
      throw new Error(`Failed to fetch user profiles: ${usersError.message}`);
    }

    // 6. Gabungkan data bayaran dengan data pengguna (dalam memori)
    // Ini menggantikan 'JOIN' automatik yang gagal sebelum ini.
    const usersMap = new Map(users.map(u => [u.user_id, u]));
    const combinedData = pendingPayments.map(payment => {
      return {
        ...payment,
        users: usersMap.get(payment.user_id) || null
      };
    });

    // 7. Hantar data yang telah digabungkan
    return res.status(200).json(combinedData);

  } catch (err) {
    console.error('Fetch Pending Payments Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};