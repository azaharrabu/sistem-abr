-- =====================================================================================
-- CLEANUP: MEMADAM KOLUM BANK YANG TIDAK LAGI DIGUNAKAN
-- =====================================================================================
-- TUJUAN: Skrip ini memadamkan kolum 'bank_name' dan 'bank_account_no' dari jadual
--         'public.affiliates' kerana ia tidak lagi digunakan dalam aliran aplikasi.
-- =====================================================================================

ALTER TABLE public.affiliates
DROP COLUMN IF EXISTS bank_name,
DROP COLUMN IF EXISTS bank_account_no;

-- =====================================================================================
-- SELESAI. Skema pangkalan data kini lebih bersih.
-- =====================================================================================
