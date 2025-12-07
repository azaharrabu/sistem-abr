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
      payment_time
    } = req.body;

    if (!payment_date || !payment_time) {
      return res.status(400).json({ error: 'Sila lengkapkan tarikh dan masa pembayaran.' });
    }

    // 1. Cari rekod pembayaran 'pending' untuk pengguna ini.
    const { data: pendingPayment, error: findError } = await supabase
      .from('payments')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (findError || !pendingPayment) {
        console.error('Error finding pending payment or none found:', findError);
        return res.status(404).json({ error: 'Tiada permintaan pembayaran yang menunggu untuk dikemas kini. Sila mulakan permintaan pembaharuan terlebih dahulu.' });
    }

    // 2. Kemas kini rekod pembayaran dengan butiran yang diserahkan.
    const { error: updatePaymentError } = await supabase
      .from('payments')
      .update({
        payment_date: payment_date,
        payment_time: payment_time,
        reference_no: user.email, // Pastikan emel dilampirkan sebagai rujukan
      })
      .eq('id', pendingPayment.id);

    if (updatePaymentError) {
      console.error('Error updating payment record:', updatePaymentError.message);
      throw new Error(`Gagal mengemas kini rekod pembayaran: ${updatePaymentError.message}`);
    }
    
    // Tiada lagi kemas kini nama dan no. telefon di sini kerana ia sepatutnya sudah ada.
    // Jika perlu, ia boleh diuruskan di halaman profil pengguna.

    return res.status(200).json({ message: 'Bukti pembayaran berjaya dihantar dan sedang menunggu pengesahan admin.' });

  } catch (err) {
    console.error('Submit Payment API Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
