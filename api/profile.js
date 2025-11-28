// api/profile.js
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./_utils/auth');

module.exports = async (req, res) => {
  console.log("--- api/profile function invoked ---");

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let supabase;
  try {
    // 1. Initialize Supabase client
    console.log("Initializing Supabase client for profile fetch...");
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // 2. Verify user token from header
    const user = await verifyToken(req);
    if (!user) {
      // verifyToken already logs the error, just return
      return res.status(401).json({ error: 'Authentication failed.' });
    }
    console.log(`Token verified for user ID: ${user.id}`);

    // 3. Fetch main profile from 'users' table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      // Handle cases where profile doesn't exist even for a valid user
      if (profileError && profileError.code === 'PGRST116') { // No rows found
        console.warn(`No profile found in 'users' table for user_id: ${user.id}`);
        return res.status(404).json({ error: 'User profile not found.' });
      }
      // For other errors, throw to be caught by the outer catch block
      throw profileError || new Error('User profile not found after login.');
    }
    console.log(`Profile fetched for ${profile.email}. Role: ${profile.role}`);

    // 4. Check for affiliate details separately
    const { data: affiliateInfo, error: affiliateError } = await supabase
      .from('affiliates')
      .select('affiliate_code') // Only select the code, as commission is fixed
      .eq('user_id', user.id)
      .single();

    // Ignore 'PGRST116' error, as it just means the user isn't an affiliate
    if (affiliateError && affiliateError.code !== 'PGRST116') {
        console.error(`Error fetching affiliate details for user ${user.id}:`, affiliateError.message);
        // Do not throw; proceed without affiliate data
    }
    
    // 5. Combine data and calculate sales if user is an affiliate
    profile.is_affiliate = !!affiliateInfo;
    if (affiliateInfo) {
      profile.affiliate_code = affiliateInfo.affiliate_code;
      console.log(`User ${profile.email} is an affiliate. Code: ${profile.affiliate_code}. Calculating sales...`);

      // Calculate sales statistics directly here
      const { data: sales } = await supabase
        .from('affiliate_sales')
        .select('amount')
        .eq('affiliate_code', affiliateInfo.affiliate_code)
        .eq('payment_status', 'paid');
      
      const salesData = sales || [];
      const totalSalesAmount = salesData.reduce((sum, sale) => sum + (parseFloat(sale.amount) || 0), 0);
      const commissionRate = 10; // Use a fixed rate of 10% for consistency
      const totalCommission = totalSalesAmount * (commissionRate / 100);

      // Attach stats to the profile to be sent to the frontend
      profile.totalSalesAmount = totalSalesAmount.toFixed(2);
      profile.totalCommission = totalCommission.toFixed(2);
      console.log(`Sales for ${profile.email}: Amount=RM${profile.totalSalesAmount}, Commission=RM${profile.totalCommission}`);
    } else {
      console.log(`User ${profile.email} is not an affiliate.`);
    }

    // 6. Send the combined profile data
    console.log("--- Successfully sending combined profile to frontend ---");
    return res.status(200).json(profile);

  } catch (err) {
    // Generic error handler
    const errorMessage = err.message || 'An unknown error occurred.';
    console.error('--- UNHANDLED PROFILE API ERROR ---');
    console.error(errorMessage);
    console.error(err.stack); // Log stack for more details
    const statusCode = errorMessage.includes('Authentication') ? 401 : 500;
    return res.status(statusCode).json({ error: 'Profile API Error: ' + errorMessage });
  }
};
