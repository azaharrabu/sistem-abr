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

    // 2. Fetch all unpaid sales, joining with affiliate and user data for a comprehensive summary
    const { data: unpaidSales, error: fetchError } = await supabase
      .from('sales')
      .select(`
        id,
        commission_amount,
        affiliates (
          id,
          users (
            full_name,
            email
          )
        )
      `)
      .eq('payout_status', 'unpaid');

    if (fetchError) {
      console.error('Error fetching unpaid sales:', fetchError.message);
      throw new Error('Failed to fetch unpaid sales data.');
    }

    if (!unpaidSales || unpaidSales.length === 0) {
      return res.status(200).json({ message: 'Tiada komisyen yang belum dibayar pada masa ini.', summary: {} });
    }

    // 3. Process the data to create a summary per affiliate
    const payoutSummary = unpaidSales.reduce((summary, sale) => {
      if (!sale.affiliates) return summary; // Skip if sale is not linked to an affiliate

      const affiliateId = sale.affiliates.id;
      const affiliateName = sale.affiliates.users?.full_name || 'Nama Tidak Ditemui';
      const affiliateEmail = sale.affiliates.users?.email || 'Emel Tidak Ditemui';
      const commission = sale.commission_amount || 0;

      if (!summary[affiliateId]) {
        summary[affiliateId] = {
          affiliateName,
          affiliateEmail,
          totalCommission: 0,
          salesCount: 0,
          unpaidSaleIds: [],
        };
      }

      summary[affiliateId].totalCommission += commission;
      summary[affiliateId].salesCount += 1;
      summary[affiliateId].unpaidSaleIds.push(sale.id);
      
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
