// api/approve-payment-v2.js
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./_utils/auth');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

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

    // 1. Fetch the user's profile to get subscription plan and referral info.
    const { data: userProfile, error: userFetchError } = await supabase
        .from('users')
        .select('user_id, email, full_name, subscription_plan, referred_by')
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

    console.log(`DEBUG: Found user ${userProfile.user_id} (${userProfile.email}) to approve.`);

    // 2. Calculate the new subscription end date.
    const newEndDate = new Date();
    const plan = userProfile.subscription_plan;
    let durationMonths = 0;
    if (plan && plan.includes('12')) {
        durationMonths = 12;
    } else if (plan && plan.includes('6')) {
        durationMonths = 6;
    }
    
    if (durationMonths > 0) {
        newEndDate.setMonth(newEndDate.getMonth() + durationMonths);
    } else {
        console.warn(`Could not determine subscription duration for plan: "${plan}". Subscription end date will not be updated.`);
    }

    // 3. Update user's payment status and subscription end date.
    const updatePayload = { payment_status: 'paid' };
    if (durationMonths > 0) {
        updatePayload.subscription_end_date = newEndDate.toISOString();
    }

    const { error: updateUserError } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('user_id', userId);

    if (updateUserError) {
        console.error(`Error updating user status for userId: ${userId}`, updateUserError);
        throw new Error(`Failed to update user status: ${updateUserError.message}`);
    }
    console.log(`Successfully updated user ${userId} status to 'paid' and set new end date to ${updatePayload.subscription_end_date}.`);
    
    // 4. Find the user's pending payment and update it to 'paid'.
    const { data: paidPayments, error: paymentError } = await supabase
        .from('payments')
        .update({ status: 'paid' })
        .eq('user_id', userId)
        .eq('status', 'pending')
        .select('amount');

    if (paymentError) {
        throw new Error(`Error updating payment: ${paymentError.message}`);
    }

    if (!paidPayments || paidPayments.length === 0) {
        console.warn(`Could not find a 'pending' payment record for user ${userId}.`);
        // We don't exit here because the main user status was updated.
    }
    
    const paymentForSale = paidPayments ? paidPayments[0] : null;

    // 5. If the user was referred, create a sales record for the affiliate.
    // Nested check to prevent TypeError if paymentForSale is undefined.
    if (userProfile.referred_by && paymentForSale) {
        if (paymentForSale.amount > 0) {
            console.log(`User was referred by affiliate with code: ${userProfile.referred_by}. Attempting to record sale.`);
            
            const { data: affiliate, error: affiliateError } = await supabase
                .from('affiliates')
                .select('id, commission_rate')
                .eq('affiliate_code', userProfile.referred_by) 
                .single();

            if (affiliateError || !affiliate) {
                console.error(`CRITICAL: Could not find affiliate with code: ${userProfile.referred_by}. Sale not recorded.`);
            } else {
                console.log(`Found affiliate with id: ${affiliate.id}. Preparing to insert sale record.`);
                const commissionRate = affiliate.commission_rate || 0.10;
                const commissionAmount = paymentForSale.amount * commissionRate;

                const { error: saleInsertError } = await supabase
                    .from('sales')
                    .insert({
                        affiliate_id: affiliate.id,
                        purchaser_user_id: userId,
                        sale_amount: paymentForSale.amount,
                        commission_rate: commissionRate,
                        commission_amount: commissionAmount,
                        payout_status: 'unpaid'
                    });
                
                if (saleInsertError) {
                    console.error(`CRITICAL: Failed to insert sale record for affiliate ID ${affiliate.id}`, saleInsertError.message);
                    throw new Error(`Failed to insert sale record: ${saleInsertError.message}`);
                } else {
                    console.log(`Successfully recorded sale for affiliate ID ${affiliate.id} with amount ${paymentForSale.amount}`);
                }
            }
        }
    }

    // 6. Send success notification email to the user
    try {
        if (!process.env.RESEND_API_KEY) {
            console.warn('RESEND_API_KEY is not set. Skipping email notification.');
        } else {
            const { data, error } = await resend.emails.send({
                from: 'Sistem ABR <noreply@abrbrillante.com>',
                to: [userProfile.email],
                subject: 'Langganan Diaktifkan - Pembayaran Anda Telah Diluluskan',
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                            <h2 style="color: #0056b3;">Tahniah, ${userProfile.full_name || 'Ahli Baru'}!</h2>
                            <p>Pembayaran anda telah berjaya disahkan dan langganan anda kini telah diaktifkan.</p>
                            <p>Butiran langganan anda:</p>
                            <ul style="list-style-type: none; padding: 0;">
                                <li style="margin-bottom: 10px;"><strong>Pelan:</strong> ${userProfile.subscription_plan || 'N/A'}</li>
                                <li><strong>Aktif Sehingga:</strong> ${formatDate(updatePayload.subscription_end_date)}</li>
                            </ul>
                            <p>Sila klik butang di bawah untuk log masuk ke akaun anda dan mula mengakses sistem.</p>
                            <a href="https://sistemubbl.abrbrillante.com/" style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">Log Masuk ke Sistem</a>
                            <p style="font-size: 0.9em; color: #666; margin-top: 15px;">
                                Anda boleh log masuk menggunakan e-mel dan kata laluan yang anda daftarkan. Jika anda terlupa kata laluan anda, anda boleh menetapkannya semula melalui pautan 'Lupa Kata Laluan?' di halaman log masuk.
                            </p>
                            <p style="margin-top: 20px;">Terima kasih kerana melanggan.</p>
                            <br>
                            <p>Yang benar,</p>
                            <p><strong>Team ABR Brillante</strong></p>
                        </div>
                    </div>
                `
            });

            if (error) {
                // Log the error but don't block the API from returning success
                console.error(`EMAIL_ERROR: Failed to send approval email to ${userProfile.email}`, error);
            } else {
                console.log(`Successfully sent approval email to ${userProfile.email}. Message ID: ${data.id}`);
            }
        }
    } catch (emailError) {
        console.error(`EMAIL_EXCEPTION: An exception occurred while trying to send email to ${userProfile.email}`, emailError);
    }

    return res.status(200).json({ message: 'Payment approved, subscription updated, and sale recorded successfully.' });

  } catch (err) {
    console.error('Approve Payment API Error:', err.message);
    // HANTAR RALAT SEBENAR KE FRONTEND UNTUK DEBUGGING
    return res.status(500).json({ error: err.message });
  }
};

// Helper function to format date for logging, to avoid code duplication
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('ms-MY', options);
}
