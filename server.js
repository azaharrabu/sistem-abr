const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

let supabase;
let supabaseAdmin;

// 1. KONFIGURASI
const app = express();
const port = process.env.PORT || 3001;

// Middleware untuk log semua permintaan masuk
app.use((req, res, next) => {
    console.log(`[LOG] Request: ${req.method} ${req.path}`);
    next();
});

console.log('DIAGNOSTIC: SUPABASE_URL:', SUPABASE_URL ? 'Set' : 'Not Set');
console.log('DIAGNOSTIC: SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'Set' : 'Not Set');
console.log('DIAGNOSTIC: SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? 'Set' : 'Not Set');

// Tambah log diagnostik untuk semua pembolehubah persekitaran yang bermula dengan SUPABASE_
console.log('DIAGNOSTIC: All SUPABASE_ environment variables:');
for (const key in process.env) {
    if (key.startsWith('SUPABASE_')) {
        console.log(`DIAGNOSTIC:   ${key}: ${process.env[key] ? 'Set' : 'Not Set'}`);
    }
}

try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
        throw new Error("Pembolehubah persekitaran Supabase tidak ditetapkan sepenuhnya.");
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
} catch (e) {
    console.error("FATAL: Gagal memulakan Supabase client.", e.message);
    process.exit(1);
}

// 2. MIDDLEWARE
// Penting: Hidangkan fail statik dari folder 'public' SEBELUM mana-mana laluan lain.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware untuk pengesahan (Authentication)
const requireAuth = async (req, res, next) => {
    const { authorization } = req.headers;
    if (!authorization || !authorization.startsWith('Bearer ')) {
        // Jika tiada token, cuba redirect ke login untuk akses browser
        return res.redirect('/index.html');
    }

    const token = authorization.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        // Jika token tidak sah, hantar ralat (untuk API calls) atau redirect
        return res.status(401).json({ error: 'Akses tidak sah. Sila log masuk semula.' });
    }

    req.user = user;
    next();
};

// Middleware untuk kebenaran (Authorization) - Admin sahaja
const requireAdmin = async (req, res, next) => {
    const { user } = req; // Pengguna dari middleware requireAuth

    const { data: customer, error } = await supabaseAdmin
        .from('customers')
        .select('role')
        .eq('user_id', user.id)
        .single();

    if (error || !customer || customer.role !== 'admin') {
        return res.status(403).json({ error: 'Akses terhad kepada admin sahaja.' });
    }

    next();
};


// 3. HIDANGKAN FAIL STATIK
// Hantar semua fail dari folder 'public'. express.static akan secara automatik
// menghantar 'index.html' apabila pengguna mengakses laluan root ('/').
app.use(express.static(path.join(__dirname, 'public')));


// 4. API ENDPOINTS

// Endpoint Pendaftaran (Awam)
app.post('/api/signup', async (req, res) => {
    // ... (logik pendaftaran sedia ada kekal sama)
    try {
        const { email, password, subscription_plan } = req.body;

        // 1. Dapatkan jumlah pengguna sedia ada (guna klien admin)
        const { count, error: countError } = await supabaseAdmin
            .from('customers')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            throw new Error('Ralat semasa mengira jumlah pengguna: ' + countError.message);
        }

        // 2. Tentukan harga berdasarkan pelan dan promosi
        let amount = 0;
        const isPromoUser = count < 100;

        const prices = {
            '6-bulan': { normal: 60, promo: 50 },
            '12-bulan': { normal: 100, promo: 80 }
        };

        if (prices[subscription_plan]) {
            amount = isPromoUser ? prices[subscription_plan].promo : prices[subscription_plan].normal;
        } else {
            return res.status(400).json({ error: 'Pelan langganan tidak sah.' });
        }

        // 3. Daftar pengguna baru di Supabase Auth (guna klien biasa)
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;

        // 4. Cipta profil pengguna (customer) dengan maklumat langganan (guna klien admin)
        if (authData.user) {
            const subscriptionMonths = subscription_plan === '6-bulan' ? 6 : 12;
            const subscriptionEndDate = new Date();
            subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + subscriptionMonths);

            const { error: profileError } = await supabaseAdmin.from('customers').insert([{
                user_id: authData.user.id,
                email: authData.user.email,
                subscription_plan: subscription_plan,
                subscription_price: amount,
                subscription_end_date: subscriptionEndDate.toISOString().split('T')[0], 
                is_promo_user: isPromoUser,
                payment_status: 'pending',
                role: 'user' // Tetapkan peranan default sebagai 'user'
            }]).select();

            if (profileError) {
                console.error('DIAGNOSTIC: Ralat Supabase semasa mencipta profil:', profileError);
                try {
                    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
                } catch (deleteError) {
                    console.error('DIAGNOSTIC: Ralat semasa memadam pengguna Auth selepas profil gagal:', deleteError);
                }
                return res.status(500).json({ 
                    error: 'Gagal mencipta profil pengguna.',
                    details: profileError.message,
                    code: profileError.code
                });
            }
        }

        // 5. Pendaftaran Selesai
        // Logik ToyyibPay dialih keluar. Pengguna akan membuat pembayaran manual.
        res.status(200).json({ 
            message: "Pendaftaran berjaya! Sila teruskan ke halaman pembayaran.",
            user: authData.user 
        });

    } catch (error) {
        res.status(error.status || 400).json({ error: error.message });
    }
});

