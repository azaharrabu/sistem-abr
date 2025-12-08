// api/cron/check-subscriptions.js
const { createClient } = require('@supabase/supabase-js');

// Inisialisasi Supabase client dengan Service Key untuk akses admin
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
    // 1. Lindungi cron job dengan 'Authorization' header
    // Pastikan anda menetapkan CRON_SECRET dalam environment variables projek Vercel anda.
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // 2. Dapatkan tarikh untuk 7 hari dari sekarang
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + 7);

        // Format tarikh ke YYYY-MM-DD untuk perbandingan dengan pangkalan data
        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const formattedTargetDate = `${year}-${month}-${day}`;

        // 3. Cari pengguna yang 'subscription_end_date' sepadan dengan tarikh sasaran
        const { data: expiringUsers, error } = await supabase
            .from('users')
            .select('email, full_name, subscription_end_date')
            .eq('subscription_end_date', formattedTargetDate);

        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).json({ error: `Database error: ${error.message}` });
        }

        if (!expiringUsers || expiringUsers.length === 0) {
            const message = 'Tiada pengguna dengan langganan akan tamat dalam 7 hari.';
            console.log(message);
            return res.status(200).json({ success: true, message });
        }

        // 4. (SIMULASI) Hantar notifikasi kepada setiap pengguna
        for (const user of expiringUsers) {
            // Pada masa hadapan, kita akan gantikan console.log dengan servis penghantaran emel
            console.log(
                `HANTAR EMEL KEPADA: ${user.email} | NAMA: ${user.full_name} | NOTIFIKASI: Langganan anda akan tamat pada ${user.subscription_end_date}`
            );
        }

        const message = `Berjaya memproses notifikasi untuk ${expiringUsers.length} pengguna.`;
        console.log(message);
        
        // 5. Kembalikan mesej kejayaan
        return res.status(200).json({ success: true, message });

    } catch (err) {
        console.error('Cron job failed:', err.message);
        return res.status(500).json({ error: `Internal Server Error: ${err.message}` });
    }
};
