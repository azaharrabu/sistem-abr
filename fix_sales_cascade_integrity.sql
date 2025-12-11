-- =================================================================
-- FAIL PEMBAIKAN INTEGRITI DATA JADUAL 'sales'
-- =================================================================
-- Arahan: Sila jalankan keseluruhan skrip ini di Supabase SQL Editor anda.
-- Ia akan membetulkan masalah "rekod yatim" (orphaned records) secara kekal.

-- LANGKAH 1: Betulkan Foreign Key untuk Pemadaman Kaskad (CASCADE)
-- =================================================================
-- Skrip ini akan membuang 'foreign key' yang lama dan mencipta semula 
-- dengan arahan ON DELETE CASCADE.
-- NOTA: Kami mengandaikan nama constraint adalah 'sales_purchaser_user_id_fkey'. 
-- Ini adalah nama standard yang dijana oleh Supabase.

-- Mula transaksi
BEGIN;

-- Padam constraint lama jika wujud
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_purchaser_user_id_fkey;

-- Tambah semula constraint dengan ON DELETE CASCADE
ALTER TABLE public.sales
ADD CONSTRAINT sales_purchaser_user_id_fkey
FOREIGN KEY (purchaser_user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

COMMENT ON CONSTRAINT sales_purchaser_user_id_fkey ON public.sales IS 'Memastikan rekod jualan akan turut terpadam apabila pengguna (pembeli) dipadamkan.';

-- Tamat transaksi
COMMIT;


-- LANGKAH 2: Bersihkan Rekod Jualan Yatim (Orphaned Sales Records)
-- =================================================================
-- Skrip ini akan memadam mana-mana rekod dalam 'sales' di mana pembeli (purchaser)
-- telah dipadam dari sistem.

DELETE FROM public.sales
WHERE purchaser_user_id NOT IN (SELECT id FROM auth.users);

-- =================================================================
-- SELESAI. Selepas ini, data anda akan lebih konsisten.
-- Apabila anda memadam pengguna, rekod jualan mereka akan turut terpadam.
-- =================================================================
