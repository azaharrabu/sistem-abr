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

    const { 
      payment_date, 
      payment_time, 
      amount,
      full_name,
      phone_number,
      bank_name, // akan jadi pilihan
      bank_account_number // akan jadi pilihan
    } = req.body;

    // 2. Pengesahan - hanya medan asas yang wajib
    if (!payment_date || !payment_time || !amount || !full_name || !phone_number) {
      return res.status(400).json({ error: 'Please fill in all required fields: payment details, full name, and phone number.' });
    }

    // 3. Masukkan bukti pembayaran ke dalam jadual 'payments'
    // Gunakan email pengguna sebagai 'reference_no' secara automatik
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        reference_no: user.email, // Menggunakan email sebagai nombor rujukan
        payment_date,
        payment_time,
        amount,
        status: 'pending'
      });

    if (paymentError) {
      console.error('Payment Insert Error:', paymentError.message);
      return res.status(500).json({ error: `Failed to submit payment proof: ${paymentError.message}` });
    }

    // 4. Bina payload untuk mengemaskini profil pengguna
    const userUpdatePayload = { 
        payment_status: 'pending',
        full_name,
        phone_number,
        bank_name: bank_name || null, // Simpan null jika tidak diberi
        account_number: bank_account_number || null // Simpan null jika tidak diberi
    };

    // 5. Kemas kini jadual 'users' (atau 'profiles') dengan data affiliate
    const { error: userUpdateError } = await supabase
      .from('users')
      .update(userUpdatePayload)
      .eq('user_id', user.id);

    if (userUpdateError) {
      console.error('User status/profile update after payment failed:', userUpdateError.message);
      // Walaupun profil gagal dikemas kini, pembayaran telah direkodkan.
      return res.status(207).json({ message: 'Payment proof submitted, but failed to update user profile.' });
    }

    // 6. Hantar respons berjaya sepenuhnya
    return res.status(200).json({ message: 'Payment and affiliate registration submitted successfully.' });

  } catch (err) {
    console.error('Submit Payment API Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
