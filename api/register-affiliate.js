const { createClient } = require('@supabase/supabase-js');

// Initialize the Supabase client using environment variables for security.
// The Vercel environment will provide these values.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// This is the Vercel Serverless Function handler.
module.exports = async (req, res) => {
  // We only want to handle POST requests for this endpoint.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Get the JWT from the Authorization header (e.g., 'Bearer YOUR_JWT_TOKEN')
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Tidak disahkan: Tiada token disediakan.' });
  }

  // Get the user object from the token
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({ error: 'Tidak disahkan: Token tidak sah atau telah tamat tempoh.' });
  }

  // Use the securely obtained user ID
  const userId = user.id;

  try {
    // 1. Generate a unique and simple-to-read affiliate code.
    const uniqueCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const affiliateCode = `RAKAN-${uniqueCode}`;

    // 2. Insert the new affiliate record into the 'affiliates' table in Supabase.
    // We use .select().single() to get the newly created record back.
    const { data, error } = await supabase
      .from('affiliates')
      .insert({
        user_id: userId,
        affiliate_code: affiliateCode,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase Error:', error.message);
      // This specific error code '23505' means a unique constraint was violated.
      // In this case, it means the user_id already exists in the affiliates table.
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Pengguna ini sudah berdaftar sebagai agen.' });
      }
      // For any other database errors, return a generic server error.
      return res.status(500).json({ error: 'Gagal mendaftar sebagai agen di pangkalan data.' });
    }

    // 3. If successful, send a 201 Created status and the new affiliate data.
    return res.status(201).json(data);

  } catch (err) {
    console.error('Server Error:', err.message);
    return res.status(500).json({ error: 'Ralat dalaman pada server.' });
  }
};
