// api/signin.js
const { createClient } = require('@supabase/supabase-js');

// Handler utama, kini menggunakan sintaks CommonJS
module.exports = async (req, res) => {
  console.log("--- api/signin.js (CommonJS version) invoked ---");

  // Hanya benarkan kaedah POST
  if (req.method !== 'POST') {
    console.log(`Method ${req.method} not allowed.`);
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Inisialisasi Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { email, password } = req.body;

    if (!email || !password) {
      console.log("Login attempt with missing email or password.");
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    console.log(`Attempting to sign in user: ${email}`);
    // Cuba log masuk pengguna dengan Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error(`Supabase auth error for ${email}:`, authError.message);
      return res.status(401).json({ error: authError.message });
    }

    if (!authData.session) {
        console.error(`Login failed for ${email}, no session returned.`);
        return res.status(401).json({ error: 'Login failed, no session returned.'});
    }

    console.log(`User ${email} signed in successfully. Session data will be returned.`);

    // Hanya kembalikan sesi. Frontend akan mengendalikan pengambilan profil.
    return res.status(200).json({
      session: authData.session,
      user: authData.user
    });

  } catch (err) {
    console.error(`--- UNHANDLED SERVER ERROR in signin.js for ${req.body.email} ---`);
    console.error(err.message);
    console.error(err.stack);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
};
