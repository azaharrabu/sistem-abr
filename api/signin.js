// api/signin.js
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  console.log("--- api/signin function invoked ---");

  // Hanya benarkan kaedah POST
  if (req.method !== 'POST') {
    console.log(`Method ${req.method} not allowed.`);
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let supabase;
  try {
    console.log("Initializing Supabase client...");
    if (!process.env.SUPABASE_URL) throw new Error("SUPABASE_URL env var is missing.");
    if (!process.env.SUPABASE_SERVICE_KEY) throw new Error("SUPABASE_SERVICE_KEY env var is missing.");
    
    console.log("Environment variables for Supabase found.");

    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    console.log("Supabase client created successfully.");

  } catch (initError) {
    console.error("--- CRITICAL: Supabase client initialization failed ---");
    console.error(initError.message);
    // Kembalikan ralat dalam format JSON untuk mengelakkan ralat HTML di frontend
    return res.status(500).json({ error: "Server initialization failed.", details: initError.message });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    console.log("Login attempt with missing email or password.");
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    console.log(`Attempting to sign in user: ${email}`);
    // 1. Cuba log masuk pengguna dengan Supabase Auth
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

    console.log(`User ${email} signed in successfully. Fetching profile...`);
    // 2. Dapatkan profil pengguna dari jadual 'users'
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', authData.user.id)
      .single();

    if (profileError) {
        console.warn(`Could not fetch user profile for ${email}:`, profileError.message);
        // Teruskan walaupun profil tiada, hantar null
        return res.status(200).json({ 
            session: authData.session, 
            user: authData.user, 
            profile: null,
            message: 'Login successful, but profile could not be fetched.'
        });
    }
    
    console.log(`Profile for ${email} fetched successfully. Role: ${profile.role}`);

    // 3. Semak status affiliate pengguna
    const { data: affiliateInfo, error: affiliateError } = await supabase
      .from('affiliates')
      .select('affiliate_code') // Hanya pilih lajur yang wujud
      .eq('user_id', authData.user.id)
      .single();

    // Abaikan ralat jika tiada baris ditemui (PGRST116), ini bermakna pengguna bukan affiliate
    if (affiliateError && affiliateError.code !== 'PGRST116') {
      console.warn(`Warning checking affiliate status for ${email}:`, affiliateError.message);
    }
    
    // 4. Gabungkan maklumat affiliate dan kira jualan jika dia seorang affiliate
    profile.is_affiliate = !!affiliateInfo;
    if (affiliateInfo) {
      profile.affiliate_code = affiliateInfo.affiliate_code;
      console.log(`User ${email} is an affiliate with code: ${affiliateInfo.affiliate_code}`);

      // Terus kira statistik jualan di sini
      const { data: sales } = await supabase
        .from('affiliate_sales')
        .select('amount')
        .eq('affiliate_code', affiliateInfo.affiliate_code)
        .eq('payment_status', 'paid');
      
      const salesData = sales || [];
      const totalSalesAmount = salesData.reduce((sum, sale) => sum + (parseFloat(sale.amount) || 0), 0);
      
      // Gunakan kadar komisen tetap 10% seperti yang dipersetujui
      const commissionRate = 10; 
      const totalCommission = totalSalesAmount * (commissionRate / 100);

      // Tambah statistik pada profil untuk dihantar ke frontend
      profile.totalSalesAmount = totalSalesAmount.toFixed(2);
      profile.totalCommission = totalCommission.toFixed(2);
      // PENTING: Pastikan peranan ditetapkan kepada 'affiliate' untuk routing UI yang betul
      profile.role = 'affiliate'; 

    } else {
      console.log(`User ${email} is not an affiliate.`);
    }

    // 5. Hantar respons yang berjaya bersama session dan profile yang telah digabungkan
    return res.status(200).json({
      session: authData.session,
      user: authData.user,
      profile: profile
    });

  } catch (err) {
    console.error(`--- UNHANDLED SERVER ERROR for ${email} ---`);
    console.error(err.message);
    console.error(err.stack);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
};
