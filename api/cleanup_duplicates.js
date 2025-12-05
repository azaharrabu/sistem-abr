
// api/cleanup_duplicates.js
const { createClient } = require('@supabase/supabase-js');

// Kunci ini akan diambil dari persekitaran Vercel apabila digunakan.
// Untuk ujian tempatan, ia memerlukan fail .env.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://grpyjfftucaooghlutgb.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdycHlqZmZ0dWNhb29naGx1dGdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjkyOTkyNywiZXhwIjoyMDc4NTA1OTI3fQ.gF5MYEw7pyQN3hL0ZAOhnw3Tiq6kgTSqMh0cVuvhxbk';

// Penciptaan klien Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Fungsi utama untuk API endpoint
module.exports = async (req, res) => {
  try {
    const { data: payments, error: fetchError } = await supabase
      .from('payments')
      .select('id, user_id, reference_no, payment_date, payment_time, amount');

    if (fetchError) throw fetchError;

    const groups = {};
    payments.forEach(p => {
      const key = `${p.user_id}|${p.reference_no}|${p.payment_date}|${p.payment_time}|${p.amount}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(p.id);
    });

    const idsToDelete = [];
    for (const key in groups) {
      const ids = groups[key];
      ids.sort((a, b) => a - b);
      if (ids.length > 1) {
        ids.shift();
        idsToDelete.push(...ids);
      }
    }

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) throw deleteError;
      
      // Hantar mesej kejayaan kembali
      return res.status(200).json({ message: `Berjaya memadam ${idsToDelete.length} rekod bayaran berganda.` });
    } else {
      return res.status(200).json({ message: 'Tiada rekod berganda ditemui.' });
    }
  } catch (err) {
    // Hantar mesej ralat jika berlaku masalah
    return res.status(500).json({ error: err.message });
  }
};
