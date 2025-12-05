-- Skrip ini menambah kekangan UNIQUE pada lajur 'user_id' dalam jadual 'profiles'.
-- Ini akan menghalang rekod pendua daripada dicipta pada masa hadapan.
-- PASTIKAN ANDA TELAH MENJALANKAN SKRIP PEMBERSIHAN (fix_duplicate_users.sql) DAHULU.
-- Jika masih ada pendua, arahan ini akan gagal.

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);

-- Mesej pengesahan
SELECT 'Kekangan UNIQUE berjaya ditambah pada profiles.user_id';