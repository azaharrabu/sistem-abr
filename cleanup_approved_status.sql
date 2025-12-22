-- =====================================================================================
-- SKRIP SATU KALI: Menyeragamkan Status Pembayaran
-- =====================================================================================
-- TUJUAN: Skrip ini mengemas kini semua rekod pembayaran lama dalam jadual `payments`
--         untuk menukar status 'approved' kepada 'paid' demi konsistensi.
--
-- ARAHAN: Laksanakan skrip ini sekali sahaja di Editor SQL Supabase anda untuk
--         membersihkan dan menyeragamkan data lama anda.
-- =====================================================================================

UPDATE public.payments
SET status = 'paid'
WHERE status = 'approved';

-- Mesej pengesahan selepas skrip berjaya dijalankan.
SELECT 'Pembersihan data selesai. Semua rekod pembayaran "approved" telah dikemas kini kepada "paid".' AS status;
