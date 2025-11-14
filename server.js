const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

let supabase;
let supabaseAdmin;

// 1. KONFIGURASI
const app = express();

// Middleware untuk log semua permintaan masuk
app.use((req, res, next) => {
    console.log(`[LOG] Request: ${req.method} ${req.path}`);
    next();
});

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
    // In a serverless environment, we can't process.exit. We'll let requests fail.
}

// 2. MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Middleware untuk pengesahan (Authentication)
const requireAuth = async (req, res, next) => {
    const { authorization } = req.headers;
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Akses tidak sah. Token diperlukan.' });
    }

    const token = authorization.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: 'Akses tidak sah. Sila log masuk semula.' });
    }

    req.user = user;
    next();
};

// Middleware untuk kebenaran (Authorization) - Admin sahaja
const requireAdmin = async (req, res, next) => {
    const { user } = req; // Pengguna dari middleware requireAuth

    const { data: profile, error } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('user_id', user.id)
        .single();

    if (error || !profile || profile.role !== 'admin') {
        return res.status(403).json({ error: 'Akses terhad kepada admin sahaja.' });
    }

    next();
};

// 4. API ENDPOINTS

// Endpoint Pendaftaran (Awam)
app.post('/api/signup', async (req, res) => {
    try {
        const { email, password, subscription_plan } = req.body;

        const { count, error: countError } = await supabaseAdmin
            .from('users')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            throw new Error('Ralat semasa mengira jumlah pengguna: ' + countError.message);
        }

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

        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;

        if (authData.user) {
            const subscriptionMonths = subscription_plan === '6-bulan' ? 6 : 12;
            const subscriptionEndDate = new Date();
            subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + subscriptionMonths);

            const { error: profileError } = await supabaseAdmin.from('users').insert([{
                user_id: authData.user.id,
                email: authData.user.email,
                subscription_plan: subscription_plan,
                subscription_price: amount,
                subscription_end_date: subscriptionEndDate.toISOString().split('T')[0], 
                is_promo_user: isPromoUser,
                payment_status: 'pending',
                role: 'user'
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

        const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({ email, password });
        if (sessionError) {
            console.error('DIAGNOSTIC: Gagal log masuk automatik selepas daftar:', sessionError);
            return res.status(200).json({ 
                message: "Pendaftaran berjaya! Sila log masuk secara manual.",
                user: authData.user,
                session: null,
                profile: null
            });
        }

        const { data: profile, error: finalProfileError } = await supabaseAdmin
            .from('users')
            .select('*, role')
            .eq('user_id', authData.user.id)
            .single();

        if (finalProfileError) {
            return res.status(500).json({ error: 'Gagal mendapatkan profil pengguna selepas dicipta.' });
        }

        res.status(200).json({ 
            message: "Pendaftaran berjaya!",
            user: sessionData.user,
            session: sessionData.session,
            profile: profile
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

        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*, role')
            .eq('user_id', authData.user.id)
            .single();

        if (profileError) {
            console.error('Ralat mendapatkan profil pengguna:', profileError.message);
        }

        res.status(200).json({ user: authData.user, session: authData.session, profile: profile });

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
            .from('users')
            .update({ 
                payment_reference: payment_reference,
                payment_status: 'pending'
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

// Endpoint untuk dapatkan profil pengguna semasa
app.get('/api/profile', requireAuth, async (req, res) => {
    const { data: profile, error } = await supabaseAdmin
        .from('users')
        .select('*, role')
        .eq('user_id', req.user.id)
        .single();

    if (error || !profile) {
        return res.status(404).json({ error: 'Profil pengguna tidak ditemui.' });
    }

    res.status(200).json(profile);
});

// 6. API ADMIN (Perlu log masuk sebagai admin)

app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
    const { data, error } = await supabaseAdmin.from('users').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json(data);
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
    const { data, error } = await supabaseAdmin.from('users').insert([req.body]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
    const { data, error } = await supabaseAdmin.from('users').delete().match({ id: req.params.id });
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ message: 'User dipadam' });
});

// Endpoint untuk Admin meluluskan pembayaran
app.post('/api/users/:id/approve', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
        .from('users')
        .update({ payment_status: 'paid' })
        .eq('id', id)
        .select();

    if (error) {
        console.error('Ralat meluluskan pembayaran:', error);
        return res.status(500).json({ error: 'Gagal meluluskan pembayaran pelanggan.'});
    }

    res.status(200).json(data[0]);
});

// Endpoint untuk Admin menolak pembayaran
app.delete('/api/users/:id/reject', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
        .from('users')
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

// 7. EKSPORT APP UNTUK VERCEL
module.exports = app;