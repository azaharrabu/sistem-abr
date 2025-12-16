// api/profile.js
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./_utils/auth');

module.exports = async (req, res) => {
  console.log("--- api/profile function invoked ---");

  if (req.method === 'POST') {
    // Handle profile update
    try {
      const user = await verifyToken(req);
      const { full_name, phone_number, bank_name, account_number } = req.body;

      if (!full_name || !phone_number || !bank_name || !account_number) {
        return res.status(400).json({ error: 'All fields are required to update bank details.' });
      }
      
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );

      const { data, error } = await supabase
        .from('affiliates')
        .update({
          full_name,
          phone_number,
          bank_name,
          account_number
        })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      return res.status(200).json({ message: 'Profile updated successfully.' });

    } catch (err) {
      console.error('Update Profile Error:', err.message);
      return res.status(500).json({ error: 'Failed to update profile.' });
    }
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let supabase;
  try {
    // 1. Initialize Supabase client
    console.log("[PROFILE] Initializing Supabase client...");
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    console.log("[PROFILE] Supabase client initialized.");

    // 2. Verify user token from header
    console.log("[PROFILE] Step 1: Verifying user token...");
    const user = await verifyToken(req);
    if (!user) {
      // verifyToken already logs the error, just return
      return res.status(401).json({ error: 'Authentication failed.' });
    }
    console.log(`[PROFILE] Step 1 DONE: Token verified for user ID: ${user.id}`);

    // 3. Fetch combined profile from 'users' table
    console.log('[PROFILE] Step 2: Fetching main profile from "users" table...');
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
        // Handle case where user exists in auth but not in our public.users table
        if (profileError.code === 'PGRST116') { // "PostgREST error 116: query result not valid" (means no rows found for .single())
            console.error(`Inconsistent data: User ${user.id} not found in 'users' table.`);
            return res.status(404).json({ error: 'User profile data not found. Please contact support.' });
        }
        // For other database errors
        throw profileError;
    }
    
    if (!userProfile) {
      console.warn(`No profile found for user_id: ${user.id}`);
      return res.status(404).json({ error: 'User profile not found.' });
    }
    
    // The fetched user data is our base profile object
    const profile = userProfile;
    console.log(`[PROFILE] Step 2 DONE: Profile data ready for user: ${user.email}`);
    console.log(`[PROFILE] Details: Role='${profile.role}', Payment Status='${profile.payment_status}'`);

    // **New Step**: If payment is pending, get the amount from the 'payments' table
    if (profile.payment_status === 'pending') {
      console.log(`[PROFILE] User has pending payment. Fetching amount...`);
      const { data: pendingPayment, error: paymentError } = await supabase
        .from('payments')
        .select('amount')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (paymentError) {
        // Log the error but don't block the whole profile from loading
        console.error(`[PROFILE] Warning: Could not fetch pending payment amount: ${paymentError.message}`);
      } else if (pendingPayment) {
        profile.pending_amount = pendingPayment.amount;
        console.log(`[PROFILE] Pending amount of ${profile.pending_amount} added to profile object.`);
      }
    }

    // Steps below will merge affiliate data into this 'profile' object.


    // 4. Fetch basic affiliate details
    console.log('[PROFILE] Step 3: Fetching affiliate info...');
    const { data: affiliateInfo, error: affiliateError } = await supabase
      .from('affiliates')
      .select('id, affiliate_code') // Stop fetching pre-calculated totals
      .eq('user_id', profile.user_id)
      .single();

    if (affiliateError && affiliateError.code !== 'PGRST116') { // Ignore error if user is just not an affiliate
        console.error(`Error fetching affiliate details for user ${user.id}:`, affiliateError.message);
    }
    console.log('[PROFILE] Step 3 DONE: Affiliate info fetched.');
    
    // 5. If user is an affiliate, CALCULATE sales totals on the fly for accuracy
    profile.is_affiliate = !!affiliateInfo;
    if (affiliateInfo) {
      console.log('[PROFILE] Step 4: Affiliate detected, calculating totals from "sales" table...');
      profile.affiliate_id = affiliateInfo.id;
      profile.affiliate_code = affiliateInfo.affiliate_code;
      
      // Calculate totals directly from the 'sales' table to ensure data is always fresh
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('sale_amount, commission_amount')
        .eq('affiliate_id', affiliateInfo.id);

      if (salesError) {
        console.error(`[PROFILE] CRITICAL: Could not calculate sales for affiliate ${affiliateInfo.id}`, salesError.message);
        // Set to zero if calculation fails
        profile.totalSalesAmount = '0.00';
        profile.totalCommission = '0.00';
      } else {
        const totalSales = sales.reduce((sum, record) => sum + (record.sale_amount || 0), 0);
        const totalCommission = sales.reduce((sum, record) => sum + (record.commission_amount || 0), 0);
        profile.totalSalesAmount = totalSales.toFixed(2);
        profile.totalCommission = totalCommission.toFixed(2);
      }

      console.log(`[PROFILE] Step 4 DONE: On-the-fly calculation for ${user.email}: Amount=RM${profile.totalSalesAmount}, Commission=RM${profile.totalCommission}`);
    } else {
      console.log(`[PROFILE] User ${user.email} is not an affiliate.`);
    }

    // Check if essential profile information is missing to prompt a frontend update.
    // This flag can be used by the frontend to show a pop-up or notification.
    profile.needs_profile_update = !profile.full_name || !profile.phone_number;
    if (profile.needs_profile_update) {
      console.log(`[PROFILE] User ${user.email} will be prompted to update their profile.`);
    }

    // 6. Send the combined profile data
    console.log("[PROFILE] Step 5: Successfully preparing to send combined profile to frontend.");
    return res.status(200).json(profile);

  } catch (err) {
    console.error('--- UNHANDLED PROFILE API ERROR ---');
    console.error('Error Name:', err.name);
    console.error('Error Message:', err.message);
    console.error('Error Code:', err.code);
    console.error('Stack Trace:', err.stack);
    
    const errorMessage = err.message || 'An unknown error occurred.';
    const statusCode = errorMessage.includes('Authentication') ? 401 : 500;
    
    return res.status(statusCode).json({ 
        error: 'Profile API Error: ' + errorMessage,
        details: {
            name: err.name,
            code: err.code
        }
    });
  }
};