const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors'); // Diperlukan untuk membenarkan komunikasi antara frontend dan backend

const app = express();
const port = 3000;

// --- Konfigurasi Asas ---
app.use(cors()); // Benarkan semua permintaan Cross-Origin
app.use(express.json()); // Benarkan server menerima data dalam format JSON

// --- Konfigurasi Supabase ---
// Menggunakan environment variables untuk keselamatan, yang akan disediakan oleh Vercel.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Server sedang cuba dihidupkan...");

// === API Endpoint untuk Pendaftaran Affiliate ===
app.post('/register-affiliate', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'ID Pengguna (userId) diperlukan.' });
    }

    try {
        // 1. Jana kod affiliate yang unik
        // Kita gunakan 8 aksara rawak untuk kod yang ringkas
        const uniqueCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        const affiliateCode = `RAKAN-${uniqueCode}`;

        // 2. Masukkan data agen baru ke dalam jadual 'affiliates'
        const { data, error } = await supabase
            .from('affiliates')
            .insert({
                user_id: userId,
                affiliate_code: affiliateCode,
            })
            .select() // Minta Supabase pulangkan data yang baru dimasukkan
            .single(); // Kita jangkakan hanya satu rekod

        if (error) {
            console.error('Ralat Supabase:', error.message);
            // Jika ralat disebabkan pengguna sudah menjadi agen (kerana user_id adalah UNIQUE)
            if (error.code === '23505') {
                return res.status(409).json({ error: 'Pengguna ini sudah berdaftar sebagai agen.' });
            }
            return res.status(500).json({ error: 'Gagal mendaftar sebagai agen.' });
        }

        console.log('Pendaftaran affiliate berjaya untuk user_id:', userId);
        // 3. Hantar data agen yang baru dicipta kembali ke frontend
        res.status(201).json(data);

    } catch (err) {
        console.error('Ralat pada server:', err.message);
        res.status(500).json({ error: 'Ralat dalaman pada server.' });
    }
});

app.listen(port, () => {
    console.log(`Server affiliate sedang berjalan di http://localhost:${port}`);
});