// api/approve-payment-v2.js
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
  
  if (error) {
    console.error('Error checking admin role:', error.message);
    return false;
  }
  
  return data && data.role === 'admin';
}

module.exports = async (req, res) => {
  console.log('--- EXECUTING LATEST VERSION OF approve-payment-v2.js ---');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const adminUser = await verifyToken(req);
    if (!await isAdmin(adminUser.id)) {
      return res.status(403).json({ error: 'Forbidden: Admin privileges required.' });
    }

    const { userId } = req.body;
    console.log('DEBUG: Received request to approve payment for userId:', userId);
    if (!userId) {
        return res.status(400).json({ error: 'userId is required.'});
    }

    // 1. Fetch the user's profile to ensure they exist.
    const { data: userProfile, error: userFetchError } = await supabase
        .from('users')
        .select('user_id, referred_by')
        .eq('user_id', userId)
        .single();

    if (userFetchError) {
        console.error(`Error fetching user profile for userId: ${userId}`, userFetchError);
        return res.status(500).json({ error: `Database error while fetching user profile: ${userFetchError.message}` });
    }

    if (!userProfile) {
        console.error(`User profile with ID ${userId} not found.`);
        return res.status(404).json({ error: `User profile with ID ${userId} not found.` });
    }

    console.log(`DEBUG: Found user ${userProfile.user_id} to approve.`);

    // 2. Update the user's payment status to 'paid' in the 'profiles' table.
    const { error: updateUserError } = await supabase
        .from('users')
        .update({ payment_status: 'paid' })
        .eq('user_id', userId);

    if (updateUserError) {
        console.error(`Error updating user status for userId: ${userId}`, updateUserError);
        throw new Error(`Failed to update user status: ${updateUserError.message}`);
    }
    
    // 3. Find the user's pending payment and update it to 'approved'.
    const { data: approvedPayments, error: paymentError } = await supabase
        .from('payments')
        .update({ status: 'approved' })
        .eq('user_id', userId)
        .eq('status', 'pending')
        .select('amount');

    if (paymentError) {
        throw new Error(`Error updating payment: ${paymentError.message}`);
    }

    if (!approvedPayments || approvedPayments.length === 0) {
        console.warn(`Could not find a 'pending' payment record for user ${userId}.`);
        return res.status(200).json({ message: 'Payment status for user updated, but no pending payment record was found to approve.' });
    }
    
    const paymentForSale = approvedPayments[0];

    // 4. If the user was referred, create a sales record for the affiliate.
    if (userProfile.referred_by && paymentForSale.amount > 0) {
        // Find the affiliate's ID and commission rate based on the referral code.
        const { data: affiliate, error: affiliateError } = await supabase
            .from('affiliates')
            .select('id, commission_rate')
            .eq('affiliate_code', userProfile.referred_by)
            .single();

        if (affiliateError || !affiliate) {
            console.error(`CRITICAL: Could not find affiliate with code: ${userProfile.referred_by}. Sale not recorded.`);
        } else {
            // Insert the sales record into the 'sales' table.
            const { error: saleInsertError } = await supabase
                .from('sales')
                .insert({
                    affiliate_id: affiliate.id,
                    purchaser_user_id: userId,
                    sale_amount: paymentForSale.amount
                    // 'commission_amount' will be calculated automatically by the database.
                });
            
            if (saleInsertError) {
                console.error(`CRITICAL: Failed to insert sale record for affiliate ID ${affiliate.id}`, saleInsertError.message);
            } else {
                console.log(`Successfully recorded sale for affiliate ID ${affiliate.id} with amount ${paymentForSale.amount}`);
            }
        }
    }

    return res.status(200).json({ message: 'Payment approved and sale recorded successfully.' });

  } catch (err) {
    console.error('Approve Payment API Error:', err.message);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
};
