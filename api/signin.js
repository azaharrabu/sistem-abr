// api/signin.js
const { createClient } = require('@supabase/supabase-js');

// Inisialisasi Supabase client menggunakan environment variables
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  // Hanya benarkan kaedah POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // 1. Cuba log masuk pengguna dengan Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Jika Supabase Auth mengembalikan ralat (cth: kata laluan salah)
      return res.status(401).json({ error: authError.message });
    }

    if (!authData.session) {
        return res.status(401).json({ error: 'Login failed, no session returned.'});
    }

    // 2. Dapatkan profil pengguna dari jadual 'users'
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', authData.user.id)
      .single();

    if (profileError) {
        // Jika profil tidak ditemui, ia mungkin satu isu data.
        // Tapi kita masih boleh teruskan dengan sesi log masuk.
        console.error('Could not fetch user profile for an otherwise successful login:', profileError.message);
        // Hantar respons tanpa profil, frontend mungkin boleh menanganinya.
        return res.status(200).json({ 
            session: authData.session, 
            user: authData.user, 
            profile: null, // Hantar null jika profil tiada
            message: 'Login successful, but profile could not be fetched.'
        });
    }

    // 3. Hantar respons yang berjaya bersama session dan profile
    return res.status(200).json({
      session: authData.session,
      user: authData.user,
      profile: profile
    });

  } catch (err) {
    console.error('Server Error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
};
