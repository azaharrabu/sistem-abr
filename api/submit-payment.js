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
    // 1. Sahkan token dan dapatkan maklumat pengguna
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const { 
      payment_date, 
      payment_time, 
      amount,
      full_name,
      phone_number
    } = req.body;

    // 2. Pengesahan input - pastikan semua medan yang diperlukan wujud
    if (!payment_date || !payment_time || !amount || !full_name || !phone_number) {
      return res.status(400).json({ error: 'Sila lengkapkan semua medan yang diperlukan.' });
    }

    // 3. Panggil fungsi pangkalan data `handle_new_payment`
    const { data, error } = await supabase.rpc('handle_new_payment', {
      p_user_id: user.id,
      p_user_email: user.email,
      p_payment_date: payment_date,
      p_payment_time: payment_time,
      p_amount: amount,
      p_full_name: full_name,
      p_phone_number: phone_number
    });

    if (error) {
      console.error('RPC Error:', error.message);
      return res.status(500).json({ error: `Gagal memproses bayaran: ${error.message}` });
    }

    // 4. Kendalikan maklum balas daripada fungsi
    if (data === 'conflict') {
      console.warn(`Duplicate payment attempt for user ${user.id}.`);
      return res.status(409).json({ error: 'Anda sudah mempunyai bayaran yang aktif atau sedang menunggu kelulusan.' });
    }

    if (data === 'success') {
      return res.status(200).json({ message: 'Bukti pembayaran dan butiran peribadi berjaya dihantar.' });
    }

    // Jika maklum balas adalah 'error' atau sesuatu yang tidak dijangka
    return res.status(500).json({ error: 'Berlaku ralat yang tidak dijangka semasa memproses pembayaran anda.' });

  } catch (err) {
    console.error('Submit Payment API Error:', err.message);
    // Asingkan ralat pengesahan daripada ralat server yang lain
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
