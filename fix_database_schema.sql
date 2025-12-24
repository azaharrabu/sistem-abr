-- =====================================================================================
-- DATABASE SCHEMA FIX SCRIPT
-- =====================================================================================
-- TUJUAN: Skrip ini membetulkan dua isu kritikal dalam pangkalan data:
--   1. Memastikan jadual `public.users` mempunyai ruangan `full_name` dan `phone_number`.
--   2. Mewujudkan hubungan kunci asing (foreign key) yang betul dari `public.payments`
--      ke `public.users` untuk membolehkan admin dashboard berfungsi dengan betul.
--
-- ARAHAN: Salin dan laksanakan keseluruhan kod ini di SQL Editor Supabase anda.
-- =====================================================================================

-- Langkah 1: Tambah ruangan 'full_name' dan 'phone_number' pada jadual 'users'.
-- Ini memastikan maklumat profil pengguna boleh disimpan semasa pendaftaran.
-- `ADD COLUMN IF NOT EXISTS` selamat untuk dijalankan walaupun ruangan sudah wujud.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Langkah 2: Wujudkan hubungan kunci asing (foreign key) antara 'payments' dan 'users'.
-- Ini adalah langkah kritikal untuk membetulkan pertanyaan di papan pemuka admin.

-- Mula-mula, pastikan jadual `payments` mempunyai ruangan `user_id`.
-- (Ia mungkin sudah wujud dari logik `submit-payment` sebelumnya, tetapi ini adalah untuk jaminan).
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Buang kekangan lama jika ada untuk mengelakkan ralat.
ALTER TABLE public.payments
DROP CONSTRAINT IF EXISTS payments_user_id_fkey;

-- Tambah kekangan kunci asing yang baharu. Ini menghubungkan `payments.user_id` ke `users.user_id`.
-- `ON DELETE SET NULL` bermakna jika pengguna dipadam, rekod bayaran tidak akan hilang,
-- tetapi pautan kepada pengguna itu akan dikosongkan. Ini mengekalkan sejarah bayaran.
ALTER TABLE public.payments
ADD CONSTRAINT payments_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

-- Langkah 3: Indeks ruangan 'user_id' dalam jadual 'payments' untuk prestasi yang lebih pantas.
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);

-- Mesej pengesahan untuk anda selepas menjalankan skrip.
SELECT 'Skrip pembaikan skema pangkalan data telah selesai dijalankan.' AS status;
