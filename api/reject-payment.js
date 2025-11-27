// api/reject-payment.js
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('../_utils/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function isAdmin(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('user_id', userId)
    .single();
  return data && data.role === 'admin';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const adminUser = await verifyToken(req);
    if (!await isAdmin(adminUser.id)) {
      return res.status(403).json({ error: 'Forbidden: Admin privileges required.' });
    }

    const { customerId } = req.body;
    if (!customerId) {
        return res.status(400).json({ error: 'customerId is required.'});
    }

    // Kemas kini status kepada 'rejected'
    await supabase.from('users').update({ payment_status: 'rejected' }).eq('user_id', customerId);
    await supabase.from('payments').update({ status: 'rejected' }).eq('user_id', customerId);

    return res.status(200).json({ message: 'Payment rejected successfully.' });

  } catch (err) {
    console.error('Reject Payment API Error:', err.message);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
};
