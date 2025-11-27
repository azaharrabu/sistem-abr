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

// Fungsi untuk mengendalikan kelulusan bayaran
async function handleApprove(customerId) {
    // 1. Kemas kini status pengguna kepada 'paid'
    const { data: updatedUser, error: updateUserError } = await supabase
        .from('users')
        .update({ payment_status: 'paid' })
        .eq('user_id', customerId)
        .select('referred_by, subscription_price') // Dapatkan data untuk rekod jualan affiliate
        .single();

    if (updateUserError || !updatedUser) {
        throw new Error(`Failed to update user status: ${updateUserError?.message || 'User not found'}`);
    }

    // 2. Jika pengguna dirujuk oleh affiliate, cipta rekod jualan
    if (updatedUser.referred_by) {
        const affiliateCode = updatedUser.referred_by;
        const saleAmount = updatedUser.subscription_price;

        const { error: saleInsertError } = await supabase
            .from('affiliate_sales')
            .insert({
                affiliate_code: affiliateCode,
                customer_id: customerId,
                amount: saleAmount,
                payment_status: 'paid'
            });
        
        if (saleInsertError) {
            // Log ralat kritikal ini tetapi jangan gagalkan proses, kerana bayaran pengguna telah diluluskan.
            console.error(`CRITICAL: Failed to insert affiliate sale record for code ${affiliateCode}`, saleInsertError.message);
        } else {
            console.log(`Successfully recorded affiliate sale for code ${affiliateCode}`);
        }
    }

    // 3. Kemas kini status dalam jadual 'payments'
    const { error: paymentUpdateError } = await supabase
        .from('payments')
        .update({ status: 'approved' })
        .eq('user_id', customerId);

    if (paymentUpdateError) {
        // Ini tidak sepatutnya kritikal, tetapi perlu di-log
        console.warn('Warning: could not update payment record status', paymentUpdateError.message);
    }
}

// Fungsi untuk mengendalikan penolakan bayaran
async function handleReject(customerId) {
    // Kemas kini kedua-dua jadual kepada 'rejected'
    await supabase.from('users').update({ payment_status: 'rejected' }).eq('user_id', customerId);
    await supabase.from('payments').update({ status: 'rejected' }).eq('user_id', customerId);
}


module.exports = async (req, res) => {
  try {
    // Semua laluan memerlukan pengesahan token admin
    const user = await verifyToken(req);
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin) {
      return res.status(403).json({ error: 'Forbidden: You do not have admin privileges.' });
    }

    // Router berdasarkan kaedah HTTP
    if (req.method === 'GET') {
      // Logic untuk mendapatkan senarai bayaran tertunda (sedia ada)
      const { data: pendingPayments, error: fetchError } = await supabase
        .from('payments')
        .select('*, users (id, email, subscription_plan)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (fetchError) {
        throw new Error(`Fetch Pending Payments Error: ${fetchError.message}`);
      }
      return res.status(200).json(pendingPayments);

    } else if (req.method === 'POST') {
      // Logic untuk approve/reject (BARU)
      const parts = req.url.split('/').filter(Boolean); // e.g., ['api', 'users', '{customerId}', 'approve']
      if (parts.length !== 4) {
        return res.status(400).json({ error: 'Invalid API endpoint format.' });
      }

      const customerId = parts[2];
      const action = parts[3];

      if (action === 'approve') {
        await handleApprove(customerId);
        return res.status(200).json({ message: 'Payment approved successfully.' });
      } else if (action === 'reject') {
        await handleReject(customerId);
        return res.status(200).json({ message: 'Payment rejected successfully.' });
      } else {
        return res.status(400).json({ error: 'Invalid action.' });
      }
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

  } catch (err) {
    console.error('Users API General Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};