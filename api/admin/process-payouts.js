// api/admin/process-payouts.js
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('../_utils/auth'); // Adjust path to go up one level

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Helper function to check for admin role
async function isAdmin(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    console.error('Error checking admin role:', error.message);
    return false;
  }
  
  return data && data.role === 'admin';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Authenticate and verify admin privileges
    const adminUser = await verifyToken(req);
    if (!await isAdmin(adminUser.id)) {
      return res.status(403).json({ error: 'Forbidden: Admin privileges required.' });
    }

    const { mode } = req.body; // 'calculate' or 'execute'

    // 2. Fetch all unpaid sales using the RPC function for a comprehensive summary
    const { data: unpaidSales, error: rpcError } = await supabase
      .rpc('get_unpaid_sales_summary');

    if (rpcError) {
      console.error('Error fetching unpaid sales via RPC:', rpcError.message);
      // Add a specific check in case the user hasn't run the SQL script
      if (rpcError.message.includes('function get_unpaid_sales_summary() does not exist')) {
          throw new Error('Fungsi pangkalan data (get_unpaid_sales_summary) tidak ditemui. Sila pastikan anda telah menjalankan skrip SQL yang terkini.');
      }
      throw new Error('Failed to fetch unpaid sales data.');
    }

    if (!unpaidSales || unpaidSales.length === 0) {
      return res.status(200).json({ message: 'Tiada komisyen yang belum dibayar pada masa ini.', summary: {} });
    }

    // 3. Process the data to create a summary per affiliate
    const payoutSummary = unpaidSales.reduce((summary, sale) => {
      const { affiliate_id, affiliate_name, affiliate_email, commission_amount, sale_id } = sale;
      const commission = commission_amount || 0;

      if (!summary[affiliate_id]) {
        summary[affiliate_id] = {
          affiliateName: affiliate_name || 'Nama Tidak Ditemui',
          affiliateEmail: affiliate_email || 'Emel Tidak Ditemui',
          totalCommission: 0,
          salesCount: 0,
          unpaidSaleIds: [],
        };
      }

      summary[affiliate_id].totalCommission += commission;
      summary[affiliate_id].salesCount += 1;
      summary[affiliate_id].unpaidSaleIds.push(sale_id);
      
      return summary;
    }, {});

    // 4. Handle based on the selected mode
    if (mode === 'execute') {
      // EXECUTE MODE: Mark all unpaid sales as 'paid'
      const allUnpaidSaleIds = Object.values(payoutSummary).flatMap(p => p.unpaidSaleIds);

      if (allUnpaidSaleIds.length > 0) {
        const { error: updateError } = await supabase
          .from('sales')
          .update({ payout_status: 'paid', updated_at: new Date().toISOString() })
          .in('id', allUnpaidSaleIds);

        if (updateError) {
          console.error('Error updating payout status:', updateError.message);
          throw new Error('Failed to update payout status for sales records.');
        }

        return res.status(200).json({
          message: `Pembayaran komisyen telah berjaya dilaksanakan. ${allUnpaidSaleIds.length} rekod jualan telah dikemas kini kepada 'paid'.`,
          payoutsProcessed: payoutSummary
        });
      } else {
        return res.status(200).json({ message: 'Tiada komisyen untuk diproses.', summary: {} });
      }

    } else {
      // CALCULATE MODE (default): Return the summary without changing data
      return res.status(200).json({
        message: `Berjaya mengira baki komisyen yang belum dibayar. Terdapat ${unpaidSales.length} jualan belum dibayar.`,
        payoutsPending: payoutSummary
      });
    }

  } catch (err) {
    console.error('Process Payouts API Error:', err.message);
    const statusCode = err.message.includes('Authentication failed') ? 401 : 500;
    return res.status(statusCode).json({ error: err.message });
  }
};
