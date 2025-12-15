// api/signup.js
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

// Inisialisasi Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

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

    // 3. Create the initial pending payment record for the new user.
    const price = subscriptionPrices[subscription_plan];
    const { error: paymentInsertError } = await supabase
      .from('payments')
      .insert({
        user_id: authData.user.id,
        amount: price,
        status: 'pending',
      });

    if (paymentInsertError) {
      console.error('[signup.js] CRITICAL: User profile created, but failed to create initial pending payment.', paymentInsertError);
      // This is also a partial failure state. The user exists but can't pay.
      return res.status(500).json({ error: 'User created, but failed to initialize payment. Please contact support.' });
    }

    // If user was referred, send a notification email to the affiliate
    if (referred_by) {
      try {
        // 1. Find the affiliate's user_id from their referral code
        const { data: affiliateData, error: affiliateError } = await supabase
          .from('affiliates')
          .select('user_id')
          .eq('affiliate_code', referred_by)
          .single();

        if (affiliateError || !affiliateData) {
          throw new Error(`Affiliate with code ${referred_by} not found.`);
        }

        // 2. Get the affiliate's email from their user record
        const { data: affiliateUser, error: userError } = await supabase
          .from('users')
          .select('email, full_name')
          .eq('user_id', affiliateData.user_id)
          .single();

        if (userError || !affiliateUser) {
          throw new Error(`Affiliate user with id ${affiliateData.user_id} not found.`);
        }
        
        const affiliateEmail = affiliateUser.email;
        const affiliateName = affiliateUser.full_name || 'Rakan Affiliate';
        const newUserName = email; // We can use the new user's email as an identifier

        // 3. Send the notification email
        if (process.env.RESEND_API_KEY) {
            const { data: emailData, error: emailError } = await resend.emails.send({
                from: 'Sistem ABR <noreply@abrbrillante.com>',
                to: [affiliateEmail],
                subject: 'Tahniah! Anda Mendapat Ahli Baru!',
                html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2 style="color: #0056b3;">Tahniah, ${affiliateName}!</h2>
                    <p>Seorang pengguna baru telah mendaftar menggunakan pautan affiliate anda.</p>
                    <p><strong>Butiran Pengguna Baru:</strong> ${newUserName}</p>
                    <p>Pengguna ini kini direkodkan di bawah anda. Anda akan menerima komisen selepas pembayaran mereka disahkan.</p>
                    <p>Teruskan usaha anda!</p>
                    <br>
                    <p>Yang benar,</p>
                    <p><strong>Team ABR Brillante</strong></p>
                </div>
                `
            });

            if (emailError) {
                console.error(`[signup.js] EMAIL_ERROR: Failed to send new signup notification to affiliate ${affiliateEmail}`, emailError);
            } else {
                console.log(`[signup.js] Successfully sent new signup notification to affiliate ${affiliateEmail}.`);
            }
        } else {
            console.log('[signup.js] RESEND_API_KEY not set. Skipping affiliate notification email.');
        }

      } catch (notificationError) {
        // Log the error but do not block the main signup flow
        console.error('[signup.js] NOTIFICATION_ERROR: Failed to process affiliate notification.', notificationError.message);
      }
    }

    // 4. Pendaftaran dan penciptaan rekod berjaya.
    return res.status(201).json({ message: 'Signup successful. Please check your email for verification.' });

  } catch (err) {
    console.error('Server Error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
};
