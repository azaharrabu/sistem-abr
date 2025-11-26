// _utils/auth.js
const { createClient } = require('@supabase/supabase-js');

// Inisialisasi Supabase di sini juga untuk pengesahan token
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Fungsi untuk mengesahkan JWT dari 'Authorization' header.
 * @param {object} req - Objek permintaan (request) Vercel.
 * @returns {Promise<object>} - Mengembalikan objek pengguna jika sah.
 * @throws {Error} - lontarkan ralat jika token tidak sah atau tiada.
 */
async function verifyToken(req) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Authentication failed: No token provided.');
    }

    const token = authHeader.split(' ')[1];
    
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
        throw new Error('Authentication failed: Invalid token.');
    }

    return user;
}

module.exports = { verifyToken };
