// api/renew-subscription.js
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

    const { plan, price } = req.body;

    // 2. Pengesahan input - pastikan pelan dan harga wujud
    if (!plan || !price) {
      return res.status(400).json({ error: 'Sila pilih pelan yang sah.' });
    }

    // 3. Semak jika ada pembayaran yang masih 'pending' untuk pengguna ini
    const { data: existingPending, error: checkError } = await supabase
      .from('payments')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .limit(1);

    if (checkError) {
      console.error('Error checking for pending payments:', checkError.message);
      throw new Error('Database error while checking for pending payments.');
    }

    if (existingPending.length > 0) {
      return res.status(409).json({ error: 'Anda sudah mempunyai permintaan pembayaran yang sedang menunggu kelulusan. Sila tunggu ia diproses.' });
    }

    // 4. Kemas kini pelan pilihan pengguna DAN status pembayaran dalam jadual 'users'
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ 
          subscription_plan: plan,
          payment_status: 'pending' // TETAPKAN STATUS PENGGUNA KEPADA PENDING
      })
      .eq('user_id', user.id);

    if (updateUserError) {
        throw new Error(`Failed to update user's status and plan choice: ${updateUserError.message}`);
    }

    // 5. Cipta rekod pembayaran 'pending' yang baru dalam jadual 'payments'
    const { error: insertError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        amount: price,
        status: 'pending',
      });

    if (insertError) {
      console.error('Error creating new payment record:', insertError.message);
      // CUBA KEMBALIKAN STATUS PENGGUNA JIKA GAGAL
      await supabase.from('users').update({ payment_status: 'paid' }).eq('user_id', user.id);
      throw new Error('Failed to create new payment record.');
    }

    // 6. Hantar mesej kejayaan
    return res.status(200).json({ message: 'Permintaan langganan anda telah berjaya dihantar. Sila buat pembayaran dan maklumkan kepada admin.' });

  } catch (err) {
    console.error('Renew Subscription API Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
