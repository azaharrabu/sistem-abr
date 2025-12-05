// api/signup.js
const { createClient } = require('@supabase/supabase-js');

// Inisialisasi Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Harga untuk pelan langganan
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
    });

    if (signUpError) {
      console.error('Supabase sign up error:', signUpError.message);
      return res.status(400).json({ error: signUpError.message });
    }
    
    if (!authData.user) {
        return res.status(500).json({ error: "Signup succeeded but no user data returned."});
    }

    const userId = authData.user.id;
    const userEmail = authData.user.email;

    // 2. Gunakan 'upsert' untuk memasukkan atau mengemas kini rekod pengguna.
    // Ini mengelakkan ralat jika trigger 'on_auth_user_created' telah mencipta rekod asas.
    const { error: userError } = await supabase
      .from('users')
      .upsert({
          user_id: userId,
          email: userEmail,
          role: 'user',
          subscription_plan: subscription_plan,
          subscription_price: subscriptionPrices[subscription_plan],
          referred_by: referred_by || null,
          payment_status: 'pending'
      }, { onConflict: 'user_id' });

    if (userError) {
      console.error('[signup.js] CRITICAL: Error upserting user record.', userError);
      return res.status(500).json({ error: 'Database error creating user record.' });
    }

    // 3. Cipta profil pengguna dalam jadual 'public.profiles'.
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          user_id: userId,
          email: userEmail,
          is_promo_user: true, 
        }
      ]);

    // Abaikan ralat jika profil sudah wujud (kod 23505), kerana ia tidak kritikal.
    if (profileError && profileError.code !== '23505') {
      console.error('[signup.js] CRITICAL: Error creating user profile.', profileError);
      return res.status(500).json({ error: 'Error creating user profile. The database schema might be out of sync. Please check the table definitions.' });
    }

    // 4. Pendaftaran dan penciptaan rekod berjaya.
    return res.status(201).json({ message: 'Signup successful. Please check your email for verification.' });

  } catch (err) {
    console.error('Server Error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
};
