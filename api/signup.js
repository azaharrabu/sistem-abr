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
    // 1. Daftar pengguna baru di Supabase Auth.
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      // options.data tidak lagi digunakan kerana profil dicipta secara manual di bawah.
    });

    if (signUpError) {
      // Log ralat sebenar di server untuk penyahpepijatan
      console.error('Supabase sign up error:', signUpError.message);
      return res.status(400).json({ error: signUpError.message });
    }
    
    if (!authData.user) {
        return res.status(500).json({ error: "Signup succeeded but no user data returned."});
    }

    // 2. Cipta profil pengguna secara manual dalam jadual 'public.users'.
    const { error: profileError } = await supabase
      .from('users')
      .insert([
        {
          user_id: authData.user.id,
          email: authData.user.email, // Guna emel dari data Auth yang disahkan
          role: 'user',
          subscription_plan: subscription_plan,
          subscription_price: subscriptionPrices[subscription_plan],
          is_promo_user: true,
          referred_by: referred_by || null,
          payment_status: 'needs_payment'
        }
      ]);

    if (profileError) {
      // Log ralat sebenar di server untuk penyahpepijatan
      console.error('Error creating user profile:', profileError.message);
      // Ralat kritikal: Pengguna disahkan tetapi profil gagal dicipta.
      return res.status(500).json({ error: 'Database error saving new user.' });
    }

    // 3. Pendaftaran dan penciptaan profil berjaya.
    return res.status(201).json({ message: 'Signup successful. Please check your email for verification.' });


  } catch (err) {
    console.error('Server Error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
};
