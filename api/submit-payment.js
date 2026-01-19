// api/submit-payment.js
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./_utils/auth');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const {
      payment_date,
      payment_time,
      amount,
    } = req.body;

    console.log('Received payment submission:', req.body);

    if (!payment_date || !payment_time || !amount) {
      return res.status(400).json({ error: 'Sila lengkapkan semua butiran yang diperlukan.' });
    }

    // Upsert logic - Step 1: Check for an existing 'pending' payment
    const { data: existingPayment, error: findError } = await supabase
      .from('payments')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (findError) {
      console.error('Error finding pending payment:', findError.message);
      throw new Error('Ralat semasa mencari rekod pembayaran.');
    }

    const paymentPayload = {
      user_id: user.id,
      payment_date,
      payment_time,
      amount,
      reference_no: user.email,
      status: 'pending',
    };

    if (existingPayment) {
      // Step 3a: Update existing payment
      const { error: updateError } = await supabase
        .from('payments')
        .update(paymentPayload)
        .eq('id', existingPayment.id);
      
      if (updateError) {
        throw new Error(`Gagal mengemas kini rekod pembayaran sedia ada: ${updateError.message}`);
      }
      console.log(`Successfully updated existing pending payment for user: ${user.id}`);
    } else {
      // Step 3b: Insert new payment
      const { error: insertError } = await supabase
        .from('payments')
        .insert(paymentPayload);

      if (insertError) {
        throw new Error(`Gagal mencipta rekod pembayaran baharu: ${insertError.message}`);
      }
      console.log(`Successfully created new pending payment for user: ${user.id}`);
    }

    // Step 4: Update the user's main status to 'pending'
    const { error: userStatusError } = await supabase
      .from('users')
      .update({ payment_status: 'pending' })
      .eq('user_id', user.id);

    if (userStatusError) {
        // Log as a warning, as the primary payment submission was successful
        console.warn(`Could not update user's primary status to 'pending' for user ${user.id}: ${userStatusError.message}`);
    }

    // **NEW**: Notify admins about the new payment
    try {
      console.log('Fetching admin users for notification...');
      const { data: admins, error: adminError } = await supabase
        .from('users')
        .select('email')
        .eq('role', 'admin');

      if (adminError) {
        throw new Error(`Failed to fetch admins: ${adminError.message}`);
      }

      if (admins && admins.length > 0) {
        const adminEmails = admins.map(admin => admin.email);
        console.log(`Found ${adminEmails.length} admin(s). Sending notifications to: ${adminEmails.join(', ')}`);

        const host = req.headers.host;
        const adminDashboardUrl = `https://${host}/admin-dashboard`;

        const { data, error } = await resend.emails.send({
          from: 'Sistem ABR <noreply@abrbrillante.com>',
          to: adminEmails,
          subject: 'Notifikasi: Bayaran Baru Menunggu Kelulusan',
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2>Notifikasi Bayaran Baru</h2>
              <p>Satu bayaran baru telah dihantar dan memerlukan kelulusan anda.</p>
              <p><strong>Maklumat Pengguna:</strong></p>
              <ul>
                <li><strong>Email:</strong> ${user.email}</li>
              </ul>
              <p>Sila log masuk ke dashboard admin untuk menyemak dan meluluskan bayaran ini.</p>
              <a href="${adminDashboardUrl}" style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
                Pergi ke Dashboard Admin
              </a>
              <p style="font-size: 0.9em; color: #666; margin-top: 15px;">
                Ini adalah e-mel yang dijana secara automatik. Sila jangan balas.
              </p>
            </div>
          `,
        });

        if (error) {
          console.error('Failed to send admin notification email:', error);
        } else {
          console.log('Admin notification email sent successfully:', data.id);
        }
      } else {
        console.warn('No admin users found to notify.');
      }
    } catch (emailErr) {
      console.error('An error occurred during the admin notification process:', emailErr.message);
    }

    return res.status(200).json({ message: 'Bukti pembayaran berjaya dihantar dan sedang menunggu pengesahan admin.' });

  } catch (err) {
    console.error('Submit Payment API Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