// Endpoint Log Masuk (Awam)
app.post('/api/signin', async (req, res) => {
    try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
            email: req.body.email, 
            password: req.body.password 
        });
        if (authError) throw authError;

        // Dapatkan profil termasuk 'role'
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('*, role') // Pastikan 'role' dipilih
            .eq('user_id', authData.user.id)
            .single();

        if (customerError) {
            console.error('Ralat mendapatkan profil pelanggan:', customerError.message);
        }

        res.status(200).json({ user: authData.user, session: authData.session, customer: customer });

    } catch (error) {
        res.status(error.status || 400).json({ error: error.message });
    }
});

// Endpoint untuk Pengesahan Pembayaran Manual (Dilindungi)
app.post('/api/submit-payment-proof', requireAuth, async (req, res) => {
    try {
        const { payment_reference } = req.body;
        const user = req.user;

        if (!payment_reference) {
            return res.status(400).json({ error: 'Sila masukkan nombor rujukan pembayaran.' });
        }

        const { data, error } = await supabaseAdmin
            .from('customers')
            .update({ 
                payment_reference: payment_reference,
                payment_status: 'pending' // Kekal/Set semula ke 'pending' sehingga disahkan admin
            })
            .eq('user_id', user.id)
            .select();

        if (error) {
            console.error("Ralat mengemas kini bukti pembayaran:", error);
            throw new Error('Gagal menyimpan rujukan pembayaran.');
        }

        res.status(200).json({ message: 'Terima kasih. Bukti pembayaran anda telah dihantar dan akan disemak.' });

    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
});


// Callback Pembayaran (LAMA - Dilumpuhkan)
/*
app.post('/api/payment-callback', async (req, res) => {
    const { refno, status, reason, billcode, amount } = req.body;
    console.log('Callback diterima dari ToyyibPay:', req.body);

    if (status === '1') { // Pembayaran berjaya
        try {
            const { data: customer, error } = await supabaseAdmin
                .from('customers')
                .update({ payment_status: 'paid' })
                .eq('toyyibpay_bill_code', billcode)
                .select();

            if (error) {
                console.error('Ralat mengemaskini status pembayaran:', error.message);
                return res.status(500).send('Internal Server Error');
            }
            if (customer && customer.length > 0) {
                console.log(`Status pembayaran untuk BillCode ${billcode} dikemaskini.`);
            } else {
                console.warn(`Tiada pelanggan ditemui dengan BillCode ${billcode}.`);
            }
        } catch (e) {
            console.error('Ralat server semasa memproses callback:', e.message);
            return res.status(500).send('Internal Server Error');
        }
    }
    res.status(200).send('OK');
});
*/


// 5. LALUAN DILINDUNGI (Protected Routes)

// Laluan untuk kandungan interaktif (perlu log masuk)
app.get('/rujukan_interaktif.html', requireAuth, async (req, res) => {
    // Pastikan pengguna mempunyai langganan yang aktif dan telah dibayar
    const { data: customer, error } = await supabaseAdmin
        .from('customers')
        .select('payment_status, subscription_end_date')
        .eq('user_id', req.user.id)
        .single();

    if (error || !customer || customer.payment_status !== 'paid' || new Date(customer.subscription_end_date) < new Date()) {
        return res.status(403).send('Akses ditolak. Sila pastikan langganan anda aktif.');
    }
    
    res.sendFile(path.join(__dirname, 'rujukan_interaktif.html'));
});








// Endpoint untuk dapatkan profil pengguna semasa
app.get('/api/profile', requireAuth, async (req, res) => {
    const { data: customer, error } = await supabaseAdmin
        .from('customers')
        .select('*, role')
        .eq('user_id', req.user.id)
        .single();

    if (error || !customer) {
        return res.status(404).json({ error: 'Profil pelanggan tidak ditemui.' });
    }

    res.status(200).json(customer);
});

// 6. API ADMIN (Perlu log masuk sebagai admin)

app.get('/api/customers', requireAuth, requireAdmin, async (req, res) => {
    const { data, error } = await supabaseAdmin.from('customers').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json(data);
});

app.post('/api/customers', requireAuth, requireAdmin, async (req, res) => {
    const { data, error } = await supabaseAdmin.from('customers').insert([req.body]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
});

app.delete('/api/customers/:id', requireAuth, requireAdmin, async (req, res) => {
    const { data, error } = await supabaseAdmin.from('customers').delete().match({ id: req.params.id });
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ message: 'Customer dipadam' });
});

// Endpoint untuk Admin meluluskan pembayaran
app.post('/api/customers/:id/approve', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
        .from('customers')
        .update({ payment_status: 'paid' })
        .eq('id', id)
        .select();

    if (error) {
        console.error('Ralat meluluskan pembayaran:', error);
        // Log additional details for debugging on Vercel
        return res.status(500).json({ error: 'Gagal meluluskan pembayaran pelanggan.'});
    }

    res.status(200).json(data[0]);
});

// Endpoint untuk Admin menolak pembayaran
app.delete('/api/customers/:id/reject', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
        .from('customers')
        .update({ payment_status: 'rejected' })
        .eq('id', id)
        .select();

    if (error) {
        console.error('Ralat menolak pembayaran:', error);
        return res.status(500).json({ error: 'Gagal menolak pembayaran pelanggan.' });
    }

    if (!data || data.length === 0) {
        return res.status(404).json({ error: 'Pelanggan tidak ditemui atau status pembayaran tidak berubah.' });
    }

    res.status(200).json(data[0]);
});

// 7. MULAKAN SERVER
app.listen(port, () => {
    console.log(`Server sedia untuk digunakan di port ${port}.`);
});