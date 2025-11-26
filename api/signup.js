// api/signup.js
const { createClient } = require('@supabase/supabase-js');

// Inisialisasi Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Harga untuk pelan langganan (anda boleh jadikan ini lebih dinamik pada masa hadapan)
const subscriptionPrices = {
  '6-bulan': 50.00,  // Harga promosi
  '12-bulan': 80.00, // Harga promosi
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, password, subscription_plan, referred_by } = req.body;

  if (!email || !password || !subscription_plan) {
    return res.status(400).json({ error: 'Email, password, and subscription plan are required.' });
  }

  if (!subscriptionPrices[subscription_plan]) {
    return res.status(400).json({ error: 'Invalid subscription plan selected.' });
  }

  try {
    // 1. Daftar pengguna baru di Supabase Auth
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      return res.status(400).json({ error: signUpError.message });
    }
    
    if (!authData.user) {
        return res.status(500).json({ error: "Signup succeeded but no user data returned."})
    }

    // 2. Cipta profil pengguna dalam jadual 'public.users'
    const price = subscriptionPrices[subscription_plan];

    const { error: insertError } = await supabase
      .from('users')
      .insert({
        user_id: authData.user.id,
        email: authData.user.email,
        subscription_plan: subscription_plan,
        subscription_price: price,
        is_promo_user: true, // Anggap semua pendaftaran awal adalah promo
        referred_by: referred_by || null, // Simpan kod affiliate jika ada
        payment_status: 'rejected' // Status awal sebelum pembayaran
      });

    if (insertError) {
      // Ini adalah kes di mana Auth berjaya tetapi sisipan profil gagal.
      // Ini boleh berlaku jika pengguna sudah wujud dalam 'users' tetapi tidak dalam 'auth.users' (jarang berlaku).
      // Untuk keselamatan, kita perlu memadam pengguna yang baru dicipta dari Auth untuk mengelakkan akaun "yatim".
      console.error('Failed to insert user profile after auth signup:', insertError.message);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: `Failed to create user profile: ${insertError.message}` });
    }

    // 3. Hantar respons berjaya. Frontend akan memberitahu pengguna untuk menyemak emel.
    return res.status(201).json({ message: 'Signup successful. Please check your email for verification.' });

  } catch (err) {
    console.error('Server Error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
};
