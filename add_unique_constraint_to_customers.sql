-- Skrip ini menambah kekangan UNIQUE pada lajur 'user_id' dalam jadual 'customers'.
-- Ini akan menghalang rekod pendua daripada dicipta pada masa hadapan.
-- PASTIKAN ANDA TELAH MENJALANKAN SKRIP PEMBERSIHAN (fix_duplicate_customers.sql) DAHULU.
-- Jika masih ada pendua, arahan ini akan gagal.

ALTER TABLE public.customers
ADD CONSTRAINT customers_user_id_unique UNIQUE (user_id);

-- Mesej pengesahan
SELECT 'Kekangan UNIQUE berjaya ditambah pada customers.user_id';