// api/update-payment-proof.js
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

    const { payment_date, payment_time } = req.body;

    if (!payment_date || !payment_time) {
      return res.status(400).json({ error: 'Sila lengkapkan tarikh dan masa pembayaran.' });
    }

    // Cari rekod pembayaran 'pending' untuk pengguna ini
    const { data: pendingPayment, error: findError } = await supabase
        .from('payments')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (findError || !pendingPayment) {
        throw new Error('Tiada rekod pembayaran yang sedang menunggu untuk dikemas kini.');
    }

    // Kemas kini rekod 'pending' tersebut dengan butiran bukti bayaran
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        payment_date: payment_date,
        payment_time: payment_time,
        reference_no: user.email // Gunakan emel sebagai rujukan automatik
      })
      .eq('id', pendingPayment.id);

    if (updateError) {
      throw new Error(`Gagal mengemas kini bukti pembayaran: ${updateError.message}`);
    }

    return res.status(200).json({ message: 'Bukti pembayaran anda telah berjaya dihantar dan akan disemak dalam masa 3 hari bekerja.' });

  } catch (err) {
    console.error('Update Payment Proof API Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
