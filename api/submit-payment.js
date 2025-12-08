// api/submit-payment.js
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./_utils/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

    let {
      payment_date,
      payment_time,
      full_name,
      phone_number,
      amount
    } = req.body;

    // Server-side validation to ensure all fields are present
    if (!payment_date || !payment_time || !full_name || !phone_number || !amount) {
      return res.status(400).json({ error: 'Sila lengkapkan semua butiran yang diperlukan: nama, no. telefon, tarikh, masa, dan jumlah.' });
    }

    // 1. Update the user's profile with the provided full name and phone number
    const { error: updateUserError } = await supabase
      .from('users')
      .update({
        full_name: full_name,
        phone_number: phone_number,
        payment_status: 'pending' // Also update the status to 'pending'
      })
      .eq('user_id', user.id);

    if (updateUserError) {
      console.error('Error updating user profile:', updateUserError.message);
      throw new Error(`Gagal mengemas kini profil pengguna: ${updateUserError.message}`);
    }

    // 2. Update or create the payment record
    const { error: upsertPaymentError } = await supabase
      .from('payments')
      .upsert({
          user_id: user.id,
          payment_date: payment_date,
          payment_time: payment_time,
          amount: amount,
          reference_no: user.email,
          status: 'pending'
      }, {
          onConflict: 'user_id' // If a record with this user_id exists, update it.
      });

    if (upsertPaymentError) {
        console.error('Error upserting payment record:', upsertPaymentError.message);
        throw new Error(`Gagal mengemas kini atau mencipta rekod pembayaran: ${upsertPaymentError.message}`);
    }

    return res.status(200).json({ message: 'Bukti pembayaran berjaya dihantar dan sedang menunggu pengesahan admin.' });

  } catch (err) {
    console.error('Submit Payment API Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
