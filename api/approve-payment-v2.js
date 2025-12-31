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
  console.log('--- APPROVE-PAYMENT V2: EXECUTION STARTED ---');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    console.log('[STEP 1] Verifying admin token...');
    const adminUser = await verifyToken(req);
    if (!adminUser) throw new Error('Admin verification failed.');
    console.log('[STEP 1] Admin token verified.');

    console.log('[STEP 2] Checking admin privileges...');
    if (!await isAdmin(adminUser.id)) {
      return res.status(403).json({ error: 'Forbidden: Admin privileges required.' });
    }
    console.log('[STEP 2] Admin privileges confirmed.');

    const { userId } = req.body;
    console.log(`[STEP 3] Request received to approve payment for userId: ${userId}`);
    if (!userId) {
        return res.status(400).json({ error: 'userId is required.'});
    }

    console.log(`[STEP 4] Fetching user profile for userId: ${userId}...`);
    const { data: userProfile, error: userFetchError } = await supabase
        .from('users')
        .select('user_id, email, full_name, subscription_plan, referred_by')
        .eq('user_id', userId)
        .single();

    if (userFetchError) {
        console.error(`[ERROR-STEP 4] Error fetching user profile for userId: ${userId}`, userFetchError);
        return res.status(500).json({ error: `Database error while fetching user profile: ${userFetchError.message}` });
    }
    if (!userProfile) {
        console.error(`[ERROR-STEP 4] User profile with ID ${userId} not found.`);
        return res.status(404).json({ error: `User profile with ID ${userId} not found.` });
    }
    console.log(`[STEP 4] User profile found: ${userProfile.email}`);

    console.log('[STEP 5] Calculating new subscription end date...');
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
        console.log(`[STEP 5] Subscription plan is ${durationMonths} months. New end date: ${newEndDate.toISOString()}`);
    } else {
        console.warn(`[STEP 5] Could not determine subscription duration for plan: "${plan}". End date will not be updated.`);
    }

    console.log(`[STEP 6] Updating user record in database for userId: ${userId}...`);
    const updatePayload = { payment_status: 'paid' };
    if (durationMonths > 0) {
        updatePayload.subscription_end_date = newEndDate.toISOString();
    }

    const { error: updateUserError } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('user_id', userId);

    if (updateUserError) {
        console.error(`[ERROR-STEP 6] Error updating user status for userId: ${userId}`, updateUserError);
        throw new Error(`Failed to update user status: ${updateUserError.message}`);
    }
    console.log(`[STEP 6] User record updated successfully.`);
    
    console.log(`[STEP 7] Updating payment record in database for userId: ${userId}...`);
    const { data: approvedPayments, error: paymentError } = await supabase
        .from('payments')
        .update({ status: 'paid' })
        .eq('user_id', userId)
        .eq('status', 'pending')
        .select('amount');

    if (paymentError) {
        console.error(`[ERROR-STEP 7] Error updating payment record:`, paymentError);
        throw new Error(`Error updating payment: ${paymentError.message}`);
    }

    if (!approvedPayments || approvedPayments.length === 0) {
        console.warn(`[STEP 7] No 'pending' payment record found for user ${userId}.`);
    } else {
        console.log(`[STEP 7] Found and updated ${approvedPayments.length} payment record(s).`);
    }
    
    const paymentForSale = approvedPayments && approvedPayments.length > 0 ? approvedPayments[0] : null;
    console.log('[STEP 7] Payment record processing complete.');

    console.log('[STEP 8] Checking for affiliate referral...');
    if (userProfile.referred_by && paymentForSale && paymentForSale.amount > 0) {
        console.log(`[STEP 8] User was referred by: ${userProfile.referred_by}. Recording sale.`);
        
        console.log(`[STEP 8a] Fetching affiliate details...`);
        const { data: affiliate, error: affiliateError } = await supabase
            .from('affiliates')
            .select('id, commission_rate')
            .eq('affiliate_code', userProfile.referred_by) 
            .single();

        if (affiliateError || !affiliate) {
            console.error(`[ERROR-STEP 8a] Could not find affiliate with code: ${userProfile.referred_by}. Sale not recorded.`, affiliateError);
        } else {
            console.log(`[STEP 8b] Affiliate found (ID: ${affiliate.id}). Inserting sale record...`);
            const { error: saleInsertError } = await supabase
                .from('sales')
                .insert({
                    affiliate_id: affiliate.id,
                    purchaser_user_id: userId,
                    sale_amount: paymentForSale.amount,
                    commission_rate: affiliate.commission_rate
                });
            
            if (saleInsertError) {
                console.error(`[ERROR-STEP 8b] Failed to insert sale record for affiliate ID ${affiliate.id}`, saleInsertError);
            } else {
                console.log(`[STEP 8b] Sale recorded successfully for affiliate ID ${affiliate.id}.`);
            }
        }
    } else {
        console.log('[STEP 8] No affiliate referral to process.');
    }

    console.log('[STEP 9] Preparing to send approval email...');
    try {
        if (!process.env.RESEND_API_KEY) {
            console.warn('[EMAIL] RESEND_API_KEY not set. Skipping email notification.');
        } else {
            console.log(`[EMAIL] Sending approval email to ${userProfile.email}...`);
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
                console.error(`[EMAIL_ERROR] Failed to send approval email to ${userProfile.email}`, error);
            } else {
                console.log(`[EMAIL] Approval email sent successfully. Message ID: ${data.id}`);
            }
        }
    } catch (emailError) {
        console.error(`[EMAIL_EXCEPTION] Exception during email sending for ${userProfile.email}`, emailError);
    }
    console.log('[STEP 9] Email step complete.');
    
    console.log('--- APPROVE-PAYMENT V2: EXECUTION SUCCEEDED ---');
    return res.status(200).json({ message: 'Payment approved, subscription updated, and sale recorded successfully.' });

  } catch (err) {
    console.error('--- APPROVE-PAYMENT V2: EXECUTION FAILED ---');
    console.error('Approve Payment API Error:', err.message);
    console.error('Stack trace:', err.stack); // Also log the stack
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
};

// Helper function to format date for logging, to avoid code duplication
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('ms-MY', options);
}
