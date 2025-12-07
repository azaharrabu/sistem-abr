-- =====================================================================================
-- FIX: MEMBETULKAN POLISI KESELAMATAN (RLS) UNTUK JADUAL 'PAYMENTS'
-- =====================================================================================
-- TUJUAN: Skrip ini membetulkan ralat "new row violates row-level security policy for table 'payments'".
--         Ia berlaku kerana tiada polisi yang membenarkan pengguna untuk mencipta
--         rekod bayaran untuk diri mereka sendiri.
--
-- TINDAKAN:
-- 1. Menambah satu polisi INSERT yang membenarkan pengguna untuk mencipta rekod bayaran
--    jika 'user_id' sepadan dengan ID mereka sendiri.
-- =====================================================================================

CREATE POLICY "Allow users to create their own payment requests."
ON public.payments
FOR INSERT
WITH CHECK ( auth.uid() = user_id );

-- =====================================================================================
-- SELESAI. Ralat INSERT pada jadual 'payments' sepatutnya telah selesai.
-- Sila cuba semula proses pendaftaran (signup).
-- =====================================================================================
