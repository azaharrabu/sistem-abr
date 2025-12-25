-- LANGKAH DIAGNOSTIK: Menukar nama lajur untuk menguji integriti cache dan deployment.
-- JANGAN GUNAKAN INI UNTUK PRODUKSI, HANYA UNTUK DIAGNOSIS.

-- Pastikan anda telah jalankan skrip ini SEBELUM menguji API yang telah dikemas kini.
ALTER TABLE public.payments
RENAME COLUMN reference_no TO payment_ref_id;

-- Untuk undur (undo) perubahan ini kemudian:
-- ALTER TABLE public.payments RENAME COLUMN payment_ref_id TO reference_no;
