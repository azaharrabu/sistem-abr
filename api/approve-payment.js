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
    console.log('DEBUG: Received request to approve payment for customerId:', customerId); // TAMBAH LOG INI
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

    // 2. Cari bayaran 'pending' dan kemas kini kepada 'approved'
    const { data: approvedPayments, error: paymentError } = await supabase
        .from('payments')
        .update({ status: 'approved' })
        .eq('user_id', customerId)
        .eq('status', 'pending')
        .select('amount');

    if (paymentError) {
        throw new Error(`Error updating payment: ${paymentError.message}`);
    }

    if (!approvedPayments || approvedPayments.length === 0) {
        console.warn(`Could not find a 'pending' payment record for user ${customerId}.`);
        return res.status(200).json({ message: 'Payment status for user updated, but no pending payment record was found to approve.' });
    }
    
    const paymentForSale = approvedPayments[0];

    // 3. Jika pengguna dirujuk, cipta rekod jualan menggunakan affiliate_id
    if (updatedUser.referred_by && paymentForSale.amount > 0) {
        // Cari ID affiliate dan kadar komisen berdasarkan kod rujukan
        const { data: affiliate, error: affiliateError } = await supabase
            .from('affiliates')
            .select('id, commission_rate')
            .eq('affiliate_code', updatedUser.referred_by)
            .single();

        if (affiliateError || !affiliate) {
            console.error(`CRITICAL: Could not find affiliate with code: ${updatedUser.referred_by}. Sale not recorded.`);
        } else {
            // Masukkan rekod jualan ke dalam jadual 'sales'
            const { error: saleInsertError } = await supabase
                .from('sales')
                .insert({
                    affiliate_id: affiliate.id,
                    purchaser_user_id: customerId,
                    sale_amount: paymentForSale.amount
                    // 'commission_amount' akan dikira secara automatik oleh pangkalan data
                });
            
            if (saleInsertError) {
                console.error(`CRITICAL: Failed to insert sale record for affiliate ID ${affiliate.id}`, saleInsertError.message);
            } else {
                console.log(`Successfully recorded sale for affiliate ID ${affiliate.id} with amount ${paymentForSale.amount}`);
            }
        }
    }

    return res.status(200).json({ message: 'Payment approved successfully.' });

  } catch (err) {
    console.error('Approve Payment API Error:', err.message);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
};
