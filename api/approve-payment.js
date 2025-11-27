// api/approve-payment.js
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./_utils/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function isAdmin(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('user_id', userId)
    .single();
  return data && data.role === 'admin';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const adminUser = await verifyToken(req);
    if (!await isAdmin(adminUser.id)) {
      return res.status(403).json({ error: 'Forbidden: Admin privileges required.' });
    }

    const { customerId } = req.body;
    if (!customerId) {
        return res.status(400).json({ error: 'customerId is required.'});
    }

    // 1. Kemas kini status pengguna kepada 'paid'
    const { data: updatedUser, error: updateUserError } = await supabase
        .from('users')
        .update({ payment_status: 'paid' })
        .eq('user_id', customerId)
        .select('referred_by')
        .single();

    if (updateUserError || !updatedUser) {
        throw new Error(`Failed to update user status: ${updateUserError?.message || 'User not found'}`);
    }

    // 2. Cari bayaran 'pending', kemas kini kepada 'approved', dan dapatkan jumlahnya.
    const { data: approvedPayment, error: paymentError } = await supabase
        .from('payments')
        .update({ status: 'approved' })
        .eq('user_id', customerId)
        .eq('status', 'pending') // Pastikan hanya bayaran pending yang dikemas kini
        .select('amount')
        .single();

    if (paymentError || !approvedPayment) {
        console.warn(`Could not find a 'pending' payment record to approve for user ${customerId}. Affiliate sale cannot be recorded.`);
        return res.status(200).json({ message: 'Payment status for user updated, but no pending payment record was found to approve.' });
    }

    // 3. Jika pengguna dirujuk & jumlah bayaran > 0, cipta rekod jualan menggunakan jumlah dari rekod bayaran
    if (updatedUser.referred_by && approvedPayment.amount > 0) {
        const { error: saleInsertError } = await supabase
            .from('affiliate_sales')
            .insert({
                affiliate_code: updatedUser.referred_by,
                customer_id: customerId,
                amount: approvedPayment.amount, // Gunakan jumlah yang betul dari jadual payments
                payment_status: 'paid'
            });
        
        if (saleInsertError) {
            console.error(`CRITICAL: Failed to insert affiliate sale record for code ${updatedUser.referred_by}`, saleInsertError.message);
        } else {
            console.log(`Successfully recorded affiliate sale for code ${updatedUser.referred_by} with amount ${approvedPayment.amount}`);
        }
    }

    return res.status(200).json({ message: 'Payment approved successfully.' });

  } catch (err) {
    console.error('Approve Payment API Error:', err.message);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
};
