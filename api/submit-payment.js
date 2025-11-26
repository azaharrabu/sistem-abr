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
    // 1. Sahkan token dan dapatkan pengguna
    const user = await verifyToken(req);

    const { reference_no, payment_date, payment_time, amount } = req.body;

    if (!reference_no || !payment_date || !payment_time || !amount) {
      return res.status(400).json({ error: 'All payment fields are required.' });
    }

    // 2. Masukkan bukti pembayaran ke dalam jadual 'payments'
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        reference_no,
        payment_date,
        payment_time,
        amount,
        status: 'pending'
      });

    if (paymentError) {
      console.error('Payment Insert Error:', paymentError.message);
      return res.status(500).json({ error: `Failed to submit payment proof: ${paymentError.message}` });
    }

    // 3. Kemas kini status pengguna dalam jadual 'users' kepada 'pending'
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ payment_status: 'pending' })
      .eq('user_id', user.id);

    if (userUpdateError) {
      // Walaupun bayaran berjaya direkod, status pengguna gagal dikemas kini. Ini perlu log untuk penyiasatan.
      console.error('User status update after payment failed:', userUpdateError.message);
      // Maklumkan kepada frontend tentang kejayaan separa.
      return res.status(207).json({ message: 'Payment proof submitted, but failed to update user status.' });
    }

    // 4. Hantar respons berjaya sepenuhnya
    return res.status(200).json({ message: 'Payment proof submitted successfully and user status updated.' });

  } catch (err) {
    console.error('Submit Payment API Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
