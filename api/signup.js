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

  // Valid subscription plans
  const validPlans = ['6-bulan', '12-bulan'];
  if (!validPlans.includes(subscription_plan)) {
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

    // 2. Panggil fungsi database untuk mencipta rekod pengguna dan profil secara atomik.
    const { error: rpcError } = await supabase.rpc('create_user_and_profile', {
      p_user_id: authData.user.id,
      p_email: authData.user.email,
      p_subscription_plan: subscription_plan,
      p_referred_by: referred_by || null
    });

    if (rpcError) {
      console.error('[signup.js] CRITICAL: Error calling create_user_and_profile function.', rpcError);
      // NOTE: At this point, the auth user exists but the app user doesn't.
      // This is an orphaned auth user. We should consider cleaning them up.
      // For now, we return a critical error.
      return res.status(500).json({ error: 'Database error creating user profile. Please contact support.' });
    }

    // 3. Pendaftaran dan penciptaan rekod berjaya.
    return res.status(201).json({ message: 'Signup successful. Please check your email for verification.' });

  } catch (err) {
    console.error('Server Error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
};
